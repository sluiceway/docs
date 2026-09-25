// The redirect of old fragments: every target lands on a page and heading the built site has,
// no old fragment is still an id of its page (the script would never run), and the pages carry
// the map. Reads dist/ with the same DOCS_BASE as the build, like built-site.test.ts.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ANCHOR_REDIRECTS, PAGE_REDIRECTS, redirectFor } from "../src/lib/anchor-redirects";
import { urlFor } from "../src/lib/pages";

const DIST = "dist";
const BASE = (process.env.DOCS_BASE ?? "/docs").replace(/\/+$/, "");
const url = urlFor(BASE);

function html(id: string): string {
  const file = join(DIST, id, "index.html");
  if (!existsSync(file)) throw new Error(`${file} is not built. Run \`bun run build\` first.`);
  return readFileSync(file, "utf8");
}

function ids(page: string): Set<string> {
  return new Set([...html(page).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] ?? ""));
}

describe("the map", () => {
  for (const [page, moved] of Object.entries(ANCHOR_REDIRECTS)) {
    const own = ids(page);
    for (const [from, to] of Object.entries(moved)) {
      test(`${page}/#${from} goes to ${to}`, () => {
        expect(own.has(from), `${page} has #${from} again: take it out of the map`).toBe(false);
        const [target = "", fragment] = to.split("#");
        // A heading renamed on its own page lands on the new heading, never on the page top.
        if (target === page) expect(fragment, `${to} needs a fragment`).toBeDefined();
        const there = target === page ? own : ids(target);
        if (fragment) expect(there.has(fragment), `${target} has no #${fragment}`).toBe(true);
      });
    }

    test(`${page} carries the map with the site's URLs`, () => {
      const json =
        /<script type="application\/json" id="sw-anchor-redirects">([^<]*)<\/script>/.exec(
          html(page),
        )?.[1];
      expect(json).toBeDefined();
      expect(JSON.parse(json ?? "{}")).toEqual(
        Object.fromEntries(Object.entries(moved).map(([from, to]) => [from, url(to)])),
      );
    });
  }

  test("a page without moved headings has no map", () => {
    expect(html("guides/workflow")).not.toContain("sw-anchor-redirects");
  });
});

describe("the moved pages", () => {
  for (const [from, to] of Object.entries(PAGE_REDIRECTS)) {
    test(`${from} sends the visitor to ${to}`, () => {
      // The new page is a real page, and the old URL is only a redirect to it, with the base.
      expect(html(to)).toContain("<main");
      const old = html(from);
      expect(old).toContain(`http-equiv="refresh" content="0;url=${url(to)}"`);
      expect(old).not.toContain("<main");
    });
  }
});

describe("redirectFor", () => {
  const map = { setup: "/guides/workflow/", "1-check-your-setup": "/guides/workflow/#check" };
  const none = () => false;

  test("an old fragment goes to its new place", () => {
    expect(redirectFor("#setup", map, none)).toBe("/guides/workflow/");
    expect(redirectFor("#1-check-your-setup", map, none)).toBe("/guides/workflow/#check");
  });

  test("an encoded fragment is decoded first", () => {
    expect(redirectFor("#%31-check-your-setup", map, none)).toBe("/guides/workflow/#check");
  });

  test("no fragment, an unknown one, a broken one or an inherited key stays", () => {
    expect(redirectFor("", map, none)).toBeUndefined();
    expect(redirectFor("#requirements", map, none)).toBeUndefined();
    expect(redirectFor("#%E0%A4%A", map, none)).toBeUndefined();
    expect(redirectFor("#toString", map, none)).toBeUndefined();
  });

  test("a fragment the page has again stays", () => {
    expect(redirectFor("#setup", map, (id) => id === "setup")).toBeUndefined();
  });
});
