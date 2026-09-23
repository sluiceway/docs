// Says loudly when the pin is behind the action's latest release. It asks GitHub for the
// action's releases, and when the tag in .gitmodules is older than the latest one it prints a
// warning that names both and the releases in between. In GitHub Actions the warning is an
// annotation, and it goes into the job summary too, so a reviewer sees it on the pull request.
//
// It never fails the build: the action releases several times a day, and a pull request that
// changes something else must stay green. With no network, no token or a rate limit it says so
// in one line and carries on. The weekly freshness workflow is the slow signal; this is the
// fast one.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

export const ACTION_REPO = "sluiceway/sluiceway";

export interface Release {
  tag: string;
  /** `YYYY-MM-DD`. */
  date: string;
}

interface GitHubRelease {
  tag_name: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
}

const SEMVER = /^v(\d+)\.(\d+)\.(\d+)$/;

/** Compares two tags such as `v0.25.0`; negative when `a` is older. */
export function compareTags(a: string, b: string): number {
  const pa = SEMVER.exec(a)?.slice(1).map(Number) ?? [];
  const pb = SEMVER.exec(b)?.slice(1).map(Number) ?? [];
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** The published full releases, newest first. */
export function releasesOf(list: GitHubRelease[]): Release[] {
  return list
    .filter((r) => !r.draft && !r.prerelease && SEMVER.test(r.tag_name))
    .map((r) => ({ tag: r.tag_name, date: (r.published_at ?? "").slice(0, 10) }))
    .sort((a, b) => compareTags(b.tag, a.tag));
}

export type Verdict =
  | { kind: "current"; pinned: string; latest: string }
  | { kind: "behind"; pinned: string; latest: string; after: Release[] };

export function verdict(pinned: string, releases: Release[]): Verdict {
  const latest = releases[0]?.tag ?? pinned;
  const after = releases.filter((r) => compareTags(r.tag, pinned) > 0);
  if (after.length === 0) return { kind: "current", pinned, latest };
  return { kind: "behind", pinned, latest, after };
}

const releaseUrl = (tag: string) => `https://github.com/${ACTION_REPO}/releases/tag/${tag}`;

function count(after: Release[]): string {
  return after.length === 1 ? "1 release" : `${after.length} releases`;
}

/** The one line that says the pin is behind, as plain text. */
export function behindLine(v: Extract<Verdict, { kind: "behind" }>): string {
  const list = v.after.map((r) => (r.date ? `${r.tag} (${r.date})` : r.tag)).join(", ");
  return (
    `The docs pin ${v.pinned}, and the action's latest release is ${v.latest}. ` +
    `${count(v.after)} after the pin: ${list}.`
  );
}

/** The same line for the job summary, with each release linked. */
export function summaryNote(v: Extract<Verdict, { kind: "behind" }>): string {
  const list = v.after.map((r) => `[${r.tag}](${releaseUrl(r.tag)})`).join(", ");
  return [
    "> [!WARNING]",
    `> The docs pin \`${v.pinned}\`, and the action's latest release is \`${v.latest}\`. ` +
      `${count(v.after)} after the pin: ${list}. This check never fails the build.`,
    "",
  ].join("\n");
}

export async function fetchReleases(
  fetcher: typeof fetch = fetch,
  token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
): Promise<Release[]> {
  const response = await fetcher(
    `https://api.github.com/repos/${ACTION_REPO}/releases?per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  return releasesOf((await response.json()) as GitHubRelease[]);
}

function pinnedTag(): string {
  return execFileSync(
    "git",
    ["config", "--file", ".gitmodules", "--get", "submodule.vendor/sluiceway.branch"],
    { encoding: "utf8" },
  ).trim();
}

/** Runs the check and prints what it found. Never throws. */
export async function checkRelease(
  options: {
    pinned?: string;
    fetcher?: typeof fetch;
    log?: (line: string) => void;
    env?: Record<string, string | undefined>;
  } = {},
): Promise<Verdict | undefined> {
  const log = options.log ?? console.log;
  const env = options.env ?? process.env;
  let v: Verdict;
  try {
    const pinned = options.pinned ?? pinnedTag();
    v = verdict(pinned, await fetchReleases(options.fetcher));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log(`Could not ask GitHub for the action's latest release (${reason}). Carrying on.`);
    return undefined;
  }
  if (v.kind === "current") {
    log(`vendor/sluiceway pins ${v.pinned}, the action's latest release.`);
    return v;
  }
  const line = behindLine(v);
  if (env.GITHUB_ACTIONS === "true") {
    log(`::warning title=The docs pin an older release::${line}`);
  } else {
    const rule = "!".repeat(72);
    log(
      [rule, `!! ${line}`, "!! This build still passes. The README says how to follow.", rule].join(
        "\n",
      ),
    );
  }
  if (env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(env.GITHUB_STEP_SUMMARY, summaryNote(v));
    } catch {
      log("Could not write the job summary. Carrying on.");
    }
  }
  return v;
}

if (import.meta.main) await checkRelease();
