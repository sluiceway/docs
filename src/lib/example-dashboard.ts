// The action's example dashboard, rendered the way GitHub renders an issue body.
//
// The action publishes the body as a scan writes it into the issue, made by its own renderer,
// at `assets/example-dashboard.md` of every release tag (its record 0088). The docs read that
// file at the pinned tag and turn it into HTML with GitHub's rules: GFM task lists (boxes shown, disabled), raw HTML such as
// <details>, <kbd> and <sub> kept, GitHub's emoji shortcodes turned into their emoji, and an
// alert such as the destroy alert's `> [!CAUTION]` shown as a callout, as on every page.

import { readFileSync } from "node:fs";
import { nameToEmoji } from "gemoji";
import type { Paragraph, PhrasingContent } from "mdast";
import { defineMdastPlugin, markdownToHtml } from "satteri";
import { githubAlerts } from "../plugins/github-alerts";
import { shiftHeadings } from "./headings";
import { vendorPath } from "./source";

const EXAMPLE_FILE = "assets/example-dashboard.md";

function readExample(): string {
  try {
    return readFileSync(vendorPath(EXAMPLE_FILE), "utf8");
  } catch {
    throw new Error(`vendor/sluiceway/${EXAMPLE_FILE} was not found at the pinned tag.`);
  }
}

// The body's hidden markers say nothing to a reader, so they come off, as in the README's copy.
function withoutMarkers(markdown: string): string {
  return markdown
    .replace(/^<!-- sluiceway:dashboard [^\n]*-->\n\n/, "")
    .replace(/^ *<!-- \/sluiceway:row -->\n/gm, "")
    .replace(/ <!-- sluiceway:[^\n]*?-->/g, "")
    .trim();
}

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

// A row's spinner has an empty alt, because the row's words say it deploys. It is marked
// hidden from screen readers too, as every decorative image on the site is.
function decorative(html: string): string {
  return html.replace(/<img alt=""(?![^>]*aria-hidden)/g, '<img alt="" aria-hidden="true"');
}

export interface ExampleDashboard {
  /** The picture's file stem, such as `pending-4-deletes`. */
  picture: string;
  /** The picture's alt text, as the renderer wrote it. */
  alt: string;
  /** The body after the picture, as HTML. */
  html: string;
}

export function exampleDashboard(): ExampleDashboard {
  const body = withoutMarkers(readExample());
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
    html: labelBoxes(decorative(shiftHeadings(html.replace(PICTURE, "").trim()).html)),
  };
}
