// The check that says when the pin is behind the action's latest release. It warns and never
// fails, and on any error it says so in one line.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRelease, compareTags, releasesOf } from "../scripts/check-release";

const RELEASES = [
  { tag_name: "v0.26.1", published_at: "2026-09-22T21:56:44Z", draft: false, prerelease: false },
  {
    tag_name: "v0.27.0-rc.1",
    published_at: "2026-09-23T08:00:00Z",
    draft: false,
    prerelease: true,
  },
  { tag_name: "v0.30.0", published_at: null, draft: true, prerelease: false },
  { tag_name: "v0.25.0", published_at: "2026-09-22T19:11:47Z", draft: false, prerelease: false },
  { tag_name: "v0.26.0", published_at: "2026-09-22T20:18:19Z", draft: false, prerelease: false },
  { tag_name: "v0.9.0", published_at: "2026-09-10T10:00:00Z", draft: false, prerelease: false },
];

const answer = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

async function run(pinned: string, fetcher: typeof fetch, env: Record<string, string> = {}) {
  const lines: string[] = [];
  const v = await checkRelease({ pinned, fetcher, log: (line) => lines.push(line), env });
  return { v, out: lines.join("\n") };
}

describe("the release check", () => {
  test("compares tags as numbers", () => {
    expect(compareTags("v0.10.0", "v0.9.0")).toBeGreaterThan(0);
    expect(compareTags("v0.26.1", "v0.26.1")).toBe(0);
  });

  test("reads only published full releases, newest first", () => {
    expect(releasesOf(RELEASES).map((r) => r.tag)).toEqual([
      "v0.26.1",
      "v0.26.0",
      "v0.25.0",
      "v0.9.0",
    ]);
  });

  test("a pin at the latest release says so in one line", async () => {
    const { v, out } = await run("v0.26.1", answer(RELEASES));
    expect(v?.kind).toBe("current");
    expect(out).toBe("vendor/sluiceway pins v0.26.1, the action's latest release.");
  });

  test("a pin behind names both versions and the releases in between", async () => {
    const { v, out } = await run("v0.25.0", answer(RELEASES));
    expect(v?.kind).toBe("behind");
    expect(out).toContain("The docs pin v0.25.0, and the action's latest release is v0.26.1.");
    expect(out).toContain("2 releases after the pin: v0.26.1 (2026-09-22), v0.26.0 (2026-09-22).");
    expect(out).not.toContain("v0.27.0-rc.1");
    expect(out).not.toContain("::warning");
  });

  test("in GitHub Actions it is an annotation and a job summary note", async () => {
    const summary = join(mkdtempSync(join(tmpdir(), "release-check-")), "summary.md");
    const { out } = await run("v0.26.0", answer(RELEASES), {
      GITHUB_ACTIONS: "true",
      GITHUB_STEP_SUMMARY: summary,
    });
    expect(out).toStartWith("::warning title=The docs pin an older release::The docs pin v0.26.0");
    const note = readFileSync(summary, "utf8");
    expect(note).toStartWith("> [!WARNING]\n");
    expect(note).toContain(
      "1 release after the pin: [v0.26.1](https://github.com/sluiceway/sluiceway/releases/tag/v0.26.1).",
    );
  });

  test("an error from GitHub or the network is one line, and nothing throws", async () => {
    const offline = (async () => {
      throw new Error("Unable to connect");
    }) as unknown as typeof fetch;
    for (const fetcher of [offline, answer({ message: "API rate limit exceeded" }, 403)]) {
      const { v, out } = await run("v0.25.0", fetcher);
      expect(v).toBeUndefined();
      expect(out.split("\n")).toHaveLength(1);
      expect(out).toStartWith("Could not ask GitHub for the action's latest release (");
      expect(out).toEndWith("). Carrying on.");
    }
  });
});
