// Site-wide constants that are not about the pin (see source.ts for that).

/**
 * The link for the one line that says a hosted version is planned. The coordinator supplies
 * it. While it is empty the line is not rendered anywhere.
 */
export const WAITLIST_URL = "";

/**
 * Pages kept out of search engines: they carry `noindex` and are left out of the sitemap.
 * Page ids, as in src/lib/pages.ts.
 */
export const UNLISTED = ["404", "style-check"];

/** The landing page, which the header and footer link to as "Sluiceway". */
export const LANDING_URL = "https://sluiceway.dev/";

/** The hosted app, where a person signs in with GitHub. The header's one button goes there. */
export const CONSOLE_URL = "https://console.sluiceway.dev";
