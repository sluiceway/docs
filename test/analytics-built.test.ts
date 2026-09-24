// Checks that the built site in dist/ carries analytics when it should, and nothing when it
// should not. The website id and the script URL sit in a chunk the page scripts import, not in
// the page HTML, so this starts from a page's HTML and follows every `<script src>` and every
// import inside those files, as a browser would. A build that lost analytics without a word
// fails here, on every pull request.
//
// It reads the same environment as the build (DOCS_SITE, DOCS_BASE, PUBLIC_UMAMI_WEBSITE_ID,
// ANALYTICS_OFF), so run it after `bun run build` with the same environment. A build made with
// ANALYTICS_OFF=1 is checked with ANALYTICS_OFF=1.

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OLD_CONSENT_KEY } from "../src/lib/analytics";
import {
  DEFAULT_UMAMI_WEBSITE_ID,
  UMAMI_SCRIPT_URL,
  umamiWebsiteId,
} from "../src/lib/analytics-build";

const DIST = "dist";
// The same defaults as astro.config.ts.
const SITE = process.env.DOCS_SITE || "https://sluiceway.github.io";
const BASE = (process.env.DOCS_BASE ?? "/docs").replace(/\/+$/, "");
const ORIGIN = new URL(SITE).origin;

/** What the build was meant to carry: the website id, or "" with analytics off. */
const WEBSITE_ID = umamiWebsiteId(process.env);
const ON = WEBSITE_ID !== "";

/** The start page, docs pages, the privacy page and the 404 page. */
const PAGES = [
  "index.html",
  "get-started/index.html",
  "guides/workflow/index.html",
  "reference/sluiceway-yaml/index.html",
  "privacy/index.html",
  "404.html",
];

if (!existsSync(join(DIST, "index.html"))) {
  throw new Error("dist/ has no build. Run `bun run build` before `bun test`.");
}

interface Graph {
  html: string;
  /** Every script the page runs: inline module scripts, then each file it reaches. */
  scripts: { name: string; text: string }[];
  /** Scripts the page loads or imports that are not in dist/. */
  missing: string[];
}

/** The file in dist/ that serves a URL on the site, or undefined for another host. */
function fileOf(url: URL): string | undefined {
  if (url.origin !== ORIGIN) return undefined;
  if (!url.pathname.startsWith(`${BASE}/`)) return undefined;
  return join(DIST, decodeURIComponent(url.pathname.slice(BASE.length + 1)));
}

/**
 * The specifiers a script imports: static, bare side effect, re-export and dynamic. A path put
 * together at run time, such as Pagefind's `${base}pagefind.js`, cannot be followed and is left.
 */
function importsOf(code: string): string[] {
  const found = [
    ...code.matchAll(/\b(?:import|export)\b[^"'`;()]*?\bfrom\s*(["'`])([^"'`]+)\1/g),
    ...code.matchAll(/\bimport\s*(["'`])([^"'`]+)\1/g),
    ...code.matchAll(/\bimport\s*\(\s*(["'`])([^"'`]+)\1\s*\)/g),
  ];
  return found.map((m) => m[2] as string).filter((spec) => !spec.includes("${"));
}

function graphOf(page: string): Graph {
  const html = readFileSync(join(DIST, page), "utf8");
  const pageUrl = new URL(`${BASE}/${page.replace(/(^|\/)index\.html$/, "$1")}`, ORIGIN);
  const scripts: Graph["scripts"] = [];
  const seen = new Set<string>();
  const missing: string[] = [];
  const queue: URL[] = [];

  for (const tag of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = tag[1] ?? "";
    const src = attrs.match(/\bsrc=(["'])(.*?)\1/)?.[2];
    if (src) {
      queue.push(new URL(src.replace(/&amp;/g, "&"), pageUrl));
    } else if (!/type=(["'])application\/(ld\+)?json\1/.test(attrs)) {
      const text = tag[2] ?? "";
      scripts.push({ name: `${page} (inline)`, text });
      for (const spec of importsOf(text)) queue.push(new URL(spec, pageUrl));
    }
  }

  while (queue.length > 0) {
    const url = queue.shift() as URL;
    const file = fileOf(url);
    if (!file || seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) {
      missing.push(url.pathname);
      continue;
    }
    const text = readFileSync(file, "utf8");
    scripts.push({ name: file, text });
    for (const spec of importsOf(text)) queue.push(new URL(spec, url));
  }
  return { html, scripts, missing };
}

const graphs = new Map(PAGES.map((page) => [page, graphOf(page)]));
const allScripts = (graph: Graph) => graph.scripts.map((s) => s.text).join("\n");

describe(ON ? "analytics on" : "analytics off (ANALYTICS_OFF=1)", () => {
  for (const [page, graph] of graphs) {
    test(`${page} loads only scripts that are in dist/`, () => {
      expect(graph.missing).toEqual([]);
    });

    if (ON) {
      test(`${page} reaches the Umami script URL and the website id`, () => {
        const code = allScripts(graph);
        const hint =
          "the built site carries no analytics. If this build was meant to be without them, " +
          "run the tests with ANALYTICS_OFF=1 as well";
        expect(code.includes(UMAMI_SCRIPT_URL), `${page}: no script URL, ${hint}`).toBe(true);
        expect(code.includes(WEBSITE_ID), `${page}: no website id, ${hint}`).toBe(true);
      });

      test(`${page} checks Do Not Track before loading`, () => {
        expect(allScripts(graph)).toContain("doNotTrack");
      });

      test(`${page} carries the footer note`, () => {
        expect(graph.html).toContain("sw-analytics-note");
      });
    } else {
      test(`${page} reaches neither the Umami host nor a website id`, () => {
        const code = allScripts(graph);
        expect(code).not.toContain(new URL(UMAMI_SCRIPT_URL).host);
        expect(code).not.toContain(DEFAULT_UMAMI_WEBSITE_ID);
      });

      test(`${page} has no footer note`, () => {
        expect(graph.html).not.toContain("sw-analytics-note");
      });
    }
  }

  if (!ON) {
    test("no script anywhere in dist/ names the Umami host or the website id", () => {
      const dir = join(DIST, "_astro");
      for (const name of readdirSync(dir).filter((n) => n.endsWith(".js"))) {
        const text = readFileSync(join(dir, name), "utf8");
        expect(text, name).not.toContain(new URL(UMAMI_SCRIPT_URL).host);
        expect(text, name).not.toContain(DEFAULT_UMAMI_WEBSITE_ID);
      }
    });
  }
});

describe("no consent gate is left", () => {
  for (const [page, graph] of graphs) {
    test(`${page} has no consent bar or settings button`, () => {
      for (const mark of ["sw-consent", "data-sw-consent", "Analytics settings", OLD_CONSENT_KEY]) {
        expect(graph.html, `${page} holds "${mark}"`).not.toContain(mark);
      }
    });

    test(`${page} only ever removes the old consent key, and reads no choice`, () => {
      for (const { name, text } of graph.scripts) {
        // Nothing but the old key's own name mentions consent.
        const mentions = text.match(/consent/gi) ?? [];
        const keys = text.split(OLD_CONSENT_KEY).length - 1;
        expect(mentions.length, `${name} mentions consent beyond the old key`).toBe(keys);
        if (keys === 0) continue;
        // The script that holds the key removes it, and reads nothing from storage.
        expect(text, `${name} holds the old key but never removes it`).toContain("removeItem(");
        expect(text, `${name} holds the old key and reads storage`).not.toMatch(
          /getItem\s*\(|localStorage\s*\[|localStorage\.(?!removeItem)/,
        );
      }
    });
  }
});
