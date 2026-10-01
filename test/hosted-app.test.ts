// The Hosted app pages say what the app does. They are written here by hand, so nothing but
// these tests holds them to the app: each one is a sentence the 2026-10-01 review found wrong
// against the app's source and the console, and the words the console shows in its place.
//
// Run after `bun run build`, as `bun run check` does.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  "#39": "'",
  "#x27": "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

/** The words of a built page's <main>, as a reader sees them, on one line. */
function words(id: string): string {
  const html = readFileSync(`dist/${id}/index.html`, "utf8");
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  return main
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|quot|#39|#x27|lt|gt|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ");
}

/** The words of one section, from its heading's id to the next heading of that level. */
function section(id: string, anchor: string): string {
  const html = readFileSync(`dist/${id}/index.html`, "utf8");
  const start = html.indexOf(` id="${anchor}"`);
  if (start < 0) throw new Error(`The page ${id} has no heading with the id "${anchor}".`);
  const level = html.slice(html.lastIndexOf("<h", start), start).slice(2, 3);
  const next = html.slice(start).search(new RegExp(`<h[1-${level}][\\s>]`));
  return html
    .slice(start, next < 0 ? html.indexOf("</main>") : start + next)
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|quot|#39|#x27|lt|gt|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ");
}

const using = words("hosted-app/using-the-app");
const plans = words("hosted-app/plans");
const keeps = words("hosted-app/what-the-app-keeps");
const install = words("hosted-app/install");
const getStarted = words("get-started");

describe("what the app keeps, and for how long (H1)", () => {
  test('no page says "nothing is deleted"', () => {
    for (const page of [using, plans, keeps, install, getStarted]) {
      expect(page).not.toMatch(/nothing is deleted/i);
    }
  });

  test("Plans says history past the plan is deleted each night", () => {
    const history = section("hosted-app/plans", "history");
    expect(history).toContain("deleted");
    expect(history).toContain("each night");
    expect(history).not.toContain("shown again");
  });

  test("Plans says a plan that ends keeps its wider history for 30 days", () => {
    const cancel = section("hosted-app/plans", "change-or-cancel");
    expect(cancel).toContain("30 days");
    expect(cancel).toContain("deleted");
  });

  test("What the app keeps has the three windows, the 30 days and Delete everything", () => {
    const howLong = section("hosted-app/what-the-app-keeps", "how-long-it-keeps-it");
    for (const said of ["30 days", "13 months", "3 years", "each night"]) {
      expect(howLong).toContain(said);
    }
    expect(keeps).not.toContain("keeps its lines in the audit log");
    const stop = section("hosted-app/what-the-app-keeps", "if-you-stop-using-the-app");
    expect(stop).toContain("30 days");
    expect(stop).toContain("Delete everything");
  });

  test("the pages link the published terms and privacy policy", () => {
    const html = readFileSync("dist/hosted-app/what-the-app-keeps/index.html", "utf8");
    expect(html).toContain('href="https://sluiceway.dev/terms"');
    expect(html).toContain('href="https://sluiceway.dev/privacy"');
  });
});

describe("Using the app says what the console shows (H3)", () => {
  // The review's number, what the page said, and what the console says.
  const gone: [finding: string, said: string][] = [
    ["A6", "eight hours"],
    ["A6", "at your next sign-in"],
    ["A7", "the commit and the run"],
    ["A8", "at the version these docs describe"],
    ["A9", "in any other repo they open the dashboard on GitHub"],
    ["A10", "cover the last 12 weeks"],
    ["A11", "end with one row per repo"],
    ["A12", "flagged in red"],
    ["A13", "by stack or to the flagged"],
    ["A14", "Each filter is a plain link"],
    ["A17", "rows redacted"],
    ["A18", "Save opens"],
    ["A19", "Access per repo"],
  ];
  for (const [finding, said] of gone) {
    test(`${finding}: no longer says "${said}"`, () => {
      expect(using).not.toContain(said);
    });
  }

  const shown: [finding: string, label: string][] = [
    ["A6", "30 days"],
    ["A6", "every hour"],
    ["A9", "Rescan on GitHub"],
    ["A10", "6 months"],
    ["A12", "⚠"],
    ["A15", "Download CSV"],
    ["A16", "Row detail"],
    ["A18", "Review pull request"],
    ["A18", "Open the pull request"],
    ["A19", "The app's access"],
  ];
  for (const [finding, label] of shown) {
    test(`${finding}: says "${label}"`, () => {
      expect(using).toContain(label);
    });
  }

  test("A17: Minimal is not said to redact, and is said to leave In sync off", () => {
    const templates = section("hosted-app/using-the-app", "templates");
    const minimal = templates.slice(templates.indexOf("Minimal"), templates.indexOf("Classic"));
    expect(minimal).not.toMatch(/redact/i);
    expect(minimal).toContain("In sync");
    // Someone who wants names off the issue is told which key does that.
    expect(templates).toContain("redact");
  });

  test("the address the console links for a tick keeps its heading", () => {
    const html = readFileSync("dist/hosted-app/using-the-app/index.html", "utf8");
    expect(html).toContain(' id="tick-from-the-app"');
  });
});

describe("Plans and Get started (M11)", () => {
  test("A20: Insights are not said to cover 12 weeks on every plan", () => {
    const history = section("hosted-app/plans", "history");
    expect(history).not.toContain("on every plan");
    expect(history).toContain("6 months");
  });

  test("A21: a promotion code is for the monthly price", () => {
    const upgrade = section("hosted-app/plans", "upgrade");
    expect(upgrade).toMatch(/promotion code[^.]*monthly/i);
  });

  test("A22: a repo past the plan has a page", () => {
    expect(plans).not.toContain("are not shown, so Rescan");
    expect(plans).toContain("Choose the active repos");
  });

  test("A23: a tick in the console holds five seconds for Undo", () => {
    const tick = section("get-started", "tick");
    expect(tick).toContain("five seconds");
    expect(tick).toContain("Undo");
  });
});

describe("the permissions table (H2)", () => {
  test("says it is being corrected, and what follows", () => {
    const accept = section("hosted-app/install", "what-github-asks-you-to-accept");
    expect(accept).toContain("being corrected");
    for (const permission of ["Workflows", "Checks", "Members"]) {
      expect(accept).toContain(permission);
    }
  });
});
