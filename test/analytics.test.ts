import { describe, expect, test } from "bun:test";
import {
  type AnalyticsEnv,
  createAnalytics,
  type EventData,
  OLD_CONSENT_KEY,
} from "../src/lib/analytics";

const CONFIG = {
  websiteId: "site-id",
  src: "https://analytics.example/script.js",
  domain: "docs.example",
};

/**
 * A fake browser: records every script added, every event Umami receives, and every write to
 * storage. It starts with an old consent record in storage, as a returning reader's has.
 */
function fakeBrowser(navigator: AnalyticsEnv["navigator"] = {}) {
  const store = new Map<string, string>([[OLD_CONSENT_KEY, '{"preferences":{"analytics":true}}']]);
  const writes: string[] = [];
  const scripts: Record<string, string>[] = [];
  const onloads: (() => void)[] = [];
  const events: [string, EventData | undefined][] = [];
  let umamiLoaded = false;
  const env: AnalyticsEnv = {
    storage: {
      removeItem: (key) => {
        writes.push(`remove ${key}`);
        store.delete(key);
      },
    },
    navigator,
    addScript(attributes, onload) {
      scripts.push(attributes);
      onloads.push(onload);
    },
    umami: () =>
      umamiLoaded ? { track: (event, data) => void events.push([event, data]) } : undefined,
  };
  /** Let the added script run. */
  const runScripts = () => {
    umamiLoaded = true;
    for (const onload of onloads.splice(0)) onload();
  };
  return { env, store, writes, scripts, events, runScripts };
}

describe("every reader", () => {
  test("gets the script once, with its attributes, and nothing is asked or stored", () => {
    const browser = fakeBrowser();
    const analytics = createAnalytics(CONFIG, browser.env);
    expect(analytics.allowed()).toBe(true);
    analytics.init();
    analytics.init();
    expect(browser.scripts).toEqual([
      {
        src: CONFIG.src,
        "data-website-id": "site-id",
        "data-do-not-track": "true",
        "data-exclude-search": "true",
        "data-domains": "docs.example",
      },
    ]);
    // The only touch of storage is removing the old consent record.
    expect(browser.writes.every((w) => w === `remove ${OLD_CONSENT_KEY}`)).toBe(true);
    expect(browser.store.size).toBe(0);
  });

  test("events wait for the script, then go out in order", () => {
    const browser = fakeBrowser();
    const analytics = createAnalytics(CONFIG, browser.env);
    analytics.init();
    expect(analytics.track("copy-code", { path: "/docs/", block: "yaml" })).toBe(true);
    expect(browser.events).toEqual([]);
    browser.runScripts();
    analytics.track("outbound", { host: "example.com" });
    expect(browser.events).toEqual([
      ["copy-code", { path: "/docs/", block: "yaml" }],
      ["outbound", { host: "example.com" }],
    ]);
  });

  test("an event before init adds the script itself", () => {
    const browser = fakeBrowser();
    createAnalytics(CONFIG, browser.env).track("feedback", { path: "/docs/", vote: "up" });
    expect(browser.scripts).toHaveLength(1);
  });

  test("blocked storage does not stop analytics", () => {
    const browser = fakeBrowser();
    const analytics = createAnalytics(CONFIG, {
      ...browser.env,
      storage: {
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    });
    analytics.init();
    expect(browser.scripts).toHaveLength(1);
  });
});

describe("Do Not Track", () => {
  test("blocks everything: no script and no events", () => {
    const browser = fakeBrowser({ doNotTrack: "1" });
    const analytics = createAnalytics(CONFIG, browser.env);
    expect(analytics.blocked()).toBe(true);
    analytics.init();
    expect(analytics.track("search", { query: "scan", results: 4 })).toBe(false);
    browser.runScripts();
    expect(browser.scripts).toEqual([]);
    expect(browser.events).toEqual([]);
  });

  test("set to 0 does not block", () => {
    const analytics = createAnalytics(CONFIG, fakeBrowser({ doNotTrack: "0" }).env);
    expect(analytics.blocked()).toBe(false);
  });

  test("is the only signal read", () => {
    const navigator = { globalPrivacyControl: true } as AnalyticsEnv["navigator"];
    const analytics = createAnalytics(CONFIG, fakeBrowser(navigator).env);
    expect(analytics.blocked()).toBe(false);
  });
});

describe("analytics off", () => {
  test("an empty website id adds no script and sends nothing", () => {
    const browser = fakeBrowser();
    const analytics = createAnalytics({ ...CONFIG, websiteId: "" }, browser.env);
    expect(analytics.enabled).toBe(false);
    analytics.init();
    expect(analytics.track("feedback", { path: "/docs/", vote: "up" })).toBe(false);
    expect(browser.scripts).toEqual([]);
  });
});
