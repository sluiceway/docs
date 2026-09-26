// Links from the pages this slice writes to other pages of the site. Every link names a page
// id from src/lib/pages.ts and goes through its `urlFor`, so the base is added the same way
// everywhere. A page id that pages.ts does not define stops the build.

import { GET_STARTED, githubSlug, HOSTED_APP, pages, SLICE_3, urlFor } from "./pages";
import { REPO_URL } from "./source";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const url = urlFor(BASE);

let known: Set<string> | undefined;

/** The URL of a page id from pages.ts, with an optional `#fragment`, such as `page("why")`. */
export function page(id: string): string {
  known ??= new Set([
    ...pages(REPO_URL, BASE).map((p) => p.id),
    SLICE_3.overview,
    SLICE_3.whatItLooksLike,
    SLICE_3.theHeader,
    ...Object.values(GET_STARTED),
    ...Object.values(HOSTED_APP),
  ]);
  const path = id.split("#")[0] ?? "";
  if (!known.has(path)) {
    throw new Error(`src/lib/routes.ts: "${path}" is not a page in src/lib/pages.ts.`);
  }
  return url(id);
}

export const ROUTES = {
  getStarted: page(GET_STARTED.withTheApp),
  runTheActionYourself: page(GET_STARTED.runTheActionYourself),
  appAndAction: page(GET_STARTED.together),
  configuration: page("guides/configuration"),
  credentials: page("guides/credentials"),
  usingTheDashboard: page("using-the-dashboard"),
  personality: page(`guides/configuration#${githubSlug("dashboard.personality")}`),
  why: page("why"),
  whatItLooksLike: page(SLICE_3.whatItLooksLike),
  theHeader: page(SLICE_3.theHeader),
} as const;

/**
 * A term in the glossary, such as `glossary("Counts line")`. A term's id is its GitHub slug;
 * a term named like a CONTEXT.md heading takes `-term` after it, and none of the terms linked
 * from these pages is.
 */
export function glossary(term: string): string {
  return page(`reference/glossary#${githubSlug(term)}`);
}
