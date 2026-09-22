// Checks the built site in dist/ for what search engines and link previews read: one title
// and one description per page, canonical and social tags on the site's own address, headings
// in order, images with alt text and a size, the JSON-LD, the sitemap and robots.txt.
//
// It reads the same DOCS_SITE and DOCS_BASE as the build, so run it after `bun run build`
// with the same environment. `bun run check` builds first.

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { SHARE_IMAGE } from "../src/lib/share-image";
import { UNLISTED } from "../src/lib/site";

const DIST = "dist";
// The same defaults as astro.config.ts.
const SITE = process.env.DOCS_SITE || "https://sluiceway.github.io";
const BASE = (process.env.DOCS_BASE ?? "/docs").replace(/\/+$/, "");
const ROOT = `${new URL(SITE).origin}${BASE}/`;

if (!existsSync(join(DIST, "index.html"))) {
  throw new Error("dist/ has no build. Run `bun run build` before `bun test`.");
}

interface Built {
  file: string;
  /** The page's URL on the site, such as `https://docs.sluiceway.dev/get-started/`. */
  url: string;
  titles: string[];
  descriptions: string[];
  canonicals: string[];
  meta: Map<string, string[]>;
  jsonLd: unknown[];
  h1s: number;
  /** Heading levels inside <main>, in document order. */
  outline: number[];
  images: Record<string, string | null>[];
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "pagefind" ? [] : htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

function urlOf(file: string): string {
  const path = relative(DIST, file).split("\\").join("/");
  if (path === "404.html") return `${ROOT}404/`;
  return ROOT + path.replace(/(^|\/)index\.html$/, "$1");
}

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', "#39": "'", lt: "<", gt: ">" };

/** HTMLRewriter hands attribute values over as written, entities and all. */
function decode(value: string): string {
  return value.replace(/&(amp|quot|#39|lt|gt);/g, (_, name: string) => ENTITIES[name] ?? "");
}

async function read(file: string): Promise<Built> {
  const built: Built = {
    file,
    url: urlOf(file),
    titles: [],
    descriptions: [],
    canonicals: [],
    meta: new Map(),
    jsonLd: [],
    h1s: 0,
    outline: [],
    images: [],
  };
  let title = "";
  let script = "";
  const rewriter = new HTMLRewriter()
    .on("head > title", {
      element(el) {
        title = "";
        el.onEndTag(() => {
          built.titles.push(title);
        });
      },
      text(chunk) {
        title += chunk.text;
      },
    })
    .on("meta", {
      element(el) {
        const key = el.getAttribute("property") ?? el.getAttribute("name");
        const raw = el.getAttribute("content");
        if (!key || raw === null) return;
        const content = decode(raw);
        if (key === "description") built.descriptions.push(content);
        built.meta.set(key, [...(built.meta.get(key) ?? []), content]);
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        built.canonicals.push(el.getAttribute("href") ?? "");
      },
    })
    .on('script[type="application/ld+json"]', {
      element(el) {
        script = "";
        el.onEndTag(() => {
          built.jsonLd.push(JSON.parse(script));
        });
      },
      text(chunk) {
        script += chunk.text;
      },
    })
    .on("h1", {
      element() {
        built.h1s++;
      },
    })
    .on("main h1, main h2, main h3, main h4, main h5, main h6", {
      element(el) {
        built.outline.push(Number(el.tagName.slice(1)));
      },
    })
    .on("img", {
      element(el) {
        const attrs: Record<string, string | null> = {};
        // An empty attribute reads as null, so presence is checked on its own.
        for (const name of ["src", "alt", "width", "height", "aria-hidden"]) {
          attrs[name] = el.hasAttribute(name) ? (el.getAttribute(name) ?? "") : null;
        }
        attrs.src = attrs.src?.slice(0, 80) ?? null;
        built.images.push(attrs);
      },
    });
  await rewriter.transform(new Response(readFileSync(file))).text();
  return built;
}

const built = await Promise.all(htmlFiles(DIST).sort().map(read));
const byUrl = new Map(built.map((b) => [b.url, b]));
const unlisted = new Set(UNLISTED.map((id) => `${ROOT}${id}/`));
const listed = built.filter((b) => !unlisted.has(b.url));
const isRecord = (b: Built) => /\/why\/\d{4}-/.test(b.url);

function one(b: Built, key: string): string {
  const values = b.meta.get(key) ?? [];
  expect(values, `${b.url} ${key}`).toHaveLength(1);
  return values[0] ?? "";
}

describe("titles and descriptions", () => {
  test.each(built.map((b) => [b.url, b] as const))("%s", (_, b) => {
    expect(b.titles).toHaveLength(1);
    expect(b.descriptions).toHaveLength(1);
    const description = b.descriptions[0] ?? "";
    expect(description.length).toBeGreaterThanOrEqual(70);
    expect(description.length).toBeLessThanOrEqual(160);
    // Decision records keep their own titles, which the action writes; every other title is
    // about 60 characters at most.
    if (!isRecord(b)) expect((b.titles[0] ?? "").length).toBeLessThanOrEqual(60);
  });

  test("no two pages share a title", () => {
    const seen = new Map<string, string>();
    for (const b of built) {
      const title = b.titles[0] ?? "";
      expect(seen.get(title), `${b.url} and ${seen.get(title)}: "${title}"`).toBeUndefined();
      seen.set(title, b.url);
    }
  });

  test("the start page says what the product is", () => {
    const start = byUrl.get(ROOT);
    expect(start?.titles[0]).toBe("Sluiceway: a deploy dashboard in one GitHub issue");
  });
});

describe("canonical and social tags", () => {
  test.each(listed.map((b) => [b.url, b] as const))("%s", (_, b) => {
    expect(b.canonicals).toEqual([b.url]);
    expect(one(b, "og:url")).toBe(b.url);
    expect(one(b, "og:title").length).toBeGreaterThan(0);
    expect(one(b, "og:description")).toBe(b.descriptions[0] ?? "");
    expect(one(b, "og:type")).toBe(b.url === ROOT ? "website" : "article");
    expect(one(b, "og:site_name")).toBe("Sluiceway");
    const image = `${ROOT}${SHARE_IMAGE.path}`;
    expect(one(b, "og:image")).toBe(image);
    expect(one(b, "og:image:width")).toBe(String(SHARE_IMAGE.width));
    expect(one(b, "og:image:height")).toBe(String(SHARE_IMAGE.height));
    expect(one(b, "og:image:alt")).toBe(SHARE_IMAGE.alt);
    expect(one(b, "twitter:card")).toBe("summary_large_image");
    expect(one(b, "twitter:image")).toBe(image);
    expect(b.meta.get("robots")).toBeUndefined();
  });

  test("unlisted pages carry noindex", () => {
    for (const url of unlisted) expect(byUrl.get(url)?.meta.get("robots")).toEqual(["noindex"]);
  });

  test("the share image is a 1200 by 630 PNG", () => {
    const png = readFileSync(join(DIST, SHARE_IMAGE.path));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(SHARE_IMAGE.width);
    expect(png.readUInt32BE(20)).toBe(SHARE_IMAGE.height);
  });
});

describe("headings and images", () => {
  test.each(built.map((b) => [b.url, b] as const))("%s", (_, b) => {
    expect(b.h1s).toBe(1);
    expect(b.outline[0]).toBe(1);
    b.outline.forEach((level, i) => {
      const previous = b.outline[i - 1] ?? 0;
      expect(
        level,
        `heading ${i + 1} of ${b.url}: h${previous} then h${level}`,
      ).toBeLessThanOrEqual(previous + 1);
    });
    for (const img of b.images) {
      expect(img.alt, `${b.url} ${img.src}`).not.toBeNull();
      expect(img.width, `${b.url} ${img.src}`).toMatch(/^\d+$/);
      expect(img.height, `${b.url} ${img.src}`).toMatch(/^\d+$/);
      // An empty alt is decorative on purpose, and says so.
      if (img.alt === "") expect(img["aria-hidden"], `${b.url} ${img.src}`).toBe("true");
    }
  });
});

describe("JSON-LD", () => {
  const types = (b: Built) =>
    b.jsonLd.map((d) => {
      const type = (d as { "@type": string | string[] })["@type"];
      return Array.isArray(type) ? type[0] : type;
    });

  test("one script per kind, and never FAQPage", () => {
    for (const b of built) {
      expect(new Set(types(b)).size, b.url).toBe(b.jsonLd.length);
      expect(types(b)).not.toContain("FAQPage");
      for (const d of b.jsonLd)
        expect((d as { "@context": string })["@context"]).toBe("https://schema.org");
    }
  });

  test("the start page is a SoftwareApplication", () => {
    const start = byUrl.get(ROOT);
    expect(start && types(start)).toEqual(["SoftwareApplication"]);
    const app = start?.jsonLd[0] as Record<string, unknown>;
    expect(app.name).toBe("Sluiceway");
    expect(app.applicationCategory).toBe("DeveloperApplication");
    expect(app.softwareVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(app.license).toBe("https://www.apache.org/licenses/LICENSE-2.0");
    expect(app.url).toBe(ROOT);
    expect(app.codeRepository).toBe("https://github.com/sluiceway/sluiceway");
    expect(app.image).toBe(`${ROOT}${SHARE_IMAGE.path}`);
    expect(app.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "USD" });
    expect(String(app.description)).toStartWith("Sluiceway keeps one GitHub issue");
    expect(String(app.operatingSystem)).toStartWith("GitHub Actions runners");
    expect(String(app.keywords)).toStartWith("GitHub Action, Pulumi, OpenTofu");
  });

  test("every docs page has a BreadcrumbList from home to itself", () => {
    const docs = listed.filter((b) => b.url !== ROOT);
    expect(docs.length).toBeGreaterThan(20);
    for (const b of docs) {
      expect(types(b), b.url).toEqual(["BreadcrumbList"]);
      const items = (b.jsonLd[0] as { itemListElement: Record<string, unknown>[] }).itemListElement;
      expect(items.map((i) => i.position)).toEqual(items.map((_, i) => i + 1));
      expect(items[0]?.item).toBe(ROOT);
      expect(items.at(-1)?.item).toBe(b.url);
      expect(items.at(-1)?.name).toBe(one(b, "og:title"));
      for (const item of items) {
        expect(item["@type"]).toBe("ListItem");
        expect(String(item.item)).toStartWith(ROOT);
      }
    }
  });

  test("a page in a group has the group in between", () => {
    const ld = byUrl.get(`${ROOT}guides/credentials/`)?.jsonLd[0];
    const items = (ld as { itemListElement: { name: string; item: string }[] }).itemListElement;
    expect(items.map((i) => i.name)).toEqual([
      "Sluiceway docs",
      "Guides",
      "Credentials and your own tooling",
    ]);
    expect(items[1]?.item).toBe(`${ROOT}guides/configuration/`);
  });
});

describe("sitemap and robots.txt", () => {
  test("the sitemap lists every page but the unlisted ones", () => {
    const index = readFileSync(join(DIST, "sitemap-index.xml"), "utf8");
    expect(index).toContain(`<loc>${ROOT}sitemap-0.xml</loc>`);
    const xml = readFileSync(join(DIST, "sitemap-0.xml"), "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
    expect(locs).toEqual(listed.map((b) => b.url).sort());
  });

  test("robots.txt allows everything and names the sitemap", () => {
    const robots = readFileSync(join(DIST, "robots.txt"), "utf8");
    expect(robots).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${ROOT}sitemap-index.xml\n`);
  });
});
