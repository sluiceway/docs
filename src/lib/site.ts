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

/**
 * Whether a page is left out of the search index: each decision record. They are most of the
 * site's pages and use the product's words more often than the guides do, so search answered
 * "tick" and "drift" with the reasoning of a past decision, some of it superseded, in place of
 * the instruction. Pagefind cannot weigh a whole page down: a match in a title is boosted apart
 * from the weight of the words, and a short page full of one word still scores near the top.
 *
 * The list of records stays in the index, so "decision records" or a record's number finds the
 * list, and the sidebar and the guides link each record. Search engines still index them.
 */
export function outOfSearch(id: string): boolean {
  return /^why\/\d{4}-/.test(id);
}

/** The landing page, which the header and footer link to as "Sluiceway". */
export const LANDING_URL = "https://sluiceway.dev/";

/** The hosted app, where a person signs in with GitHub. The header's one button goes there. */
export const CONSOLE_URL = "https://console.sluiceway.dev";
