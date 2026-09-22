import { describe, expect, test } from "bun:test";
import {
  type AnalyticsEnv,
  CONSENT_KEY,
  type ConsentRecord,
  createAnalytics,
  type EventData,
} from "../src/lib/analytics";

const CONFIG = {
  websiteId: "site-id",
  src: "https://analytics.example/script.js",
  domain: "docs.example",
};

/** A fake browser: records every script added and every event Umami receives. */
function fakeBrowser(navigator: AnalyticsEnv["navigator"] = {}) {
  const store = new Map<string, string>();
  const scripts: Record<string, string>[] = [];
  const onloads: (() => void)[] = [];
  const events: [string, EventData | undefined][] = [];
  let umamiLoaded = false;
  const env: AnalyticsEnv = {
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
    },
    navigator,
    addScript(attributes, onload) {
      scripts.push(attributes);
      onloads.push(onload);
    },
    umami: () =>
      umamiLoaded ? { track: (event, data) => void events.push([event, data]) } : undefined,
    now: () => new Date("2026-09-22T10:00:00.000Z"),
  };
  /** Let the added script run. */
  const runScripts = () => {
    umamiLoaded = true;
    for (const onload of onloads.splice(0)) onload();
  };
  return { env, store, scripts, events, runScripts };
}

describe("no consent", () => {
  test("adds no script and sends no events", () => {
    const browser = fakeBrowser();
    const analytics = createAnalytics(CONFIG, browser.env);
    analytics.init();
    expect(analytics.choice()).toBeNull();
    expect(analytics.track("search", { query: "deploy", results: 3 })).toBe(false);
    browser.runScripts();
    expect(browser.scripts).toEqual([]);
    expect(browser.events).toEqual([]);
  });

  test("a stored no adds no script either", () => {
    const browser = fakeBrowser();
    createAnalytics(CONFIG, browser.env).choose(false);
    const analytics = createAnalytics(CONFIG, browser.env);
    analytics.init();
    expect(analytics.choice()).toBe(false);
    expect(analytics.track("feedback", { path: "/docs/", vote: "up" })).toBe(false);
    expect(browser.scripts).toEqual([]);
  });

  test("an unreadable record counts as no choice", () => {
    const browser = fakeBrowser();
    browser.store.set(CONSENT_KEY, "{not json");
    const analytics = createAnalytics(CONFIG, browser.env);
    expect(analytics.choice()).toBeNull();
    expect(analytics.allowed()).toBe(false);
  });
});

describe("consent", () => {
  test("stores the record and adds the script once, with its attributes", () => {
    const browser = fakeBrowser();
    const analytics = createAnalytics(CONFIG, browser.env);
    analytics.choose(true);
    analytics.init();
    const record = JSON.parse(browser.store.get(CONSENT_KEY) ?? "") as ConsentRecord;
    expect(record).toEqual({
      timestamp: "2026-09-22T10:00:00.000Z",
      preferences: { essential: true, analytics: true },
    });
    expect(browser.scripts).toEqual([
      {
        src: CONFIG.src,
        "data-website-id": "site-id",
        "data-do-not-track": "true",
        "data-exclude-search": "true",
        "data-domains": "docs.example",
      },
    ]);
  });

  test("events wait for the script, then go out in order", () => {
    const browser = fakeBrowser();
    const analytics = createAnalytics(CONFIG, browser.env);
    analytics.choose(true);
    expect(analytics.track("copy-code", { path: "/docs/", block: "yaml" })).toBe(true);
    expect(browser.events).toEqual([]);
    browser.runScripts();
    analytics.track("outbound", { host: "example.com" });
    expect(browser.events).toEqual([
      ["copy-code", { path: "/docs/", block: "yaml" }],
      ["outbound", { host: "example.com" }],
    ]);
  });

  test("a later page load adds the script from the stored record", () => {
    const browser = fakeBrowser();
    createAnalytics(CONFIG, browser.env).choose(true);
    const nextPage = createAnalytics(CONFIG, { ...browser.env });
    nextPage.init();
    expect(browser.scripts).toHaveLength(2);
  });
});

describe("consent, then revoked", () => {
  test("stops events at once and adds no script on the next page load", () => {
    const browser = fakeBrowser();
    const analytics = createAnalytics(CONFIG, browser.env);
    analytics.choose(true);
    browser.runScripts();
    analytics.track("search", { query: "stack id", results: 2 });
    analytics.choose(false);
    expect(analytics.track("search", { query: "destroy", results: 1 })).toBe(false);
    expect(browser.events).toEqual([["search", { query: "stack id", results: 2 }]]);

    const scriptsBefore = browser.scripts.length;
    const nextPage = createAnalytics(CONFIG, browser.env);
    nextPage.init();
    expect(nextPage.choice()).toBe(false);
    expect(browser.scripts).toHaveLength(scriptsBefore);
  });

  test("events queued before the revoke are dropped", () => {
    const browser = fakeBrowser();
    const analytics = createAnalytics(CONFIG, browser.env);
    analytics.choose(true);
    analytics.track("feedback", { path: "/docs/", vote: "down" });
    analytics.choose(false);
    browser.runScripts();
    expect(browser.events).toEqual([]);
  });
});

describe("Do Not Track and Global Privacy Control", () => {
  for (const [name, navigator] of [
    ["Do Not Track", { doNotTrack: "1" }],
    ["Global Privacy Control", { globalPrivacyControl: true }],
  ] as const) {
    test(`${name} blocks everything, even with a stored yes`, () => {
      const browser = fakeBrowser(navigator);
      const analytics = createAnalytics(CONFIG, browser.env);
      expect(analytics.blocked()).toBe(true);
      analytics.choose(true);
      analytics.init();
      expect(analytics.track("search", { query: "scan", results: 4 })).toBe(false);
      browser.runScripts();
      expect(browser.scripts).toEqual([]);
      expect(browser.events).toEqual([]);
    });
  }

  test("Do Not Track set to 0 does not block", () => {
    const analytics = createAnalytics(CONFIG, fakeBrowser({ doNotTrack: "0" }).env);
    expect(analytics.blocked()).toBe(false);
  });
});

describe("analytics off", () => {
  test("an empty website id adds no script, even with consent", () => {
    const browser = fakeBrowser();
    const analytics = createAnalytics({ ...CONFIG, websiteId: "" }, browser.env);
    expect(analytics.enabled).toBe(false);
    analytics.choose(true);
    analytics.init();
    expect(analytics.track("feedback", { path: "/docs/", vote: "up" })).toBe(false);
    expect(browser.scripts).toEqual([]);
  });
});
