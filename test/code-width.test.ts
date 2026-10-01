// Prose keeps its measure and code runs wider. One width for the whole column cut 96 of 217
// code blocks off on a desktop screen (the 2026-10-01 review, H4): a line of code holds about
// 60 characters in 54ch, and the workflow's own comments are longer.
//
// A browser is what measures this for real. This holds the two numbers and the rule that
// keeps them apart, in the stylesheet the build ships.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

const theme = readFileSync("src/styles/theme.css", "utf8");

function custom(name: string): string {
  return theme.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1] ?? "";
}

describe("the column", () => {
  test("prose keeps the measure of about 72 characters", () => {
    expect(custom("--sw-measure")).toBe("54ch");
  });

  test("the column itself is wide enough for 80 characters of code", () => {
    expect(Number.parseFloat(custom("--sl-content-width"))).toBeGreaterThanOrEqual(80);
    expect(custom("--sl-content-width")).toEndWith("ch");
  });

  test("the built stylesheet narrows everything but code and tables to the measure", () => {
    const css = readdirSync("dist/_astro")
      .filter((name) => name.endsWith(".css"))
      .map((name) => readFileSync(`dist/_astro/${name}`, "utf8"))
      .join("\n");
    const rule = css.match(/[^{}]*\{[^{}]*max-width:\s*var\(--sw-measure\)[^{}]*\}/)?.[0] ?? "";
    expect(rule).toContain(".sl-markdown-content");
    expect(rule).toContain(".expressive-code");
    expect(rule).toContain("table");
  });
});
