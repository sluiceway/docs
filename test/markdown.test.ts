import { expect, test } from "bun:test";
import { blocks, scanHeadings, section } from "../src/lib/markdown";

const md = [
  "# Title",
  "",
  "## One",
  "",
  "```yaml",
  "# not a heading",
  "```",
  "",
  "### One a",
  "",
  "## Two",
  "",
  "text",
].join("\n");

test("headings in code blocks are not headings", () => {
  expect(scanHeadings(md).map((h) => h.raw)).toEqual(["Title", "One", "One a", "Two"]);
});

test("a section runs to the next heading of its level", () => {
  const cut = section(md, "x.md", "One");
  expect(cut.markdown).toContain("### One a");
  expect(cut.markdown).not.toContain("## Two");
  expect([cut.first, cut.end]).toEqual([1, 3]);
});

test("a missing section names the file and the heading", () => {
  expect(() => section(md, "x.md", "Three")).toThrow(/## Three" of x.md/);
});

test("blocks split at blank lines outside code", () => {
  expect(blocks("a\nb\n\n```\n\n```\n\nc")).toEqual(["a\nb", "```\n\n```", "c"]);
});
