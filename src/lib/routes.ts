// Links from the pages this repo writes to other pages of the site, with the base in front, so
// moving the site changes nothing here. Pages from the content import live at the paths
// below; if one moves, change it here and the link check catches the rest.

/** A page of this site, such as `route("the-header/")`. */
export function route(path: string): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
}

export const ROUTES = {
  getStarted: route("get-started/"),
  configuration: route("configuration/"),
  decisions: route("decisions/"),
  whatItLooksLike: route("what-it-looks-like/"),
  theHeader: route("the-header/"),
} as const;

/** A term on the Reference page's glossary, such as `glossary("Counts line")`. */
export function glossary(term: string): string {
  const slug = term
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/ +/g, "-");
  return route(`reference/glossary/#${slug}`);
}
