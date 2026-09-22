// Checks every link inside the built site in dist/. A link to a page, file or heading on this
// site must land on something the build wrote. Links to other sites are left to the links
// workflow, which runs lychee, because they depend on the network.
//
// It reads the same DOCS_SITE and DOCS_BASE as the build, so run it after `bun run build` with
// the same environment: `bun run build && bun run links`. CI runs it for each address.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = "dist";
// The same defaults as astro.config.ts.
const SITE = process.env.DOCS_SITE || "https://sluiceway.github.io";
const BASE = process.env.DOCS_BASE ?? "/docs";
const base = BASE.replace(/\/+$/, "");
const origin = new URL(SITE).origin;

// Attributes that point at something the browser fetches or opens.
const LINK_ATTRIBUTES: Record<string, string[]> = {
  a: ["href"],
  area: ["href"],
  link: ["href"],
  script: ["src"],
  img: ["src", "srcset"],
  source: ["src", "srcset"],
  video: ["src", "poster"],
  audio: ["src"],
  iframe: ["src"],
  form: ["action"],
};

// Starlight's own canonical and social links carry the page's full URL on the site.
const META_URLS = new Set(["og:url", "og:image", "twitter:image"]);

interface Link {
  page: string;
  url: string;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

/** The URL a file in dist/ is served at, such as `/docs/style-check/`. */
function pageUrl(file: string): string {
  const path = relative(DIST, file).split("\\").join("/");
  const served = path === "index.html" ? "" : path.replace(/(^|\/)index\.html$/, "$1");
  return `${origin}${base}/${served}`;
}

function srcsetUrls(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

async function scan(file: string, links: Link[], ids: Map<string, Set<string>>) {
  const page = pageUrl(file);
  const found = new Set<string>();
  let rewriter = new HTMLRewriter().on("[id], a[name]", {
    element(el) {
      const id = el.getAttribute("id") ?? el.getAttribute("name");
      if (id) found.add(id);
    },
  });
  for (const [tag, attributes] of Object.entries(LINK_ATTRIBUTES)) {
    rewriter = rewriter.on(tag, {
      element(el) {
        for (const attribute of attributes) {
          const value = el.getAttribute(attribute);
          if (value === null) continue;
          const urls = attribute === "srcset" ? srcsetUrls(value) : [value.trim()];
          for (const url of urls) links.push({ page, url });
        }
      },
    });
  }
  rewriter = rewriter.on("meta[property]", {
    element(el) {
      const content = el.getAttribute("content");
      if (content && META_URLS.has(el.getAttribute("property") ?? "")) {
        links.push({ page, url: content });
      }
    },
  });
  await rewriter.transform(new Response(readFileSync(file))).text();
  ids.set(page, found);
}

/** The file in dist/ that serves a path under the base, or undefined when there is none. */
function servedFile(path: string): string | undefined {
  const inside = decodeURIComponent(path.slice(base.length)).replace(/^\/+/, "");
  const candidates = inside === "" ? ["index.html"] : [inside, join(inside, "index.html")];
  if (!inside.endsWith("/") && !/\.[a-z0-9]+$/i.test(inside)) candidates.push(`${inside}.html`);
  return candidates.map((c) => join(DIST, c)).find((c) => existsSync(c) && statSync(c).isFile());
}

function problem(link: Link, ids: Map<string, Set<string>>): string | undefined {
  if (link.url === "" || /^(mailto|tel|javascript|data|blob):/i.test(link.url)) return;
  let url: URL;
  try {
    url = new URL(link.url, link.page);
  } catch {
    return "is not a valid URL";
  }
  if (url.origin !== origin) return;
  if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) {
    return `is outside the site, which lives under ${base || "/"}`;
  }
  const file = servedFile(url.pathname);
  // Starlight gives 404.html a canonical URL of /404/, which Pages never serves. The page is
  // shown for every missing path, so its own URL does not matter.
  if (!file && link.page.endsWith("/404.html") && url.pathname === `${base}/404/`) return;
  if (!file) return "points at a page or file the build did not write";
  if (!url.hash || url.hash === "#") return;
  if (!file.endsWith(".html")) return;
  const target = pageUrl(file);
  const id = decodeURIComponent(url.hash.slice(1));
  if (!ids.get(target)?.has(id)) return `points at #${id}, which is not on ${target}`;
}

if (!existsSync(DIST)) {
  console.error("dist/ is missing. Run `bun run build` first.");
  process.exit(1);
}

const links: Link[] = [];
const ids = new Map<string, Set<string>>();
const files = htmlFiles(DIST);
for (const file of files) await scan(file, links, ids);

const problems = links.flatMap((link) => {
  const reason = problem(link, ids);
  return reason ? [`${link.page}: ${link.url} ${reason}`] : [];
});

if (problems.length > 0) {
  console.error(`Found ${problems.length} broken link(s) in dist/:`);
  for (const line of [...new Set(problems)]) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`Checked ${links.length} links on ${files.length} pages. All of them land.`);
