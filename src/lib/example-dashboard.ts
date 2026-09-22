// The README's example dashboard, made by the action's own renderer at the pinned tag and
// rendered the way GitHub renders an issue body.
//
// Bun runs `exampleDashboard()` from the submodule in its own process, so the renderer runs
// exactly as the action's tests run it, outside Vite. The Markdown it prints is then turned
// into HTML with GitHub's rules: GFM task lists (boxes shown, disabled), raw HTML such as
// <details>, <kbd> and <sub> kept, GitHub's emoji shortcodes turned into their emoji, and an
// alert such as the destroy alert's `> [!CAUTION]` shown as a callout, as on every page.

import { execFileSync } from "node:child_process";
import { nameToEmoji } from "gemoji";
import type { Paragraph, PhrasingContent } from "mdast";
import { defineMdastPlugin, markdownToHtml } from "satteri";
import { githubAlerts } from "../plugins/github-alerts";
import { shiftHeadings } from "./headings";
import { VENDOR_DIR } from "./source";

const SCRIPT =
  'import { exampleDashboard } from "./test/docs/example-dashboard.ts";' +
  "process.stdout.write(exampleDashboard());";

function runRenderer(): string {
  try {
    return execFileSync(process.versions.bun ? process.execPath : "bun", ["-e", SCRIPT], {
      cwd: VENDOR_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    throw new Error(
      `vendor/sluiceway/test/docs/example-dashboard.ts did not run at the pinned tag.\n${stderr}`,
    );
  }
}

// The README folds the dashboard into a <details> with a line saying what is in it. The docs
// show it open inside an issue frame, so the fold and its line come off.
const FOLD = /^<details>\n<summary>.*<\/summary>\n\n([\s\S]*)\n\n<\/details>$/;

const SHORTCODE = /:([a-z0-9_+-]+):/g;

// GitHub renders an issue body with hard line breaks, so a line break inside a row's text is
// a <br>, and it turns `:warning:` in text into its emoji. Code keeps its colons, as on GitHub.
function issueText(nodes: readonly PhrasingContent[]): PhrasingContent[] {
  return nodes.flatMap((node): PhrasingContent[] => {
    if (node.type === "text") {
      const value = node.value.replace(
        SHORTCODE,
        (code, name: string) => nameToEmoji[name] ?? code,
      );
      return value
        .split("\n")
        .flatMap((line, i): PhrasingContent[] => [
          ...(i > 0 ? [{ type: "break" } as const] : []),
          ...(line ? [{ type: "text", value: line } as const] : []),
        ]);
    }
    if ("children" in node) {
      return [
        { ...node, children: issueText(node.children as PhrasingContent[]) } as PhrasingContent,
      ];
    }
    return [node];
  });
}

const issueBody = defineMdastPlugin({
  name: "sluiceway-issue-body",
  paragraph(node: Readonly<Paragraph>) {
    return { ...node, children: issueText(node.children) };
  },
});

// The header picture is a <picture> of two files on raw.githubusercontent.com at the example's
// release. The page serves the same stem from the submodule instead, at the pinned tag, and
// swaps the files with the site's theme as GitHub's <picture> does with the reader's.
const PICTURE =
  /<p align="center">\s*<picture>\s*<source media="\(prefers-color-scheme: dark\)" srcset="[^"]*\/assets\/mascot\/([a-z0-9-]+)-dark\.svg">\s*<img alt="([^"]*)" width="880" src="[^"]*\/assets\/mascot\/\1-light\.svg">\s*<\/picture>\s*<\/p>/;

// A box on GitHub is named by the text of its row. Here each disabled box takes the words its
// row starts with as its name, such as the stack id or "Rescan all stacks", so a screen
// reader says which row the box is on.
const BOX = /<input type="checkbox" disabled>((?:(?!<\/li>|<input).)*)/g;

function labelBoxes(html: string): string {
  return html.replace(BOX, (match, row: string) => {
    const name = row
      .replace(/<[^>]+>/g, "")
      .split(" · ")[0]
      ?.trim()
      .replace(/"/g, "&quot;");
    return name ? match.replace("<input", `<input aria-label="${name}"`) : match;
  });
}

export interface ExampleDashboard {
  /** The picture's file stem, such as `pending-4-destroys`. */
  picture: string;
  /** The picture's alt text, as the renderer wrote it. */
  alt: string;
  /** The body after the picture, as HTML. */
  html: string;
}

export function exampleDashboard(): ExampleDashboard {
  const markdown = runRenderer();
  const fold = FOLD.exec(markdown);
  if (!fold) {
    throw new Error(
      "The example dashboard no longer starts with <details><summary>. Update src/lib/example-dashboard.ts.",
    );
  }
  const body = fold[1] ?? "";
  const html = markdownToHtml(body, { mdastPlugins: [issueBody, githubAlerts] }).html;
  const picture = PICTURE.exec(html);
  if (!picture) {
    throw new Error(
      "The example dashboard's header <picture> has a new shape. Update src/lib/example-dashboard.ts.",
    );
  }
  return {
    picture: picture[1] ?? "",
    alt: picture[2] ?? "",
    html: labelBoxes(shiftHeadings(html.replace(PICTURE, "").trim()).html),
  };
}
