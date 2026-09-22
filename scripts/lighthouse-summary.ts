// Prints the median Lighthouse scores and page weight per URL from `lhci collect`'s runs in
// .lighthouseci/, as a Markdown table: `bun scripts/lighthouse-summary.ts [dir]`.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? ".lighthouseci";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

interface Report {
  finalDisplayedUrl?: string;
  requestedUrl: string;
  categories: Record<string, { score: number | null }>;
  audits: Record<string, { numericValue?: number }>;
}

const byUrl = new Map<string, Report[]>();
for (const name of readdirSync(dir).filter((n) => /^lhr-.*\.json$/.test(n))) {
  const report = JSON.parse(readFileSync(join(dir, name), "utf8")) as Report;
  const url = new URL(report.requestedUrl).pathname;
  byUrl.set(url, [...(byUrl.get(url) ?? []), report]);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

console.log(`| URL | ${CATEGORIES.join(" | ")} | Weight (KB) |`);
console.log(`|---|${CATEGORIES.map(() => "---:").join("|")}|---:|`);
for (const [url, reports] of [...byUrl].sort()) {
  const scores = CATEGORIES.map((c) =>
    Math.round(100 * median(reports.map((r) => r.categories[c]?.score ?? 0))),
  );
  const weight = median(reports.map((r) => r.audits["total-byte-weight"]?.numericValue ?? 0));
  console.log(`| \`${url}\` | ${scores.join(" | ")} | ${Math.round(weight / 1024)} |`);
}
