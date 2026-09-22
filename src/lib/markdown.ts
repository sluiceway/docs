// Reading the action's Markdown as text: its headings and the sections under them. The
// renderer finds the same headings; the loader checks that both agree, so a heading this
// scanner misses stops the build instead of cutting a page in the wrong place.

import { existsSync, readFileSync } from "node:fs";
import { vendorPath } from "./source";

export interface SourceHeading {
  depth: number;
  /** The heading as written, without the leading hashes, such as "`dashboard.title`". */
  raw: string;
  /** The 0-based line the heading is on. */
  line: number;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/** Whether `line` closes a code block opened with `fence`. */
function closes(line: string, fence: string): boolean {
  const close = FENCE_CLOSE.exec(line)?.[1];
  return close !== undefined && close[0] === fence[0] && close.length >= fence.length;
}
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;

/** The ATX headings of a Markdown file, outside fenced code blocks. */
export function scanHeadings(markdown: string): SourceHeading[] {
  const headings: SourceHeading[] = [];
  let fence: string | undefined;
  markdown.split("\n").forEach((text, line) => {
    if (fence) {
      if (closes(text, fence)) fence = undefined;
      return;
    }
    const open = FENCE.exec(text);
    if (open?.[1]) {
      fence = open[1];
      return;
    }
    const match = ATX.exec(text);
    if (match?.[1]) headings.push({ depth: match[1].length, raw: (match[2] ?? "").trim(), line });
  });
  return headings;
}

/** A heading's text as a reader sees it: inline code and emphasis marks taken out. */
export function plainHeading(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .trim();
}

/** Reads a file of the action at the pinned tag, or stops the build naming it. */
export function readVendor(path: string, usedBy: string): string {
  const file = vendorPath(path);
  if (!existsSync(file)) {
    throw new Error(
      `${usedBy} reads ${path} from the action, and vendor/sluiceway has no such file at the ` +
        "pinned tag. The action renamed or removed it: update the page list in src/lib/pages.ts.",
    );
  }
  return readFileSync(file, "utf8");
}

export interface Section {
  /** The heading the section starts with. */
  heading: SourceHeading;
  /** The section's Markdown, its heading line included. */
  markdown: string;
  /** Index of the first heading of the section in the file's heading list. */
  first: number;
  /** Index after the last heading of the section in the file's heading list. */
  end: number;
}

/**
 * The section under the heading whose plain text is `title`, down to the next heading of the
 * same or a higher level. Throws, naming the file and heading, when it is missing.
 */
export function section(
  markdown: string,
  path: string,
  title: string,
  depth = 2,
  headings = scanHeadings(markdown),
): Section {
  const first = headings.findIndex((h) => h.depth === depth && plainHeading(h.raw) === title);
  const heading = headings[first];
  if (!heading) {
    throw new Error(
      `The docs read the section "${"#".repeat(depth)} ${title}" of ${path}, and the action ` +
        "has no such heading at the pinned tag. It was renamed or removed: update src/lib/pages.ts.",
    );
  }
  let end = first + 1;
  while (end < headings.length && (headings[end]?.depth ?? 0) > depth) end++;
  const lines = markdown.split("\n");
  const stop = headings[end]?.line ?? lines.length;
  return {
    heading,
    markdown: lines.slice(heading.line, stop).join("\n").trimEnd(),
    first,
    end,
  };
}

/** The h1 of a file and the Markdown after it. Throws when the file does not start with one. */
export function splitTitle(markdown: string, path: string): { title: string; body: string } {
  const headings = scanHeadings(markdown);
  const h1 = headings[0];
  if (h1?.depth !== 1) {
    throw new Error(`${path} has no h1 to take the page title from.`);
  }
  const lines = markdown.split("\n");
  return {
    title: plainHeading(h1.raw),
    body: [...lines.slice(0, h1.line), ...lines.slice(h1.line + 1)].join("\n").trim(),
  };
}

/**
 * Splits Markdown into blocks at blank lines outside fenced code, for picking single
 * paragraphs or list items out of a section.
 */
export function blocks(markdown: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let fence: string | undefined;
  for (const line of markdown.split("\n")) {
    if (fence) {
      if (closes(line, fence)) fence = undefined;
    } else if (FENCE.test(line)) {
      fence = FENCE.exec(line)?.[1];
    } else if (line.trim() === "") {
      if (current.length > 0) out.push(current.join("\n"));
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) out.push(current.join("\n"));
  return out;
}
