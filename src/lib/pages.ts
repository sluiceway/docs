// The pages read from the action, and the sidebar. One list, so the order of the site and
// which of the action's files and sections each page shows are settled in one place.
//
// A page is made of parts. A part is Markdown from one file of the action, with the indexes
// of that file's headings it holds, in order. The loader renders each part, gives its
// headings the ids GitHub gives them in the whole file, and rewrites its links.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import GithubSlugger, { slug as githubSlugOne } from "github-slugger";
import type { SiteMap } from "./links";
import {
  blocks,
  plainHeading,
  readVendor,
  type SourceHeading,
  scanHeadings,
  section,
  splitTitle,
} from "./markdown";
import { actionReference, configReference } from "./reference";
import { vendorPath } from "./source";

export interface Part {
  /** The action file the Markdown comes from. Its links are resolved against this path. */
  from: string;
  markdown: string;
  /** Indexes into `scanHeadings(from)` of the headings this Markdown holds, in order. */
  headings: number[];
  /** The index of a heading left out because the page title says the same. */
  dropped?: number;
}

export interface Page {
  /** The route, such as `guides/configuration`. */
  id: string;
  title: string;
  /** One plain sentence, for search and the head tags. */
  description: string;
  /** The action file shown as the page's source in the footer. */
  source: string;
  sidebarLabel?: string;
  headerPicture?: { picture: string; alt: string };
  /** Bare record numbers in parentheses and table cells link to their records here. */
  recordsContext?: boolean;
  /** Give every `**Term**:` paragraph an id, for the glossary. */
  termAnchors?: boolean;
  /** Written above the parts, as HTML, such as the record number of a decision record. */
  eyebrow?: string;
  parts: Part[];
}

/**
 * A link to an action file or heading that no page shows by its own heading but a page
 * covers, such as README "Inputs", which the generated reference replaces.
 */
export interface Covered {
  /** `path` or `path#github-slug`. */
  link: string;
  /** The page id, with a `#fragment` when it lands on a heading of that page. */
  page: string;
}

/** Slice 3's routes. This slice only places them in the sidebar. */
export const SLICE_3 = {
  overview: "",
  whatItLooksLike: "what-it-looks-like",
  theHeader: "the-header",
};

/**
 * Whether one of slice 3's pages is in src/content/docs yet. Until it is, the sidebar leaves it
 * out and links to it go to GitHub, so no link points at a page that is not built.
 */
export function written(id: string): boolean {
  const dir = join(process.cwd(), "src/content/docs");
  const stems = id ? [join(dir, id), join(dir, id, "index")] : [join(dir, "index")];
  return stems.some((stem) => [".md", ".mdx"].some((ext) => existsSync(stem + ext)));
}

const README = "README.md";

/**
 * README h2 sections that are not a page of their own, and why. A README h2 in neither this
 * list nor a page is reported as a warning, so a new section in a later release gets noticed.
 */
export const README_UNMAPPED: Record<string, string> = {
  "What it looks like": "slice 3's page what-it-looks-like",
  Inputs: "the generated reference, reference/action",
  Outputs: "the generated reference, reference/action",
  Security: "the Security page; its five promises stay on GitHub",
  Documentation: "the sidebar",
  Contributing: "not a page",
  License: "not a page",
};

// Helpers that cut the action's files into parts.

interface Source {
  path: string;
  markdown: string;
  headings: SourceHeading[];
}

const cache = new Map<string, Source>();

export function source(path: string): Source {
  let hit = cache.get(path);
  if (!hit) {
    const markdown = readVendor(path, "The docs");
    hit = { path, markdown, headings: scanHeadings(markdown) };
    cache.set(path, hit);
  }
  return hit;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
}

/** A whole file without its h1. */
function wholeFile(path: string, transform: (md: string) => string = (md) => md): Part {
  const src = source(path);
  const { body } = splitTitle(src.markdown, path);
  return { from: path, markdown: transform(body), headings: range(1, src.headings.length) };
}

/** The file's h1, as a page title. */
function titleOf(path: string): string {
  return splitTitle(source(path).markdown, path).title;
}

/** Everything before the first h2 of a file, h1 left out. */
function preamble(path: string): Part {
  const src = source(path);
  const h2 = src.headings.findIndex((h) => h.depth === 2);
  const lines = src.markdown.split("\n");
  const stop = src.headings[h2]?.line ?? lines.length;
  const h1 = src.headings[0];
  const start = h1?.depth === 1 ? h1.line + 1 : 0;
  return { from: path, markdown: lines.slice(start, stop).join("\n").trim(), headings: [] };
}

/** From the first h2 of a file to its end. */
function fromFirstH2(path: string): Part {
  const src = source(path);
  const h2 = src.headings.findIndex((h) => h.depth === 2);
  const heading = src.headings[h2];
  if (!heading) throw new Error(`${path} has no h2.`);
  return {
    from: path,
    markdown: src.markdown.split("\n").slice(heading.line).join("\n").trim(),
    headings: range(h2, src.headings.length),
  };
}

interface SectionOptions {
  /** Leave the section's own heading out, when it would repeat the page title. */
  dropHeading?: boolean;
  /** Show the heading with this text. Its id stays the one GitHub gives the original. */
  retitle?: string;
  /** Leave out the subsections with these titles, one level below. */
  without?: string[];
}

/** One h2 (or deeper) section of a file. */
function sectionPart(path: string, title: string, options: SectionOptions = {}, depth = 2): Part {
  const src = source(path);
  const cut = section(src.markdown, path, title, depth, src.headings);
  let lines = cut.markdown.split("\n");
  let headings = range(cut.first, cut.end);
  for (const sub of options.without ?? []) {
    const inner = section(src.markdown, path, sub, depth + 1, src.headings);
    if (inner.first < cut.first || inner.end > cut.end) {
      throw new Error(`"${sub}" is not inside "${title}" in ${path}.`);
    }
    const drop = new Set(inner.markdown.split("\n").map((_, i) => inner.heading.line + i));
    lines = lines.filter((_, i) => !drop.has(cut.heading.line + i));
    headings = headings.filter((h) => h < inner.first || h >= inner.end);
  }
  if (options.dropHeading) {
    return {
      from: path,
      markdown: lines.slice(1).join("\n").trim(),
      headings: headings.slice(1),
      dropped: cut.first,
    };
  }
  if (options.retitle) lines[0] = `${"#".repeat(depth)} ${options.retitle}`;
  return { from: path, markdown: lines.join("\n").trim(), headings };
}

/**
 * The list items of a section whose bold lead is one of `leads`, under the section heading.
 * Throws when one is missing, so a reworded promise is caught.
 */
function listItems(path: string, title: string, leads: string[]): Part {
  const src = source(path);
  const cut = section(src.markdown, path, title, 2, src.headings);
  const items = cut.markdown
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .filter((line) => leads.some((lead) => line.startsWith(`- **${lead}**`)));
  for (const lead of leads) {
    if (!items.some((line) => line.startsWith(`- **${lead}**`))) {
      throw new Error(
        `The docs read the item "${lead}" under "## ${title}" of ${path}, and it is gone.`,
      );
    }
  }
  return {
    from: path,
    markdown: `${cut.markdown.split("\n")[0]}\n\n${items.join("\n")}`,
    headings: [cut.first],
  };
}

/** The first paragraph under a heading, with the heading. */
function firstParagraph(path: string, title: string, retitle?: string): Part {
  const src = source(path);
  const cut = section(src.markdown, path, title, 2, src.headings);
  const [, paragraph] = blocks(cut.markdown);
  if (!paragraph) throw new Error(`"## ${title}" of ${path} has no paragraph.`);
  return {
    from: path,
    markdown: `## ${retitle ?? title}\n\n${paragraph}`,
    headings: [cut.first],
  };
}

/** Generated Markdown, resolved against `from` for its links. It holds no source headings. */
function generated(from: string, markdown: string): Part {
  return { from, markdown, headings: [] };
}

// The decision records.

export interface DecisionRecord {
  number: string;
  file: string;
  title: string;
  /** "Amended by 0051" and the like, from the lines above the first h2. */
  changes: { kind: string; records: string[] }[];
}

const RECORD_FILE = /^(\d{4})-.+\.md$/;

export function records(): DecisionRecord[] {
  return readdirSync(vendorPath("docs/adr"))
    .filter((file) => RECORD_FILE.test(file))
    .sort()
    .map((file) => {
      const path = `docs/adr/${file}`;
      const src = source(path);
      const firstH2 = src.headings.find((h) => h.depth === 2)?.line ?? Number.POSITIVE_INFINITY;
      const top = src.markdown.split("\n").slice(0, firstH2);
      const changes = top
        .map((line) => /^(?:>\s*)?((?:Amended|Superseded)[^:]*):/.exec(line)?.[1])
        .filter((lead): lead is string => Boolean(lead))
        .map((lead) => {
          const plain = lead.replace(/\s*\([^)]*\)/g, "").trim();
          return {
            kind: plain
              .replace(/\s*\b\d{4}\b.*$/, "")
              .replace(/,$/, "")
              .trim(),
            records: plain.match(/\b\d{4}\b/g) ?? [],
          };
        });
      return {
        number: RECORD_FILE.exec(file)?.[1] ?? "",
        file: path,
        title: titleOf(path),
        changes,
      };
    });
}

/**
 * A record's description: its title, which is the decision, with what the page holds. The
 * long titles go alone or with only the number, so no description passes 160 characters.
 */
export function recordDescription(record: Pick<DecisionRecord, "number" | "title">): string {
  const options = [
    `${record.title}. Decision record ${record.number}, with its reasons and consequences.`,
    `Decision record ${record.number}: ${record.title}.`,
    `${record.title}.`,
  ];
  return options.find((d) => d.length <= 160) ?? `${record.title.slice(0, 159)}.`;
}

export function recordId(record: Pick<DecisionRecord, "file">): string {
  return `why/${record.file.replace(/^docs\/adr\//, "").replace(/\.md$/, "")}`;
}

// The changelog.

const RELEASE_HEADING = /^## (?:\[([^\]]+)\]\([^)]*\)|(\d+\.\d+\.\d+))(.*)$/gm;

/** Each version heading links to its GitHub release instead of the compare view. */
export function changelogHeadings(markdown: string, repoUrl: string): string {
  return markdown.replace(RELEASE_HEADING, (_, linked: string, plain: string, rest: string) => {
    const version = linked ?? plain;
    return `## [${version}](${repoUrl}/releases/tag/v${version})${rest}`;
  });
}

// The pages.

export function pages(repoUrl: string, base: string): Page[] {
  const recordList = records();
  const changelog = source("CHANGELOG.md");
  const versions = changelog.headings
    .filter((h) => h.depth === 2)
    .map((h) => plainHeading(h.raw).replace(/\[([^\]]+)\]\([^)]*\)/, "$1"));

  return [
    {
      id: "how-it-works",
      title: "How it works",
      description:
        "How a scan previews your Pulumi and OpenTofu stacks, how a tick asks for a deploy, and how the deploy checks the preview again.",
      source: README,
      parts: [sectionPart(README, "How it works", { dropHeading: true })],
    },
    {
      id: "get-started",
      title: "Get started",
      description:
        "Add Sluiceway to a repo of infrastructure as code one step at a time: check your setup, scan read only, then add the whole workflow.",
      source: README,
      headerPicture: { picture: "first-run", alt: "The scan found no stacks yet" },
      parts: [
        sectionPart(README, "Get started", { dropHeading: true }),
        sectionPart(README, "Requirements"),
        sectionPart(README, "Setup"),
      ],
    },
    {
      id: "using-the-dashboard",
      title: "Using the dashboard",
      description:
        "How to read the dashboard's rows, tick to deploy a stack, read the job log, and the limits to know.",
      source: README,
      parts: [
        sectionPart(README, "Using the dashboard", { dropHeading: true }),
        sectionPart(README, "Reading the job log"),
        sectionPart(README, "Limits"),
      ],
    },
    {
      id: "guides/configuration",
      title: titleOf("docs/configuration.md"),
      description:
        "Every key of sluiceway.yaml, from who may tick to the opt-in drift check, with examples and the messages it gives.",
      source: "docs/configuration.md",
      parts: [wholeFile("docs/configuration.md")],
    },
    {
      id: "guides/credentials",
      title: titleOf("docs/credentials.md"),
      description:
        "How your workflow loads credentials for the tool, with recipes for the usual places they live.",
      source: "docs/credentials.md",
      parts: [wholeFile("docs/credentials.md")],
    },
    {
      id: "guides/example-workflows",
      title: titleOf("docs/example-workflows.md"),
      description:
        "Complete workflows for a Node monorepo, a secret manager and a cloud with OIDC, ready to copy.",
      source: "docs/example-workflows.md",
      parts: [
        wholeFile("docs/example-workflows.md"),
        generated("docs/example-workflows.md", exampleFiles()),
      ],
    },
    {
      id: "guides/notifications",
      title: titleOf("docs/notifications.md"),
      description:
        "The outputs and the result file a later step can use to tell people or chart numbers.",
      source: "docs/notifications.md",
      parts: [wholeFile("docs/notifications.md")],
    },
    {
      id: "guides/security",
      title: titleOf("docs/security.md"),
      description:
        "What a tick promises, who can tick, and how GitHub Environments make the gate stronger.",
      source: "docs/security.md",
      parts: [
        preamble("docs/security.md"),
        // The README's other promises are on this page already, in security.md's words.
        listItems(README, "What it promises", ["It never holds your credentials."]),
        fromFirstH2("docs/security.md"),
      ],
    },
    {
      id: "reference/sluiceway-yaml",
      title: "sluiceway.yaml",
      sidebarLabel: "sluiceway.yaml",
      description:
        "Every key of sluiceway.yaml with its type, default and allowed values, generated from the schema.",
      source: "schema/sluiceway.schema.json",
      parts: [
        generated(
          "schema/sluiceway.schema.json",
          configReference(readVendor("schema/sluiceway.schema.json", "The reference"), {
            guideAnchors: configurationAnchors(),
            guideUrl: `${base}/guides/configuration/`,
          }),
        ),
      ],
    },
    {
      id: "reference/action",
      title: "Action inputs and outputs",
      description: "The modes, inputs and outputs of the action, generated from its action.yml.",
      source: "action.yml",
      parts: [
        sectionPart(README, "Modes"),
        generated("action.yml", actionReference(readVendor("action.yml", "The reference"))),
      ],
    },
    {
      id: "reference/glossary",
      title: "Glossary",
      description:
        "The words Sluiceway uses for stacks, rows, ticks and deploys, what each one means, and the words it avoids.",
      source: "CONTEXT.md",
      termAnchors: true,
      parts: [wholeFile("CONTEXT.md")],
    },
    {
      id: "why",
      title: "Decision records",
      description:
        "The decision records behind Sluiceway, in number order: what was decided, and which later record amends or supersedes it.",
      source: "docs/adr",
      recordsContext: true,
      parts: [generated("docs/adr", recordIndex(recordList, base))],
    },
    ...recordList.map(
      (record): Page => ({
        id: recordId(record),
        title: record.title,
        sidebarLabel: `${record.number} ${record.title}`,
        description: recordDescription(record),
        source: record.file,
        recordsContext: true,
        eyebrow: `Decision record ${record.number}`,
        parts: [wholeFile(record.file)],
      }),
    ),
    {
      id: "onboarding-log",
      title: titleOf("docs/onboarding-log.md"),
      description:
        "Every hurdle a new user met while setting up Sluiceway, and what was done about it.",
      source: "docs/onboarding-log.md",
      parts: [wholeFile("docs/onboarding-log.md")],
    },
    {
      id: "not-in-v1",
      title: titleOf("docs/later.md"),
      description: "What Sluiceway does not do yet, and everything left out of v1 with the reason.",
      source: "docs/later.md",
      recordsContext: true,
      parts: [sectionPart(README, "What it does not do yet"), wholeFile("docs/later.md")],
    },
    {
      id: "what-v1-is",
      title: "What v1 is and the names it fixes",
      description:
        "What the first version of Sluiceway covers, and the names, defaults and fixed values it settles.",
      source: "docs/build-plan.md",
      recordsContext: true,
      parts: [
        // The rest of section 2 is about milestones and how the code is written.
        firstParagraph("docs/build-plan.md", "2. What v1 is", "What v1 is"),
        sectionPart("docs/build-plan.md", "3. Names fixed for v1", {
          retitle: "Names fixed for v1",
          // How the running action works out its own tag: the build, not the product.
          without: ["The action's own version and the image URLs"],
        }),
      ],
    },
    {
      id: "changelog",
      title: titleOf("CHANGELOG.md"),
      description:
        "Every release of Sluiceway, the GitHub Action, and what changed in it, newest first.",
      source: "CHANGELOG.md",
      parts: [
        generated(
          "CHANGELOG.md",
          `Versions: ${versions.map((v) => `[${v.split(" ")[0]}](#${githubSlug(v)})`).join(", ")}.`,
        ),
        wholeFile("CHANGELOG.md", (md) => changelogHeadings(md, repoUrl)),
      ],
    },
  ];
}

/** Where links to action files and headings land when no page heading holds them. */
export function covered(): Covered[] {
  const readme = source(README);
  const looks = section(readme.markdown, README, "What it looks like", 2, readme.headings);
  const slugs = githubSlugs(README);
  return [
    { link: README, page: SLICE_3.overview },
    { link: "docs/adr", page: "why" },
    { link: `${README}#inputs`, page: "reference/action#inputs" },
    { link: `${README}#outputs`, page: "reference/action#outputs" },
    ...(written(SLICE_3.whatItLooksLike)
      ? range(looks.first, looks.end).map((i) => ({
          link: `${README}#${slugs[i]}`,
          page: SLICE_3.whatItLooksLike,
        }))
      : []),
    ...exampleFileNames().map((name) => ({
      link: `examples/workflows/${name}`,
      page: `guides/example-workflows#${githubSlug(name)}`,
    })),
  ];
}

// The example workflows, each shown in full.

function exampleFileNames(): string[] {
  return readdirSync(vendorPath("examples/workflows")).sort();
}

const LANGUAGES: { [ext: string]: string } = { yml: "yaml", yaml: "yaml", sh: "bash" };

function exampleFiles(): string {
  const files = exampleFileNames().map((name) => {
    const text = readVendor(`examples/workflows/${name}`, "Example workflows").trimEnd();
    const lang = LANGUAGES[name.split(".").pop() ?? ""] ?? "text";
    const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length));
    const fence = "`".repeat(longest + 1);
    return `### ${name}\n\n${fence}${lang} title="${name}"\n${text}\n${fence}`;
  });
  return `## The files\n\n${files.join("\n\n")}`;
}

// The index of the decision records.

function recordIndex(list: DecisionRecord[], base: string): string {
  const byNumber = new Map(list.map((r) => [r.number, r]));
  const link = (n: string) => {
    const r = byNumber.get(n);
    return r ? `[${n}](${base}/${recordId(r)}/)` : n;
  };
  const rows = list.map((r) => {
    const changes = r.changes
      .map((c) => [c.kind, c.records.map(link).join(", ")].filter(Boolean).join(" "))
      .join("; ");
    return `| ${link(r.number)} | ${r.title.replace(/\|/g, "\\|")} | ${changes} |`;
  });
  return [
    "Each record explains one decision about Sluiceway and why it was made. A later record can amend or supersede an earlier one, and the last column says which.",
    "",
    "| Record | Decision | Amended or superseded |",
    "|---|---|---|",
    ...rows,
  ].join("\n");
}

// Where links land.

/** Turns a page id, with an optional `#fragment`, into its URL under `base` (such as `/docs`). */
export function urlFor(base: string): (id: string) => string {
  const root = base.replace(/\/$/, "");
  return (id) => {
    const [path = "", fragment] = id.split("#");
    const page = path ? `${root}/${path}/` : `${root}/`;
    return fragment ? `${page}#${fragment}` : page;
  };
}

/**
 * Every heading and file of the action that a page shows, to its URL on this site. `url` turns
 * a page id, with an optional `#fragment`, into a URL.
 */
export function siteMap(all: Page[], url: (id: string) => string): SiteMap {
  const site: SiteMap = { anchors: new Map(), files: new Map(), slugs: new Map() };
  for (const page of all) {
    if (!site.files.has(page.source) && page.source !== README) {
      site.files.set(page.source, url(page.id));
    }
    for (const part of page.parts) {
      if (part.headings.length === 0 && part.dropped === undefined) continue;
      const slugs = githubSlugs(part.from);
      site.slugs.set(part.from, new Set(slugs));
      for (const i of part.headings) {
        site.anchors.set(`${part.from}#${slugs[i]}`, url(`${page.id}#${slugs[i]}`));
      }
      if (part.dropped !== undefined) {
        site.anchors.set(`${part.from}#${slugs[part.dropped]}`, url(page.id));
      }
    }
  }
  for (const entry of covered()) {
    if (entry.link.includes("#")) site.anchors.set(entry.link, url(entry.page));
    else site.files.set(entry.link, url(entry.page));
  }
  return site;
}

// Slugs as GitHub makes them for a file's headings.

/** The id GitHub gives a heading with this text, without numbering repeats. */
export function githubSlug(text: string): string {
  return githubSlugOne(text);
}

/** The ids GitHub gives every heading of an action file, in order. */
export function githubSlugs(path: string): string[] {
  const slugger = new GithubSlugger();
  return source(path).headings.map((h) => slugger.slug(headingText(h.raw)));
}

/** A heading's text content, as the renderer and GitHub see it. */
export function headingText(raw: string): string {
  return plainHeading(raw)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** The configuration guide's heading for each key, such as `dashboard.title`. */
function configurationAnchors(): Map<string, string> {
  const path = "docs/configuration.md";
  const slugs = githubSlugs(path);
  const out = new Map<string, string>();
  source(path).headings.forEach((h, i) => {
    const slug = slugs[i];
    if (slug && /^`[^`]+`$/.test(h.raw)) out.set(plainHeading(h.raw), slug);
  });
  return out;
}

// The sidebar, in Starlight's shape.

type SidebarItem =
  | { label: string; link: string }
  | { slug: string; label?: string }
  | { label: string; collapsed?: boolean; items: SidebarItem[] };

export function sidebar(): SidebarItem[] {
  return [
    {
      label: "Start",
      items: [
        { label: "Overview", link: "/" },
        ...(written(SLICE_3.whatItLooksLike) ? [{ slug: SLICE_3.whatItLooksLike }] : []),
        { slug: "how-it-works" },
        { slug: "get-started" },
        { slug: "using-the-dashboard" },
      ],
    },
    {
      label: "Guides",
      items: [
        { slug: "guides/configuration" },
        { slug: "guides/credentials" },
        { slug: "guides/example-workflows" },
        { slug: "guides/notifications" },
        { slug: "guides/security" },
      ],
    },
    {
      label: "Reference",
      items: [
        { slug: "reference/sluiceway-yaml" },
        { slug: "reference/action" },
        { slug: "reference/glossary" },
        ...(written(SLICE_3.theHeader) ? [{ slug: SLICE_3.theHeader }] : []),
      ],
    },
    {
      label: "Why",
      items: [
        { slug: "why", label: "All decision records" },
        {
          label: "Records one by one",
          collapsed: true,
          items: records().map((r) => ({ slug: recordId(r) })),
        },
      ],
    },
    { label: "Known rough edges", items: [{ slug: "onboarding-log" }] },
    { label: "Not yet", items: [{ slug: "not-in-v1" }, { slug: "what-v1-is" }] },
    { label: "Changelog", items: [{ slug: "changelog" }] },
  ];
}
