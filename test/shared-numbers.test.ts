// Two records of the action can share a number: v0.50.0 numbered both records of 2026-10-07
// 0119. Each file that cites a shared number links the record it means, by SHARED_NUMBERS.
//
// The built pages are read from dist/, so run it after `bun run build`, as `bun run check` does.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { records, recordsCitedIn, SHARED_NUMBERS } from "../src/lib/pages";

const BASE = (process.env.DOCS_BASE ?? "/docs").replace(/\/+$/, "");
const WRITE_BACK =
  "0119-a-write-that-went-over-an-edit-writes-it-back-and-the-walk-looks-through-it";
const PULLS =
  "0119-the-open-pull-requests-are-read-with-pull-requests-read-alone-and-a-list-that-fails-is-a-warning";

const built = (id: string) => readFileSync(`dist/${id}/index.html`, "utf8");
const href = (record: string) => `href="${BASE}/why/${record}/"`;

describe("a shared number", () => {
  const list = records();

  test("each shared number of the pinned tag has its entry", () => {
    const counts = new Map<string, number>();
    for (const r of list) counts.set(r.number, (counts.get(r.number) ?? 0) + 1);
    const shared = [...counts].filter(([, n]) => n > 1).map(([number]) => number);
    expect(shared.sort()).toEqual(Object.keys(SHARED_NUMBERS).sort());
  });

  test("resolves by the file that cites it", () => {
    expect(recordsCitedIn("docs/workflow.md", "(record 0119)", list).get("0119")?.file).toBe(
      `docs/adr/${PULLS}.md`,
    );
    expect(
      recordsCitedIn(
        "docs/adr/0017-the-bot-is-always-the-workflow-token.md",
        "Amended by 0119",
        list,
      ).get("0119")?.file,
    ).toBe(`docs/adr/${WRITE_BACK}.md`);
  });

  test("a record that shares a number means itself", () => {
    const file = `docs/adr/${WRITE_BACK}.md`;
    expect(recordsCitedIn(file, "0119", list).get("0119")?.file).toBe(file);
  });

  test("a file that does not cite it links neither", () => {
    expect(recordsCitedIn("docs/security.md", "record 0118", list).has("0119")).toBe(false);
  });

  test("a file that cites it without an entry fails the build", () => {
    expect(() => recordsCitedIn("docs/security.md", "record 0119", list)).toThrow(
      "Say in SHARED_NUMBERS",
    );
  });
});

describe("the built pages link the record they mean", () => {
  test("record 0017's Amended by 0119 is the write that went over an edit", () => {
    // The sidebar links both records on every page, so the check reads the lead itself.
    const html = built("why/0017-the-bot-is-always-the-workflow-token");
    expect(html).toContain(`Amended by <a ${href(WRITE_BACK)}>0119</a>`);
  });

  test("the workflow guides' record 0119 is the open pull requests", () => {
    for (const id of ["guides/workflow", "guides/split-workflow"]) {
      expect(built(id)).toContain(`as counts (record <a ${href(PULLS)}>0119</a>)`);
    }
  });

  test("the index links each row's 0119 to its own record", () => {
    const html = built("why");
    const row = (record: string) => {
      const at = html.indexOf(`/why/${record}/`);
      return html.slice(at, html.indexOf("</tr>", at));
    };
    // 0017 says it is amended by the write-back record; 0054 is amended by the other one,
    // whose lead names it.
    expect(row("0017-the-bot-is-always-the-workflow-token")).toContain(href(WRITE_BACK));
    const fiftyFour = records().find((r) => r.number === "0054");
    expect(fiftyFour).toBeDefined();
    const id = fiftyFour?.file.replace(/^docs\/adr\//, "").replace(/\.md$/, "") ?? "";
    expect(row(id)).toContain(href(PULLS));
    expect(html).toContain(href(WRITE_BACK));
    expect(html).toContain(href(PULLS));
  });
});
