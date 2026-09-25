// What it looks like: the walk-through under the example dashboard names the boxes the
// dashboard draws in the order the dashboard draws them, and the start page names the release
// these docs describe. Run after `bun run build`, as `bun run check` does.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { TAG } from "../src/lib/source";

const page = readFileSync("dist/what-it-looks-like/index.html", "utf8");
const parts = page.slice(page.indexOf('id="read-the-dashboard-from-the-top"'));
const dashboard = page.slice(
  page.indexOf('<figure class="sw-issue'),
  page.indexOf('id="read-the-dashboard-from-the-top"'),
);
const walk = parts.slice(0, parts.indexOf("</ul>"));

/**
 * Where the walk-through last quotes `text` as code, or -1. The last quote is the item about
 * that row: the destroy alert names a stack before its row does. Starlight adds `dir` to <code>.
 */
function quoted(text: string): number {
  const code = new RegExp(`<code[^>]*>${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</code>`, "g");
  return [...walk.matchAll(code)].at(-1)?.index ?? -1;
}

// Each box of the example dashboard is named by the words its row starts with.
const boxes = [...dashboard.matchAll(/<input aria-label="([^"]+)"/g)].map((m) => m[1] ?? "");

describe("the walk-through", () => {
  test("names each bulk box the example dashboard draws, as the dashboard words it", () => {
    const bulk = boxes.filter((name) => /^(Deploy|Repair) all \d+ /.test(name));
    expect(bulk.length).toBeGreaterThan(0);
    for (const name of bulk) expect(quoted(name)).toBeGreaterThan(-1);
    expect(walk).toContain("confirm box");
  });

  test("names the boxes it quotes in the dashboard's order", () => {
    const at = boxes.map(quoted).filter((i) => i > -1);
    expect(at.length).toBeGreaterThan(2);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  test("says how a deploy on merge reads on a row and in the trail, linked to the glossary", () => {
    expect(parts).toMatch(/<code[^>]*>deploying on merge · merged by<\/code>/);
    expect(parts).toMatch(/<code[^>]*>merged by<\/code>/);
    expect(parts).toContain("reference/glossary/#deploy-on-merge");
  });

  test("covers the line of an update waiting on its checks, linked to the glossary", () => {
    expect(parts).toMatch(/<code[^>]*>waits on its checks<\/code>/);
    expect(parts).toContain("reference/glossary/#update-waiting-on-its-checks");
  });

  test("names the lines the example does not draw, linked to the glossary", () => {
    for (const term of ["scan-running-line", "cost-line", "policy"]) {
      expect(walk).toContain(`reference/glossary/#${term}"`);
    }
  });
});

describe("the start page", () => {
  test("names the release these docs describe and links the changelog", () => {
    const start = readFileSync("dist/index.html", "utf8");
    const line = /<p class="sw-hero__small[^"]*" data-docs-release>([\s\S]*?)<\/p>/.exec(
      start,
    )?.[1];
    expect(line).toContain(`These docs describe Sluiceway ${TAG}`);
    expect(line).toMatch(/<a href="[^"]*\/changelog\/"[^>]*>Changelog<\/a>/);
  });
});
