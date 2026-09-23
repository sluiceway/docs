// Text the docs landing and the header page take from the action at the pinned tag. Each
// reader fails the build when the text it expects is not where it was, so a new release that
// moves a section stops the build instead of showing a stale or empty block.

import { readFileSync } from "node:fs";
import { markdownToHtml } from "satteri";
import { HEADER_STATES } from "../../vendor/sluiceway/src/render/dashboard-facts";
import { WARM } from "../../vendor/sluiceway/src/render/voice";
import { sourceUrl, vendorPath } from "./source";

function read(path: string): string {
  return readFileSync(vendorPath(path), "utf8");
}

function fail(path: string, what: string): never {
  throw new Error(`vendor/sluiceway/${path}: ${what} was not found at the pinned tag.`);
}

/** One line of the action's Markdown as inline HTML, without the paragraph around it. */
export function inlineHtml(markdown: string): string {
  return markdownToHtml(markdown)
    .html.trim()
    .replace(/^<p>([\s\S]*)<\/p>$/, "$1");
}

/**
 * The good-news line, as `src/render/voice.ts` has it. It has three, one per day of the scan;
 * this is the one a scan without a day gets, the first.
 */
export function goodNewsLine(): string {
  const line = WARM.goodNews(0, undefined);
  if (typeof line !== "string" || line.trim() === "") {
    fail("src/render/voice.ts", "the good-news line (`WARM.goodNews`)");
  }
  return line;
}

/** The README's lead: the first paragraph after the header picture, and any comment above it. */
export function readmeLead(): string {
  const readme = read("README.md");
  const lead = readme
    .replace(/^\s*<!--[\s\S]*?-->\s*/, "")
    .replace(/^<p[\s\S]*?<\/p>\s*/, "")
    .split(/\n\s*\n/)[0]
    ?.trim();
  if (!lead || lead.startsWith("<") || lead.startsWith("#") || lead.startsWith(">")) {
    fail("README.md", "the lead sentence under the header picture");
  }
  return lead;
}

/** The paragraph above the README's example dashboard, under "What it looks like": its first sentence and the rest. */
export function readmeDashboardIntro(): { lead: string; rest: string } {
  const section = readmeSection("What it looks like");
  const intro = section.split(/\n\s*\n/)[0]?.trim();
  if (!intro || intro.startsWith("<")) fail("README.md", 'the sentence under "What it looks like"');
  // The first sentence is the page's lead. What follows can link a file of the action by a
  // path relative to the README, which on this site goes to that file on GitHub at the tag.
  const cut = intro.search(/\.\s+(?=[A-Z])/);
  const lead = cut === -1 ? intro : intro.slice(0, cut + 1);
  const rest = (cut === -1 ? "" : intro.slice(cut + 1).trim()).replace(
    /\]\((?!https?:|#)([^)]+)\)/g,
    (_, path: string) => `](${sourceUrl(path)})`,
  );
  return { lead, rest };
}

function readmeSection(heading: string): string {
  const readme = read("README.md");
  const start = readme.indexOf(`\n## ${heading}\n`);
  if (start === -1) fail("README.md", `the section "## ${heading}"`);
  const body = readme.slice(start + heading.length + 5);
  const end = body.search(/\n## /);
  return (end === -1 ? body : body.slice(0, end)).trim();
}

export interface Step {
  /** The step's first sentence, as inline HTML. */
  title: string;
  /** The rest of the step, as inline HTML, or empty. */
  body: string;
}

/** The numbered list of the README's "How it works", split into a title and a body each. */
export function howItWorks(): Step[] {
  const items = [...readmeSection("How it works").matchAll(/^\d+\. (.+)$/gm)].map(
    (match) => match[1] ?? "",
  );
  if (items.length < 3) fail("README.md", 'the numbered list under "How it works"');
  return items.map((item) => {
    const split = item.search(/\. (?=[A-Z])/);
    const title = split === -1 ? item : item.slice(0, split + 1);
    const body = split === -1 ? "" : item.slice(split + 2);
    return { title: inlineHtml(title), body: body ? inlineHtml(body) : "" };
  });
}

const MASCOT = "assets/mascot/README.md";

interface ShownWhenTable {
  /** Picture stem, to its "Shown when" cell. */
  pictures: Map<string, string>;
  /** Sign suffix such as `deletes`, from a `<picture>-deletes` row, to its "Shown when" cell. */
  signs: Map<string, string>;
}

/** Every picture stem and sign suffix the mascot README's two tables name, with its cell. */
function shownWhenTable(): ShownWhenTable {
  const pictures = new Map<string, string>();
  const signs = new Map<string, string>();
  for (const [, names = "", when = ""] of read(MASCOT).matchAll(/^\| (`.+?) \| (.+?) \|$/gm)) {
    const sign = /^`<picture>-([a-z-]+)`$/.exec(names);
    if (sign) {
      signs.set(sign[1] ?? "", when.trim());
      continue;
    }
    const stems = [...names.matchAll(/`([a-z0-9-]+)`( to `([a-z0-9-]+)`)?/g)].flatMap(
      ([, from = "", range, to = ""]) => {
        if (!range) return [from];
        const a = /^(.*?)(\d+)(.*)$/.exec(from);
        const b = /^(.*?)(\d+)(.*)$/.exec(to);
        if (!a || !b || a[1] !== b[1] || a[3] !== b[3])
          fail(MASCOT, `the range "${from} to ${to}"`);
        const out: string[] = [];
        for (let n = Number(a[2]); n <= Number(b[2]); n++) out.push(`${a[1]}${n}${a[3]}`);
        return out;
      },
    );
    for (const stem of stems) pictures.set(stem, when.trim());
  }
  return { pictures, signs };
}

export interface ShownWhen {
  /** The picture's own row, for a picture with signs the row of the picture without them. */
  when: string;
  /** For a picture with signs, the row of its signs, such as "there are both". */
  signs?: string;
}

/**
 * "Shown when" for each stem asked for, from the mascot README. A stem with signs, such as
 * `pending-4-deletes`, takes the row of `pending-4` and the row of `<picture>-deletes`. Fails on
 * a missing row.
 */
export function shownWhen(stems: readonly string[]): Record<string, ShownWhen> {
  const table = shownWhenTable();
  return Object.fromEntries(
    stems.map((stem): [string, ShownWhen] => {
      const own = table.pictures.get(stem);
      if (own) return [stem, { when: own }];
      for (const [suffix, signs] of table.signs) {
        const base = stem.endsWith(`-${suffix}`) ? stem.slice(0, -suffix.length - 1) : "";
        const when = table.pictures.get(base);
        if (when) return [stem, { when, signs }];
      }
      return fail(MASCOT, `a "Shown when" row for \`${stem}\``);
    }),
  );
}

/** The five water steps, as the mascot README lists them: "1 or 2", "3 or 4" and so on. */
export function waterSteps(): string[] {
  const match = /one amber mark each on the gauge: (.+?) pending\./.exec(read(MASCOT));
  const steps = match?.[1]?.split(/, (?:and )?/) ?? [];
  if (steps.length !== 5) fail(MASCOT, "the sentence that lists the five water steps");
  return steps;
}

const NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/**
 * The header states in the order the first that applies wins, and how many there are in
 * words. Fails when a state has no picture among `stems`, so a state added in a release
 * reaches the gallery. `pending` is shown by `pending-1` and the rest.
 */
export function headerStates(stems: readonly string[]): { count: string; order: string } {
  for (const state of HEADER_STATES) {
    if (!stems.some((stem) => stem === state || stem.startsWith(`${state}-`))) {
      throw new Error(
        `The header state \`${state}\` of vendor/sluiceway/src/render/dashboard-facts.ts has no ` +
          "picture in the gallery of src/content/docs/the-header.mdx. Add its file from assets/mascot.",
      );
    }
  }
  return {
    count: NUMBERS[HEADER_STATES.length] ?? String(HEADER_STATES.length),
    order: HEADER_STATES.map((state) => state.replace("-", " ")).join(", "),
  };
}
