// Run the action yourself: the workflow file first, then the README's steps as numbered
// headings, so a reader sees what they will add, how many steps there are, and can come back
// to one. The README writes them as paragraphs that open on a bold sentence.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { selfRunSteps } from "../src/lib/pages";

const README = [
  "**Check your setup.** Run the check. It needs nothing.",
  "",
  "**Before the first scan.** Two red rows are the ones new users met first.",
  "",
  "**Decide who may deploy.** A tick asks for a deploy.",
  "",
  "**Add the workflow.** This is the whole loop. Merge it once the steps above are in place.",
  "",
  "```yaml",
  "name: deploy-dashboard",
  "```",
].join("\n");

describe("selfRunSteps", () => {
  const steps = selfRunSteps(README);

  test("takes the workflow out of the last step", () => {
    expect(steps.workflow).toBe("```yaml\nname: deploy-dashboard\n```");
  });

  test("numbers the steps, and keeps each one's words", () => {
    expect(steps.steps).toEqual([
      "### 1. Check your setup\n\nRun the check. It needs nothing.",
      "### 2. Decide who may deploy\n\nA tick asks for a deploy.",
      "### 3. Add the workflow\n\nThis is the whole loop. Merge it once the steps above are in place.",
    ]);
  });

  test("hands back what goes wrong on a first scan apart, without a number", () => {
    expect(steps.after).toBe(
      "### When the first scan is red\n\nTwo red rows are the ones new users met first.",
    );
  });

  test("stops when the README no longer has the shape it reads", () => {
    expect(() => selfRunSteps("**Check your setup.** Run the check.")).toThrow("workflow");
    expect(() => selfRunSteps(`A paragraph with no step.\n\n${README}`)).toThrow("bold");
    expect(() => selfRunSteps(README.replace("Before the first scan", "Before you scan"))).toThrow(
      "Before the first scan",
    );
  });
});

describe("the built page", () => {
  const html = readFileSync("dist/get-started/run-the-action-yourself/index.html", "utf8");
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  const at = (id: string) => main.indexOf(` id="${id}"`);

  test("shows the workflow file before Requirements and the steps", () => {
    const file = main.indexOf("sluiceway/sluiceway@v0", at("the-workflow-file"));
    expect(at("the-workflow-file")).toBeGreaterThan(-1);
    expect(file).toBeGreaterThan(at("the-workflow-file"));
    expect(file).toBeLessThan(at("requirements"));
    expect(at("requirements")).toBeLessThan(at("get-started"));
    // Once: the steps point at it and do not print it again.
    expect(main.match(/<pre/g)?.length).toBe(1);
  });

  test("has the steps as numbered headings, in order, and the red scan after them", () => {
    const order = [
      "get-started",
      "1-check-your-setup",
      "2-decide-who-may-deploy",
      "3-load-your-credentials",
      "4-add-the-workflow",
      "when-the-first-scan-is-red",
    ].map(at);
    expect(order.every((index) => index > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("lists each step in On this page", () => {
    for (const id of ["the-workflow-file", "1-check-your-setup", "4-add-the-workflow"]) {
      expect(html).toContain(`href="#${id}"`);
    }
  });
});
