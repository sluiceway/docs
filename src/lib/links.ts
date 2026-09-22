// Rewriting the rendered HTML of the action's Markdown: relative links go to the page that
// shows what they point at, or to the file on GitHub at the pinned tag, and record numbers link to
// their records. Works on HTML, after rendering, so code blocks are never touched: the
// renderer has already escaped them.

import { existsSync, statSync } from "node:fs";
import { posix } from "node:path";
import { REPO_URL, sourceUrl, TAG, vendorPath } from "./source";

export interface SiteMap {
  /** `path#github-slug` of an action file's heading, to the URL on this site that shows it. */
  anchors: Map<string, string>;
  /** An action file or directory, to the URL of the page that shows it whole. */
  files: Map<string, string>;
  /** Every heading id GitHub gives an action file, for telling a missing heading apart. */
  slugs: Map<string, Set<string>>;
  /**
   * Every page id, to its URL and the heading ids it shows. No ids means the page has ids this
   * map cannot know before rendering (a page written here, the glossary's terms): any fragment.
   */
  pages: Map<string, { url: string; ids?: Set<string> }>;
}

/** The live site. The action links to it by full URL, and those links land on this build. */
export const LIVE_SITE = "https://docs.sluiceway.dev/";

export interface Resolved {
  url: string;
  /** Set when the link points at a heading the file does not have. */
  warning?: string;
}

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** Where a link in `from` (an action file) should go. */
export function resolveLink(href: string, from: string, site: SiteMap): Resolved {
  if (href.startsWith(LIVE_SITE)) return liveLink(href, from, site);
  if (EXTERNAL.test(href) || href.startsWith("/")) return { url: href };
  const hash = href.indexOf("#");
  const pathPart = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? "" : decodeURIComponent(href.slice(hash + 1));
  const path = pathPart
    ? posix.normalize(posix.join(posix.dirname(from), pathPart)).replace(/\/$/, "")
    : from;
  if (path.startsWith("..")) return { url: href };

  if (fragment) {
    const hit = site.anchors.get(`${path}#${fragment}`);
    if (hit) return { url: hit };
    const known = site.slugs.get(path);
    if (known && !known.has(fragment)) {
      return {
        url: site.files.get(path) ?? githubUrl(path, fragment),
        warning: `${from} links to ${href}, and ${path} has no heading with the id "${fragment}".`,
      };
    }
    return { url: githubUrl(path, fragment), warning: missing(path, from, href) };
  }
  return { url: site.files.get(path) ?? githubUrl(path), warning: missing(path, from, href) };
}

/**
 * A link to a page of the live site goes to the same page of this build, which shows the same
 * pinned tag and works under any base. A page or heading this build does not have is a warning.
 */
function liveLink(href: string, from: string, site: SiteMap): Resolved {
  const [path = "", fragment = ""] = href.slice(LIVE_SITE.length).split("#");
  const id = path.replace(/\/$/, "");
  const page = site.pages.get(id);
  if (!page) {
    return { url: href, warning: `${from} links to ${href}, and this site has no page ${id}.` };
  }
  const known = !fragment || !page.ids || page.ids.has(decodeURIComponent(fragment));
  return {
    url: fragment ? `${page.url}#${fragment}` : page.url,
    warning: known ? undefined : `${from} links to ${href}, and that page has no id "${fragment}".`,
  };
}

/** A warning when the linked file is not in the action at the pinned tag. */
function missing(path: string, from: string, href: string): string | undefined {
  if (existsSync(vendorPath(path))) return undefined;
  return `${from} links to ${href}, and the action has no ${path} at ${TAG}.`;
}

/** A file or directory of the action on GitHub, at the pinned tag. */
export function githubUrl(path: string, fragment = ""): string {
  const file = vendorPath(path);
  const isDir = existsSync(file) && statSync(file).isDirectory();
  const url = isDir ? `${REPO_URL}/tree/${TAG}/${path}` : sourceUrl(path);
  return fragment ? `${url}#${fragment}` : url;
}

/** An image of the action at the pinned tag, served as an image. */
export function imageUrl(src: string, from: string): string {
  if (EXTERNAL.test(src) || src.startsWith("/")) return src;
  const path = posix.normalize(posix.join(posix.dirname(from), src));
  if (path.startsWith("..")) return src;
  return `https://raw.githubusercontent.com/sluiceway/sluiceway/${TAG}/${path}`;
}

function decode(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function encode(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Rewrites every relative `href`, `src` and `srcset` in the HTML of Markdown from `from`. */
export function rewriteLinks(
  html: string,
  from: string,
  site: SiteMap,
  warn: (message: string) => void = () => {},
): string {
  return html.replace(/<(a|img|source)\b[^>]*>/gi, (tag, name: string) => {
    if (name.toLowerCase() === "a") {
      return tag.replace(/\shref="([^"]*)"/, (_, value: string) => {
        const { url, warning } = resolveLink(decode(value), from, site);
        if (warning) warn(warning);
        return ` href="${encode(url)}"`;
      });
    }
    return tag
      .replace(
        /\ssrc="([^"]*)"/,
        (_, value: string) => ` src="${encode(imageUrl(decode(value), from))}"`,
      )
      .replace(/\ssrcset="([^"]*)"/, (_, value: string) => {
        const set = decode(value)
          .split(",")
          .map((entry) => {
            const [url = "", ...size] = entry.trim().split(/\s+/);
            return [imageUrl(url, from), ...size].join(" ");
          })
          .join(", ");
        return ` srcset="${encode(set)}"`;
      });
  });
}

// Record numbers.

export interface RecordLinks {
  /** A record number such as `0054`, to the URL of its page. */
  urls: Map<string, string>;
  /** Also link numbers in parentheses and at the start of table cells: on the records' own pages. */
  recordsContext: boolean;
  /** The record the page is, which never links to itself. */
  self?: string;
}

// Elements whose text is never linked: links, code, headings, and what is not text.
const SKIP = new Set([
  "a",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "script",
  "style",
  "svg",
]);

const LIST = String.raw`\d{4}(?:(?:, | and | or |, and )\d{4})*`;
/** "record 0054", "records 0038 and 0039", anywhere. */
const NAMED = new RegExp(String.raw`\b([Rr]ecords? )(${LIST})\b`, "g");
/** "(0038)", "(0010, 0051)", "Amended by 0055", "Superseded in part by 0047". */
const BARE = new RegExp(
  String.raw`(\((?:see )?|\b(?:Amended|Superseded)(?: in part)? by |\bby )(${LIST})(?=[),;:. ]|$)`,
  "g",
);
/** A table cell that starts with record numbers: "0053, the adapter research". */
const CELL = new RegExp(String.raw`^(\s*)(${LIST})(?=,|\s*$)`);

function linkNumbers(list: string, links: RecordLinks): string {
  return list.replace(/\d{4}/g, (n) => {
    const url = links.urls.get(n);
    return url && n !== links.self ? `<a href="${url}">${n}</a>` : n;
  });
}

/**
 * Links record numbers in the text of the HTML. Conservative: only after the word "record",
 * and on pages about records also in parentheses, after "Amended by", and at the start of a
 * table cell. A number with no record stays text.
 */
export function linkRecords(html: string, links: RecordLinks): string {
  const parts = html.split(/(<[^>]+>)/);
  const open: string[] = [];
  let cellStart = false;
  return parts
    .map((part) => {
      if (part.startsWith("<")) {
        const tag = /^<\/?([a-z0-9]+)/i.exec(part)?.[1]?.toLowerCase();
        if (tag && SKIP.has(tag) && !part.endsWith("/>")) {
          if (part.startsWith("</")) {
            const at = open.lastIndexOf(tag);
            if (at !== -1) open.splice(at, 1);
          } else {
            open.push(tag);
          }
        }
        if (tag === "td") cellStart = !part.startsWith("</");
        return part;
      }
      const atCellStart = cellStart;
      if (part.trim()) cellStart = false;
      if (open.length > 0 || !part) return part;
      let text = part.replace(
        NAMED,
        (_, word: string, list: string) => word + linkNumbers(list, links),
      );
      if (links.recordsContext) {
        text = text.replace(
          BARE,
          (match, lead: string, list: string, offset: number, whole: string) =>
            insideLink(whole, offset) ? match : lead + linkNumbers(list, links),
        );
        if (atCellStart && !text.includes("<a ")) {
          text = text.replace(
            CELL,
            (_, space: string, list: string) => space + linkNumbers(list, links),
          );
        }
      }
      return text;
    })
    .join("");
}

/** Whether `offset` in text already rewritten by NAMED sits inside an inserted link. */
function insideLink(text: string, offset: number): boolean {
  const before = text.slice(0, offset);
  return before.lastIndexOf("<a ") > before.lastIndexOf("</a>");
}
