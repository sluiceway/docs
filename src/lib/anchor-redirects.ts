// Headings that left a page when a release moved their text. The action's own links are
// rewritten by the loader, but a link from outside keeps its old fragment. On these pages a
// small script sends such a link on to where the text lives now.

/**
 * Page id, to a fragment the page no longer has, to the page id and fragment where that text
 * lives now. The test checks every target against the built site.
 */
export const ANCHOR_REDIRECTS: Record<string, Record<string, string>> = {
  // v0.12.0 moved the README's Setup into docs/workflow.md and docs/read-only-trial.md.
  "get-started": {
    setup: "guides/workflow",
    "what-goes-where": "guides/workflow#what-goes-where",
    "1-check-your-setup": "guides/workflow#check-your-setup",
    // The file's h1 is also "The workflow", so GitHub gives this h2 the second id.
    "2-add-the-workflow": "guides/workflow#the-workflow-1",
    "with-github-environments": "guides/workflow#with-github-environments",
    "merge-and-deploy": "guides/workflow#merge-and-deploy",
    "3-tell-it-about-your-stacks": "guides/configuration",
    "4-load-your-credentials": "guides/credentials",
    "start-read-only": "guides/read-only-trial",
    "pin-a-commit": "guides/workflow#pin-a-commit",
    // Getting started leads with the app since 2026-09-26, and the steps without it moved to a
    // page of their own.
    requirements: "get-started/run-the-action-yourself#requirements",
    "get-started": "get-started/run-the-action-yourself#get-started",
  },
  // v0.12.0 moved the README's "What it does not do yet" into the Limits of the dashboard's use.
  "not-in-v1": {
    "what-it-does-not-do-yet": "using-the-dashboard#limits",
  },
  // Headings renamed to say what their section shows.
  "what-it-looks-like": {
    "the-parts": "what-it-looks-like#read-the-dashboard-from-the-top",
  },
  "the-header": {
    "the-pictures": "the-header#every-picture-one-per-state",
    "with-the-destroy-sign": "the-header#signs-for-deletes-and-replaces",
    "water-steps": "the-header#the-water-rises-in-five-steps",
  },
  // v0.23.0 made notifications built in: Recipes became "Steps of your own", and the generic
  // webhook recipe became the built-in webhook.
  "guides/notifications": {
    recipes: "guides/notifications#steps-of-your-own",
    "a-generic-webhook": "guides/notifications#a-webhook",
  },
};

/**
 * Where a visit to `hash` should go instead, or undefined to stay. A fragment the page has an
 * element for stays, so a heading that comes back wins over the map.
 */
export function redirectFor(
  hash: string,
  map: Record<string, string>,
  has: (id: string) => boolean,
): string | undefined {
  let id: string;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return undefined;
  }
  if (!id || has(id)) return undefined;
  return Object.hasOwn(map, id) ? map[id] : undefined;
}

/**
 * Pages that moved to a new id, old id to new id. Astro writes a page at the old URL that
 * sends the visitor on. The test checks every target against the built site.
 */
export const PAGE_REDIRECTS: Record<string, string> = {
  // v0.31.0 gave the second record of each duplicated number its own: 0092 and 0093 were
  // each two records, and the two about the example and the queued crate became 0097 and 0098.
  "why/0092-the-readme-example-keeps-its-picture-open-and-breaks-its-lines-as-an-issue-does":
    "why/0097-the-readme-example-keeps-its-picture-open-and-breaks-its-lines-as-an-issue-does",
  "why/0093-a-queued-row-starts-with-the-crate-standing-still":
    "why/0098-a-queued-row-starts-with-the-crate-standing-still",
};
