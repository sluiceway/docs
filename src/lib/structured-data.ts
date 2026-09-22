// The JSON-LD the pages carry, one script per kind: SoftwareApplication on the start page and
// a BreadcrumbList on every docs page. There is no FAQPage: no page of the action at the
// pinned tag is questions with answers under them, and none is written here to earn the
// markup.

import { readVendor } from "./markdown";

/** A sidebar entry in the shape Starlight hands to route middleware. */
export type SidebarEntry =
  | { type: "link"; label: string; href: string; isCurrent: boolean }
  | { type: "group"; label: string; entries: SidebarEntry[] };

export interface Crumb {
  name: string;
  /** Absolute. */
  url: string;
}

/**
 * Home, the sidebar group the current page is in, and the page. The group is named with its
 * first page's URL, since a group has no page of its own. The group is left out when that URL
 * is the home page or the page itself, so no crumb repeats another.
 */
export function breadcrumbs(
  sidebar: SidebarEntry[],
  home: Crumb,
  page: Crumb,
  absolute: (href: string) => string,
): Crumb[] {
  const crumbs: Crumb[] = [home];
  const group = sidebar.find(
    (entry): entry is Extract<SidebarEntry, { type: "group" }> =>
      entry.type === "group" && holdsCurrent(entry),
  );
  const first = group && firstLink(group);
  if (group && first) {
    const url = absolute(first.href);
    if (url !== home.url && url !== page.url) crumbs.push({ name: group.label, url });
  }
  crumbs.push(page);
  return crumbs;
}

function holdsCurrent(entry: SidebarEntry): boolean {
  return entry.type === "link" ? entry.isCurrent : entry.entries.some(holdsCurrent);
}

function firstLink(entry: SidebarEntry): Extract<SidebarEntry, { type: "link" }> | undefined {
  if (entry.type === "link") return entry;
  for (const child of entry.entries) {
    const found = firstLink(child);
    if (found) return found;
  }
  return undefined;
}

export function breadcrumbList(crumbs: Crumb[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

export interface Application {
  description: string;
  version: string;
  url: string;
  repository: string;
  image: string;
}

export function softwareApplication(app: Application): object {
  const runners = supportedRunners();
  const tools = supportedTools();
  return {
    "@context": "https://schema.org",
    // Also SoftwareSourceCode, the type that has `codeRepository`: the action is its code.
    "@type": ["SoftwareApplication", "SoftwareSourceCode"],
    name: "Sluiceway",
    description: app.description,
    applicationCategory: "DeveloperApplication",
    ...(runners ? { operatingSystem: runners } : {}),
    ...(tools ? { keywords: ["GitHub Action", ...tools].join(", ") } : {}),
    softwareVersion: app.version,
    license: "https://www.apache.org/licenses/LICENSE-2.0",
    url: app.url,
    codeRepository: app.repository,
    sameAs: [app.repository],
    image: app.image,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

/**
 * The runners the reference's Requirements list names, such as "GitHub Actions runners with
 * runner version 2.328.0 or newer", or undefined when the list no longer says.
 */
export function supportedRunners(): string | undefined {
  const reference = readVendor("docs/reference.md", "The start page's structured data");
  const line = /^- \*\*(GitHub Actions runners[^*]*?)\.?\*\*/m.exec(reference);
  return line?.[1];
}

/**
 * The tools the README's "What it does" lists, such as "Pulumi" and "Kubernetes manifests":
 * the items whose bold lead goes on with ", with" or ", also behind". A lead of two tools
 * ("OpenTofu and Terraform") gives both, and the wrappers named after "also behind" follow.
 * Undefined when there is none. Only a tool the pinned text names becomes a keyword.
 */
export function supportedTools(): string[] | undefined {
  const readme = readVendor("README.md", "The start page's structured data");
  const start = readme.indexOf("\n## What it does\n");
  if (start === -1) return undefined;
  const rest = readme.slice(start + 1);
  const end = rest.indexOf("\n## ");
  const section = end === -1 ? rest : rest.slice(0, end);
  const tools = [
    ...section.matchAll(/^- \*\*([^*]+)\*\*, (?:also behind ([^,]+), )?with\b/gm),
  ].flatMap(([, lead = "", wrappers]) => [
    ...lead.split(" and "),
    ...(wrappers ? wrappers.split(" or ") : []),
  ]);
  return tools.length > 0 ? tools : undefined;
}

/** JSON for inside a <script>, with `<` escaped so no string can close the element. */
export function scriptJson(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
