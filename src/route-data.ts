// What every page's <head> gets beyond Starlight's own tags: the fonts, the share image, the
// title rule and the JSON-LD. Starlight already writes the canonical URL, og:title,
// og:description, og:url, og:site_name and twitter:card from `site`, `base` and the page.

import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import interLatinExt from "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url";
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import monoLatinExt from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-ext-wght-normal.woff2?url";
import monoLatin from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
import { inlineHtml, readmeLead } from "./lib/action-text";
import { SHARE_IMAGE } from "./lib/share-image";
import { UNLISTED } from "./lib/site";
import { REPO_URL, VERSION } from "./lib/source";
import {
  breadcrumbList,
  breadcrumbs,
  type SidebarEntry,
  scriptJson,
  softwareApplication,
} from "./lib/structured-data";

type HeadEntry = App.Locals["starlightRoute"]["head"][number];

// The ranges of Fontsource's latin and latin-ext files. A browser fetches latin-ext only for a
// page that has a character in its range.
const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

function face(family: string, weight: string, src: string, range: string): string {
  return `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weight};src:url(${src}) format("woff2");unicode-range:${range}}`;
}

const FONT_FACES = [
  face("Inter", "100 900", interLatin, LATIN),
  face("Inter", "100 900", interLatinExt, LATIN_EXT),
  face("JetBrains Mono", "100 800", monoLatin, LATIN),
  face("JetBrains Mono", "100 800", monoLatinExt, LATIN_EXT),
].join("");

/** The two files the first screen needs, fetched before the stylesheet asks for them. */
const FONT_HEAD: HeadEntry[] = [
  ...[interLatin, monoLatin].map(
    (href): HeadEntry => ({
      tag: "link",
      attrs: { rel: "preload", href, as: "font", type: "font/woff2", crossorigin: "anonymous" },
    }),
  ),
  { tag: "style", attrs: {}, content: FONT_FACES },
];

const SUFFIX = " | Sluiceway";
const MAX_TITLE = 60;

const unlisted = new Set(UNLISTED);

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const { entry, head, id } = route;
  const site = context.site;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const absolute = (href: string) => (site ? new URL(href, site).href : href);
  const home = absolute(`${base}/`);
  const pageUrl = absolute(context.url.pathname);

  // A title that would pass about 60 characters with the site's name after it goes without
  // it. Only decision records are that long; their titles are the records' own words.
  const title = head.find((h) => h.tag === "title");
  if (title?.content?.endsWith(SUFFIX) && title.content.length > MAX_TITLE) {
    title.content = title.content.slice(0, -SUFFIX.length);
  }

  if (unlisted.has(id)) head.push({ tag: "meta", attrs: { name: "robots", content: "noindex" } });

  // The start page is the site, and its shared title is its browser title.
  if (id === "") {
    for (const tag of head) {
      if (tag.attrs?.property === "og:type") tag.attrs.content = "website";
      if (tag.attrs?.property === "og:title" && title?.content) tag.attrs.content = title.content;
    }
  }

  const image = absolute(`${base}/${SHARE_IMAGE.path}`);
  const meta = (key: "property" | "name", name: string, content: string): HeadEntry => ({
    tag: "meta",
    attrs: { [key]: name, content },
  });
  head.push(
    ...FONT_HEAD,
    meta("property", "og:image", image),
    meta("property", "og:image:type", "image/png"),
    meta("property", "og:image:width", String(SHARE_IMAGE.width)),
    meta("property", "og:image:height", String(SHARE_IMAGE.height)),
    meta("property", "og:image:alt", SHARE_IMAGE.alt),
    meta("name", "twitter:image", image),
    meta("name", "twitter:image:alt", SHARE_IMAGE.alt),
  );

  const ld = (data: object): HeadEntry => ({
    tag: "script",
    attrs: { type: "application/ld+json" },
    content: scriptJson(data),
  });
  if (id === "") {
    head.push(
      ld(
        softwareApplication({
          description: inlineHtml(readmeLead()).replace(/<[^>]+>/g, ""),
          version: VERSION,
          url: home,
          repository: REPO_URL,
          image,
        }),
      ),
    );
  } else if (!unlisted.has(id)) {
    const crumbs = breadcrumbs(
      route.sidebar as SidebarEntry[],
      { name: "Sluiceway docs", url: home },
      { name: entry.data.title, url: pageUrl },
      absolute,
    );
    head.push(ld(breadcrumbList(crumbs)));
  }
});
