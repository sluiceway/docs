// Analytics with self-hosted Umami, for every reader. Umami sets no cookie and these docs
// store nothing in the browser, so there is nothing to ask. Do Not Track blocks everything: the
// script is never added and no event is sent. The privacy page says the same in words, so a
// change here is a change there (src/content/docs/privacy.mdx).

import { UMAMI_SCRIPT_URL } from "./analytics-build";

/**
 * The website id, set by astro.config.ts from `umamiWebsiteId()`: the docs' own id, an
 * override from `PUBLIC_UMAMI_WEBSITE_ID`, or "" when the build ran with `ANALYTICS_OFF=1`.
 */
export const UMAMI_WEBSITE_ID: string = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID ?? "";

export const ANALYTICS_ENABLED = UMAMI_WEBSITE_ID !== "";

/** Written this way so that a build with analytics off holds no reference to the host. */
export const UMAMI_SRC = ANALYTICS_ENABLED ? UMAMI_SCRIPT_URL : "";

/**
 * The key an earlier version kept the reader's answer under. Nothing is stored now, and the old
 * record is removed once so no browser keeps it.
 */
export const OLD_CONSENT_KEY = "cookie-consent";

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
  storage: Pick<Storage, "removeItem"> | undefined;
  navigator: { doNotTrack?: string | null };
  /** Add a deferred `<script>` with these attributes, and call `onload` once it has run. */
  addScript(attributes: Record<string, string>, onload: () => void): void;
  umami(): Umami | undefined;
}

export interface AnalyticsConfig {
  websiteId: string;
  src: string;
  /** The live host. Umami ignores every other host, so local builds and previews never count. */
  domain: string;
}

export interface Analytics {
  readonly enabled: boolean;
  /** Do Not Track is on. Nothing loads and nothing is sent. */
  blocked(): boolean;
  /** Analytics may run on this page. */
  allowed(): boolean;
  /** Add the script, unless analytics is off or blocked. Call once per page. */
  init(): void;
  /** Send a named event. Off or blocked, it sends nothing and returns false. */
  track(event: string, data?: EventData): boolean;
}

export function createAnalytics(config: AnalyticsConfig, env: AnalyticsEnv): Analytics {
  const enabled = config.websiteId !== "" && config.src !== "";
  let state: "none" | "loading" | "ready" = "none";
  // Events sent while the script loads. They go out once it has run.
  const queue: [string, EventData | undefined][] = [];

  const blocked = () => env.navigator.doNotTrack === "1";
  const allowed = () => enabled && !blocked();

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
        for (const [event, data] of queue.splice(0)) umami?.track(event, data);
      },
    );
  };

  return {
    enabled,
    blocked,
    allowed,
    init() {
      try {
        env.storage?.removeItem(OLD_CONSENT_KEY);
      } catch {
        // Storage is blocked, so there is nothing in it to remove.
      }
      load();
    },
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
