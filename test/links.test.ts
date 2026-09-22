// Link rewriting, with real links from the action at the pinned tag.

import { describe, expect, test } from "bun:test";
import { linkRecords, resolveLink, rewriteLinks } from "../src/lib/links";
import { pages, recordId, records, siteMap, urlFor } from "../src/lib/pages";
import { REPO_URL, TAG } from "../src/lib/source";

const url = urlFor("/docs");
const site = siteMap(pages(REPO_URL, "/docs"), url);
const blob = `${REPO_URL}/blob/${TAG}`;

describe("resolveLink", () => {
  const cases: [from: string, href: string, want: string][] = [
    // A section of another file that a page shows, from docs/.
    ["docs/workflow.md", "reference.md#requirements", "/docs/get-started/#requirements"],
    [
      "docs/security.md",
      "workflow.md#with-github-environments",
      "/docs/guides/workflow/#with-github-environments",
    ],
    // A README section shown without its heading lands on the page itself.
    ["docs/workflow.md", "../README.md#get-started", "/docs/get-started/"],
    // A file's h1 is the page title: a link to it lands on the page, as on GitHub.
    ["docs/read-only-trial.md", "workflow.md#the-workflow", "/docs/guides/workflow/"],
    // Whole files, and headings in them.
    ["README.md", "docs/credentials.md", "/docs/guides/credentials/"],
    ["README.md", "docs/configuration.md#driftenabled", "/docs/guides/configuration/#driftenabled"],
    [
      "docs/example-workflows.md",
      "configuration.md#stacksenvironment",
      "/docs/guides/configuration/#stacksenvironment",
    ],
    ["README.md", "CONTEXT.md", "/docs/reference/glossary/"],
    ["docs/brief.md", "adr", "/docs/why/"],
    // An example workflow is shown in full on the example workflows page.
    [
      "docs/example-workflows.md",
      "../examples/workflows/cloud-oidc.yml",
      "/docs/guides/example-workflows/#cloud-oidcyml",
    ],
    // Covered by the generated reference.
    ["README.md", "docs/reference.md#inputs", "/docs/reference/action/#inputs"],
    ["docs/README.md", "reference.md", "/docs/reference/action/"],
    // Not on the site: GitHub at the pinned tag.
    ["docs/security.md", "../SECURITY.md", `${blob}/SECURITY.md`],
    ["README.md", "#more", `${blob}/README.md#more`],
    ["README.md", "docs/brief.md", `${blob}/docs/brief.md`],
    // Left alone.
    [
      "README.md",
      "https://github.com/sluiceway/sluiceway/issues/new",
      "https://github.com/sluiceway/sluiceway/issues/new",
    ],
  ];
  for (const [from, href, want] of cases) {
    test(`${href} from ${from}`, () => {
      const got = resolveLink(href, from, site);
      expect(got.url).toBe(want);
      expect(got.warning).toBeUndefined();
    });
  }

  test("a heading the file does not have is a warning", () => {
    const got = resolveLink("../README.md#no-such-heading", "docs/security.md", site);
    expect(got.warning).toContain("no-such-heading");
  });

  test("a file the action does not have is a warning", () => {
    const got = resolveLink("../research/preview-page.md", "docs/adr/0050-x.md", site);
    expect(got.warning).toContain("docs/research/preview-page.md");
  });
});

describe("rewriteLinks", () => {
  test("rewrites href, src and srcset, and leaves code alone", () => {
    const html =
      '<p><a href="docs/credentials.md#opentofu">x</a> <code>[a](docs/later.md)</code></p>' +
      '<picture><source srcset="assets/mascot/in-sync-dark.svg"><img src="assets/mascot/in-sync-light.svg"></picture>';
    const out = rewriteLinks(html, "README.md", site);
    expect(out).toContain('href="/docs/guides/credentials/#opentofu"');
    expect(out).toContain("<code>[a](docs/later.md)</code>");
    expect(out).toContain(
      `srcset="https://raw.githubusercontent.com/sluiceway/sluiceway/${TAG}/assets/mascot/in-sync-dark.svg"`,
    );
    expect(out).toContain(
      `src="https://raw.githubusercontent.com/sluiceway/sluiceway/${TAG}/assets/mascot/in-sync-light.svg"`,
    );
  });
});

describe("linkRecords", () => {
  const urls = new Map(records().map((r) => [r.number, url(recordId(r))]));
  const link = (n: string) => `<a href="${urls.get(n)}">${n}</a>`;

  test("links a named record anywhere", () => {
    const out = linkRecords("<p>the tool refuses the plan (record 0053).</p>", {
      urls,
      recordsContext: false,
    });
    expect(out).toBe(`<p>the tool refuses the plan (record ${link("0053")}).</p>`);
  });

  test("links bare numbers only on pages about records", () => {
    const html = "<p>Amended by 0055: drift. See (0038) and (0010, 0051).</p>";
    expect(linkRecords(html, { urls, recordsContext: false })).toBe(html);
    const out = linkRecords(html, { urls, recordsContext: true });
    expect(out).toContain(`Amended by ${link("0055")}`);
    expect(out).toContain(`(${link("0038")})`);
    expect(out).toContain(`(${link("0010")}, ${link("0051")})`);
  });

  test("leaves code, links, headings, unknown numbers and the page's own record alone", () => {
    const html =
      '<h2>Record 0054</h2><p><code>record 0054</code> <a href="x">record 0054</a> record 9999 (0049) (0054)</p>';
    expect(linkRecords(html, { urls, recordsContext: true, self: "0054" })).toBe(html);
  });

  test("links record numbers at the start of a table cell", () => {
    const out = linkRecords("<td>0053, the adapter research</td>", { urls, recordsContext: true });
    expect(out).toBe(`<td>${link("0053")}, the adapter research</td>`);
  });
});
