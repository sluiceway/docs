// Turns GitHub alert blockquotes (`> [!NOTE]`, `> [!IMPORTANT]` and the rest) into the design
// system's Callout, with the same markup as src/components/Callout.astro. The action's own
// Markdown uses this syntax, so pages read from it get callouts without being rewritten.

import type { Blockquote, Paragraph, PhrasingContent, RootContent } from "mdast";
import { defineMdastPlugin } from "satteri";

export type CalloutKind = "note" | "tip" | "pending" | "danger";

/** Each GitHub alert, the Callout kind it takes, and the title it shows. */
export const ALERTS = {
  NOTE: { kind: "note", title: "Note" },
  TIP: { kind: "tip", title: "Tip" },
  IMPORTANT: { kind: "pending", title: "Important" },
  WARNING: { kind: "pending", title: "Warning" },
  CAUTION: { kind: "danger", title: "Caution" },
} as const satisfies Record<string, { kind: CalloutKind; title: string }>;

/** The glyph in the round mark. Decorative: the title carries the meaning. */
export const CALLOUT_MARK: Record<CalloutKind, string> = {
  note: "i",
  tip: "~",
  pending: "!",
  danger: "!",
};

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n)?/;

type Element = Paragraph & { data: { hName: string; hProperties: Record<string, unknown> } };

function element(
  hName: string,
  hProperties: Record<string, unknown>,
  children: (RootContent | PhrasingContent)[] = [],
): Element {
  // A paragraph node with hName renders as any element: the same trick Starlight's asides use.
  return {
    type: "paragraph",
    data: { hName, hProperties },
    children: children as PhrasingContent[],
  };
}

/** Removes the leading `[!KIND]` from the first paragraph, however the parser split it. */
function stripMarker(para: Readonly<Paragraph>, length: number): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let left = length;
  for (const child of para.children) {
    if (left > 0 && child.type === "text") {
      const rest = child.value.slice(left).replace(/^[ \t]*\r?\n?/, "");
      left = Math.max(0, left - child.value.length);
      if (rest) out.push({ type: "text", value: rest });
      continue;
    }
    if (left > 0 && child.type === "break") continue;
    if (left > 0) return [...para.children];
    out.push(child);
  }
  // A soft break right after the marker leaves an empty line at the start.
  if (out[0]?.type === "break") out.shift();
  return out;
}

export const githubAlerts = defineMdastPlugin({
  name: "sluiceway-github-alerts",
  blockquote(node: Readonly<Blockquote>, ctx) {
    const [first, ...rest] = node.children;
    if (first?.type !== "paragraph") return;
    const match = MARKER.exec(ctx.textContent(first));
    if (!match) return;
    const alert = ALERTS[match[1] as keyof typeof ALERTS];

    const lead = stripMarker(first, `[!${match[1]}]`.length);
    const body: RootContent[] = lead.length > 0 ? [{ type: "paragraph", children: lead }] : [];
    body.push(...rest);

    return element("aside", { className: ["sw-callout", `sw-callout--${alert.kind}`] }, [
      element("div", { className: ["sw-callout__mark"], ariaHidden: "true" }, [
        { type: "text", value: CALLOUT_MARK[alert.kind] },
      ]),
      element("div", { className: ["sw-callout__content"] }, [
        element("p", { className: ["sw-callout__title"] }, [{ type: "text", value: alert.title }]),
        element("div", { className: ["sw-callout__body"] }, body),
      ]),
    ]);
  },
});
