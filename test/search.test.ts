// Search answers with the guides. Most pages of the site are decision records, and they use the
// product's words more often than the guides do, so they filled the first results for "tick",
// "drift" or "destroy". They are left out of the index (src/lib/site.ts), and these are the
// queries of the 2026-10-01 review, asked of dist/pagefind the way the search dialog asks them.
//
// Run after `bun run build`, as `bun run check` does.

import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { outOfSearch } from "../src/lib/site";

const INDEX = resolve("dist/pagefind");

if (!existsSync(`${INDEX}/pagefind.js`)) {
  throw new Error("dist/ has no search index. Run `bun run build` before `bun test`.");
}

interface Result {
  /** The page id, such as `guides/configuration`. */
  id: string;
  title: string;
}

interface Pagefind {
  options(options: { basePath: string; baseUrl: string }): Promise<void>;
  init(): Promise<void>;
  search(query: string): Promise<{
    results: { data(): Promise<{ url: string; meta: { title?: string } }> }[];
  }>;
}

let pagefind: Pagefind;

beforeAll(async () => {
  // Pagefind's own client, the file the dialog loads, reading the index from disk. With the
  // site at "/", a result's URL is its page id between slashes, whatever DOCS_BASE the build had.
  pagefind = await import(pathToFileURL(`${INDEX}/pagefind.js`).href);
  await pagefind.options({ basePath: pathToFileURL(`${INDEX}/`).href, baseUrl: "/" });
  await pagefind.init();
});

async function search(query: string, count = 10): Promise<Result[]> {
  const found = await pagefind.search(query);
  const data = await Promise.all(found.results.slice(0, count).map((result) => result.data()));
  return data.map(({ url, meta }) => ({
    id: url.replace(/^\/|\/$/g, ""),
    title: meta.title ?? "",
  }));
}

// What a new user types, and the pages that answer it. One of them is in the first five.
// "cli" is not here: the Command line page never says the word, which is the action's to fix.
const QUERIES: [query: string, answers: string[]][] = [
  ["tick", ["using-the-dashboard", "hosted-app/using-the-app"]],
  ["drift", ["guides/configuration", "using-the-dashboard", "reference/sluiceway-yaml"]],
  ["tickers", ["reference/sluiceway-yaml", "guides/configuration", "guides/security"]],
  ["destroy", ["using-the-dashboard", "reference/sluiceway-yaml", "reference/glossary"]],
  ["preview failed", ["using-the-dashboard"]],
  ["permissions", ["guides/workflow", "hosted-app/install", "guides/security"]],
  ["credentials", ["guides/credentials"]],
  ["on-merge", ["guides/configuration", "using-the-dashboard", "guides/security"]],
  ["token", ["hosted-app/command-line", "guides/credentials", "guides/security"]],
  ["command line", ["hosted-app/command-line"]],
  ["install", ["hosted-app/install", "get-started"]],
];

describe("search", () => {
  for (const [query, answers] of QUERIES) {
    test(`"${query}" answers with a guide, not a decision record`, async () => {
      const results = (await search(query)).map((result) => result.id);
      expect(results.length).toBeGreaterThan(0);
      expect(results.filter(outOfSearch)).toEqual([]);
      expect(results.slice(0, 5).some((id) => answers.includes(id))).toBe(true);
    });
  }

  test("a record's own title does not bring the record up", async () => {
    const results = await search("every tick keeps its own event", 40);
    expect(results.filter((result) => outOfSearch(result.id))).toEqual([]);
  });

  test("the list of records is found by what it is and by a record's number", async () => {
    for (const query of ["decision records", "0005"]) {
      const [first] = await search(query, 1);
      expect(first?.id).toBe("why");
    }
  });
});

describe("a decision record", () => {
  const record = readdirSync("dist/why").find((name) => name.startsWith("0005-")) ?? "";
  const html = readFileSync(`dist/why/${record}/index.html`, "utf8");

  test("is out of the site's search and still open to search engines", () => {
    expect(outOfSearch(`why/${record}`)).toBe(true);
    expect(html).not.toContain("data-pagefind-body");
    expect(html).not.toMatch(/<meta name="robots"[^>]*noindex/);
    const sitemap = readFileSync("dist/sitemap-0.xml", "utf8");
    expect(sitemap).toContain(`/why/${record}/`);
  });

  test("the list of records and the changelog stay in the index", () => {
    expect(outOfSearch("why")).toBe(false);
    expect(outOfSearch("changelog")).toBe(false);
    expect(readFileSync("dist/why/index.html", "utf8")).toContain("data-pagefind-body");
  });
});
