// Analytics with self-hosted Umami, only after the reader allows it. The consent record has
// the same shape as on the maintainer's own site. Umami's script is added to the page only
// once consent is in `localStorage`, and `track()` does nothing without it. Do Not Track and
// Global Privacy Control block everything: no script, no consent bar.

/** The Umami website for the docs. Not a secret: every page that loads the script shows it. */
const DEFAULT_UMAMI_WEBSITE_ID = "7471fe15-3d60-4902-a18a-32dfff6b9dba";

/**
 * `PUBLIC_UMAMI_WEBSITE_ID` overrides the default at build time. An empty string turns
 * analytics off: no script, no consent bar, no footer line.
 */
export const UMAMI_WEBSITE_ID: string =
  import.meta.env.PUBLIC_UMAMI_WEBSITE_ID ?? DEFAULT_UMAMI_WEBSITE_ID;

export const ANALYTICS_ENABLED = UMAMI_WEBSITE_ID !== "";

/** Written this way so that a build with analytics off holds no reference to the host. */
export const UMAMI_SRC = ANALYTICS_ENABLED ? "https://analytics.robbeverhelst.be/script.js" : "";

/** Where the choice is kept. */
export const CONSENT_KEY = "cookie-consent";

export interface ConsentRecord {
  timestamp: string;
  preferences: { essential: true; analytics: boolean };
}

export type EventData = Record<string, string | number>;

interface Umami {
  track(event: string, data?: EventData): unknown;
}

declare global {
  interface Window {
    umami?: Umami;
  }
}

/** What analytics needs from the browser, so the tests can hand it a fake one. */
export interface AnalyticsEnv {
  storage: Pick<Storage, "getItem" | "setItem"> | undefined;
  navigator: { doNotTrack?: string | null; globalPrivacyControl?: boolean };
  /** Add a deferred `<script>` with these attributes, and call `onload` once it has run. */
  addScript(attributes: Record<string, string>, onload: () => void): void;
  umami(): Umami | undefined;
  now(): Date;
}

export interface AnalyticsConfig {
  websiteId: string;
  src: string;
  /** The live host. Umami ignores every other host, so local builds and previews never count. */
  domain: string;
}

export interface Analytics {
  readonly enabled: boolean;
  /** Do Not Track or Global Privacy Control is on. Nothing loads and no bar shows. */
  blocked(): boolean;
  /** The stored answer: true, false, or null before the reader has chosen. */
  choice(): boolean | null;
  /** Analytics may run on this page. */
  allowed(): boolean;
  /** Store the reader's answer. Allowing adds the script at once. */
  choose(analytics: boolean): void;
  /** Add the script if the reader has allowed it. Call once per page. */
  init(): void;
  /** Send a named event. Without consent it sends nothing and returns false. */
  track(event: string, data?: EventData): boolean;
}

export function createAnalytics(config: AnalyticsConfig, env: AnalyticsEnv): Analytics {
  const enabled = config.websiteId !== "" && config.src !== "";
  let state: "none" | "loading" | "ready" = "none";
  // Events sent while the script loads. They go out once it has run.
  const queue: [string, EventData | undefined][] = [];

  const blocked = () =>
    env.navigator.doNotTrack === "1" || env.navigator.globalPrivacyControl === true;

  const choice = (): boolean | null => {
    try {
      const stored = env.storage?.getItem(CONSENT_KEY);
      if (!stored) return null;
      const record = JSON.parse(stored) as Partial<ConsentRecord> | null;
      return record?.preferences?.analytics === true;
    } catch {
      return null;
    }
  };

  const allowed = () => enabled && !blocked() && choice() === true;

  const load = () => {
    if (state !== "none" || !allowed()) return;
    state = "loading";
    env.addScript(
      {
        src: config.src,
        "data-website-id": config.websiteId,
        "data-do-not-track": "true",
        "data-exclude-search": "true",
        ...(config.domain ? { "data-domains": config.domain } : {}),
      },
      () => {
        state = "ready";
        const umami = env.umami();
        for (const [event, data] of queue.splice(0)) {
          if (allowed()) umami?.track(event, data);
        }
      },
    );
  };

  return {
    enabled,
    blocked,
    choice,
    allowed,
    choose(analytics) {
      const record: ConsentRecord = {
        timestamp: env.now().toISOString(),
        preferences: { essential: true, analytics },
      };
      try {
        env.storage?.setItem(CONSENT_KEY, JSON.stringify(record));
      } catch {
        // Storage is blocked, so the choice cannot be kept and nothing loads.
      }
      // Turning it off stops events at once; the script is gone on the next page load.
      load();
    },
    init: load,
    track(event, data) {
      if (!allowed()) return false;
      load();
      if (state === "ready") env.umami()?.track(event, data);
      else queue.push([event, data]);
      return true;
    },
  };
}

function browserEnv(): AnalyticsEnv {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  return {
    storage,
    navigator: navigator as AnalyticsEnv["navigator"],
    addScript(attributes, onload) {
      const script = document.createElement("script");
      script.defer = true;
      for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
      script.addEventListener("load", onload);
      document.head.append(script);
    },
    umami: () => window.umami,
    now: () => new Date(),
  };
}

/** This page's analytics, in the browser. Undefined on the server. */
export const analytics: Analytics | undefined =
  typeof window === "undefined"
    ? undefined
    : createAnalytics(
        {
          websiteId: UMAMI_WEBSITE_ID,
          src: UMAMI_SRC,
          domain: import.meta.env.SITE ? new URL(import.meta.env.SITE).hostname : "",
        },
        browserEnv(),
      );
