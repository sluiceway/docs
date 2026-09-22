// The docs collection: Starlight's own pages from src/content/docs, and the pages read from
// the action at the pinned tag (src/lib/pages.ts). The action's Markdown is rendered here with
// the site's Markdown pipeline, so its alerts become Callouts and its code blocks look like
// every other code block, and nothing of it is copied into this repository.
//
// Every heading keeps the id GitHub gives it in the whole file, so a link written for GitHub
// lands here too. Anything that no longer matches the pinned tag (a missing file, section or
// heading, a slug that differs from GitHub's, a key the reference lost) stops the build.

import { docsLoader } from "@astrojs/starlight/loaders";
import type { Loader, LoaderContext } from "astro/loaders";
import { shiftHeadings } from "../lib/headings";
import { linkRecords, rewriteLinks, type SiteMap } from "../lib/links";
import { plainHeading } from "../lib/markdown";
import {
  githubSlug,
  githubSlugs,
  type Page,
  type Part,
  pages,
  README_UNMAPPED,
  recordId,
  records,
  siteMap,
  source,
  urlFor,
} from "../lib/pages";
import { actionNames, schemaKeys } from "../lib/reference";
import { REPO_URL } from "../lib/source";

interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export function actionDocsLoader(): Loader {
  const docs = docsLoader();
  return {
    name: "sluiceway-action-docs",
    async load(ctx) {
      await docs.load(ctx);
      const base = ctx.config.base.replace(/\/$/, "");
      const url = urlFor(base);

      const all = pages(REPO_URL, base);
      warnUnmappedReadme(ctx, all);
      const site = await checkedSiteMap(ctx, all, url);
      const recordUrls = new Map(records().map((r) => [r.number, url(recordId(r))]));

      for (const page of all) {
        const { html, headings } = await renderPage(ctx, page, site, recordUrls);
        checkReference(page, html);
        const data = await ctx.parseData({
          id: page.id,
          data: {
            title: page.title,
            description: page.description,
            source: page.source,
            ...(page.sidebarLabel ? { sidebar: { label: page.sidebarLabel } } : {}),
            ...(page.headerPicture ? { headerPicture: page.headerPicture } : {}),
            ...(page.eyebrow ? { eyebrow: page.eyebrow } : {}),
          },
        });
        const body = page.parts.map((p) => p.markdown).join("\n\n");
        ctx.store.set({
          id: page.id,
          data,
          body,
          filePath: `vendor/sluiceway/${page.source}`,
          digest: ctx.generateDigest(html),
          rendered: {
            html,
            metadata: { headings, frontmatter: data, imagePaths: [] },
          },
        });
      }
    },
  };
}

/** A README h2 that no page shows and no entry of README_UNMAPPED explains. */
function warnUnmappedReadme(ctx: LoaderContext, all: Page[]): void {
  const shown = new Set(
    all.flatMap((page) =>
      page.parts
        .filter((part) => part.from === "README.md")
        .flatMap((part) => [
          ...part.headings,
          ...(part.dropped === undefined ? [] : [part.dropped]),
        ]),
    ),
  );
  source("README.md").headings.forEach((h, i) => {
    const title = plainHeading(h.raw);
    if (h.depth === 2 && !shown.has(i) && !(title in README_UNMAPPED)) {
      ctx.logger.warn(
        `README section "## ${title}" is on no page of the docs. Add it to a page in src/lib/pages.ts, or to README_UNMAPPED with the reason.`,
      );
    }
  });
}

/**
 * Checks that the heading ids computed in src/lib/pages.ts are the ones the renderer gives, by
 * rendering each file whole once, then maps where every heading and file of the action lands.
 */
async function checkedSiteMap(
  ctx: LoaderContext,
  all: Page[],
  url: (id: string) => string,
): Promise<SiteMap> {
  const files = new Set(
    all.flatMap((page) => page.parts.filter((p) => p.headings.length > 0).map((p) => p.from)),
  );
  for (const path of files) {
    const slugs = githubSlugs(path);
    const rendered = await ctx.renderMarkdown(guard(source(path).markdown));
    const actual = rendered.metadata?.headings?.map((h) => h.slug) ?? [];
    if (actual.join("\n") !== slugs.join("\n")) {
      const at = slugs.findIndex((slug, i) => slug !== actual[i]);
      throw new Error(
        `The heading ids of ${path} do not match: heading ${at + 1} is "${slugs[at]}" here and ` +
          `"${actual[at]}" in the renderer. src/lib/markdown.ts reads its headings differently.`,
      );
    }
  }
  return siteMap(all, url);
}

/** Markdown that starts with a thematic break would be read as frontmatter. */
function guard(markdown: string): string {
  return markdown.startsWith("---") ? `\n${markdown}` : markdown;
}

async function renderPage(
  ctx: LoaderContext,
  page: Page,
  site: SiteMap,
  recordUrls: Map<string, string>,
): Promise<{ html: string; headings: Heading[] }> {
  const headings: Heading[] = [];
  const html: string[] = [];
  const self = page.id.startsWith("why/") ? page.id.slice(4, 8) : undefined;

  for (const part of page.parts) {
    const rendered = await ctx.renderMarkdown(guard(part.markdown));
    const got = rendered.metadata?.headings ?? [];
    const ids = headingIds(page, part, got);
    let at = 0;
    let out = rendered.html.replace(/<h([1-6])([^>]*?)\sid="[^"]*"/g, (_, level, attrs) => {
      const id = ids[at++] ?? "";
      return `<h${level}${attrs} id="${id}"`;
    });
    got.forEach((h, i) => {
      headings.push({ depth: h.depth, slug: ids[i] ?? h.slug, text: h.text });
    });
    out = rewriteLinks(out, part.from, site, (message) => ctx.logger.warn(message));
    out = linkRecords(out, {
      urls: recordUrls,
      recordsContext: page.recordsContext ?? false,
      self,
    });
    html.push(out);
  }

  const shifted = shiftHeadings(wrapLongCode(html.join("\n")));
  if (shifted.levels.length !== headings.length) {
    throw new Error(
      `The page ${page.id} has ${shifted.levels.length} headings in its HTML and ` +
        `${headings.length} in the renderer's list. A heading in raw HTML is not supported.`,
    );
  }
  headings.forEach((h, i) => {
    h.depth = shifted.levels[i] ?? h.depth;
  });
  let joined = shifted.html;
  if (page.termAnchors) joined = termAnchors(joined, headings);

  const seen = new Set<string>();
  for (const h of headings) {
    if (seen.has(h.slug)) {
      throw new Error(`The page ${page.id} has two headings with the id "${h.slug}".`);
    }
    seen.add(h.slug);
  }
  return { html: joined, headings };
}

/**
 * Inline code stays on one line, so a stack id never breaks. The action's pages also quote
 * whole messages as code, which would push the page sideways on a phone: those may wrap.
 */
function wrapLongCode(html: string): string {
  return html.replace(/<code>([^<]{33,})<\/code>/g, '<code class="sw-code-long">$1</code>');
}

/** The ids a part's headings take: GitHub's ids in the whole file, or the renderer's own. */
function headingIds(page: Page, part: Part, got: { depth: number; slug: string }[]): string[] {
  if (part.headings.length === 0) return got.map((h) => h.slug);
  const slugs = githubSlugs(part.from);
  const want = part.headings.map((i) => source(part.from).headings[i]);
  const same = got.length === want.length && got.every((h, i) => h.depth === want[i]?.depth);
  if (!same) {
    throw new Error(
      `The page ${page.id} expected ${want.length} headings from ${part.from} and the renderer ` +
        `found ${got.length}. A heading in raw HTML or inside a quote is not supported.`,
    );
  }
  return part.headings.map((i) => slugs[i] ?? "");
}

/**
 * An id on every `**Term**:` paragraph of the glossary, so other pages can link a term. A
 * term named like a heading (Personality) takes `-term` after its id: the heading keeps the
 * id GitHub gives it.
 */
function termAnchors(html: string, headings: Heading[]): string {
  const taken = new Set(headings.map((h) => h.slug));
  return html.replace(/<p><strong>([^<]+)<\/strong>:/g, (match, term: string) => {
    let id = githubSlug(term);
    if (taken.has(id)) id = `${id}-term`;
    if (taken.has(id)) throw new Error(`The glossary has two terms with the id "${id}".`);
    taken.add(id);
    return match.replace("<p>", `<p id="${id}" class="sw-term">`);
  });
}

/** The generated references hold every key and input they are generated from. */
function checkReference(page: Page, html: string): void {
  const missing = (ids: string[]) => ids.filter((id) => !html.includes(` id="${id}"`));
  let lost: string[] = [];
  if (page.id === "reference/sluiceway-yaml") {
    const schema = JSON.parse(readJson("schema/sluiceway.schema.json"));
    lost = missing(schemaKeys(schema).map((k) => githubSlug(k.path)));
  }
  if (page.id === "reference/action") {
    const { inputs, outputs } = actionNames(readJson("action.yml"));
    lost = missing([...inputs, ...outputs].map(githubSlug));
  }
  if (lost.length > 0) {
    throw new Error(`The page ${page.id} has no section for: ${lost.join(", ")}.`);
  }
}

function readJson(path: string): string {
  return source(path).markdown;
}
