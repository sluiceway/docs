// Which Umami website a build counts for, decided once, in astro.config.ts, before anything is
// built. An empty id used to turn analytics off without a word, so the live site could go quiet
// by accident. Now an empty id fails the build, and a build without analytics says so with
// ANALYTICS_OFF=1. test/analytics-built.test.ts reads the same environment and checks dist/.

/** The Umami website for the docs. Not a secret: every page that loads the script shows it. */
export const DEFAULT_UMAMI_WEBSITE_ID = "7471fe15-3d60-4902-a18a-32dfff6b9dba";

export const UMAMI_SCRIPT_URL = "https://analytics.robbeverhelst.be/script.js";

/**
 * The website id this build carries, or "" when `ANALYTICS_OFF=1` turns analytics off.
 * `PUBLIC_UMAMI_WEBSITE_ID` overrides the default. Set but empty, it throws. `env` is
 * `process.env`, or a stand-in for it in the tests.
 */
export function umamiWebsiteId(env: Record<string, string | undefined>): string {
  if (env.ANALYTICS_OFF === "1") return "";
  const id = (env.PUBLIC_UMAMI_WEBSITE_ID ?? DEFAULT_UMAMI_WEBSITE_ID).trim();
  if (id === "") {
    throw new Error(
      "PUBLIC_UMAMI_WEBSITE_ID is empty, so this build would count nothing. Unset it to use " +
        "the docs' own Umami website, set it to another website id, or set ANALYTICS_OFF=1 " +
        "to build without analytics on purpose.",
    );
  }
  return id;
}
