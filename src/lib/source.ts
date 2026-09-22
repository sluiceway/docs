// The pin. The docs read the action's files from the git submodule at vendor/sluiceway, which
// is checked out at a release tag. This module is the only place that knows the tag, and
// every link or file the site takes from the action goes through it.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/** The action's repository. */
export const REPO_URL = "https://github.com/sluiceway/sluiceway";

/** This repository, for pages written here rather than read from the action. */
export const DOCS_REPO_URL = "https://github.com/sluiceway/docs";

/** The branch that pages written in this repository link to. */
export const DOCS_REF = "main";

/** The submodule's checkout, absolute. Astro runs from the project root. */
export const VENDOR_DIR = resolve(process.cwd(), "vendor/sluiceway");

function readTag(): string {
  if (!existsSync(join(VENDOR_DIR, ".git"))) {
    throw new Error(
      "vendor/sluiceway is missing. Run `git submodule update --init` " +
        "(or clone with --recurse-submodules) before building the docs.",
    );
  }
  try {
    // A release commit also carries the moving major tag, such as `v0`. Only a full release
    // tag counts as the pin.
    const args = ["describe", "--tags", "--exact-match", "--match", "v[0-9]*.[0-9]*.[0-9]*"];
    return execFileSync("git", ["-C", VENDOR_DIR, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error(
      "vendor/sluiceway is not checked out at a release tag. " +
        "Check the submodule out at a tag, for example `git -C vendor/sluiceway checkout v0.7.0`. " +
        "In CI, check out with `submodules: true` and `fetch-depth: 0` so the tags are fetched.",
    );
  }
}

/** The release tag the submodule is checked out at, such as `v0.7.0`. */
export const TAG = readTag();

/** The pinned version without the `v`, such as `0.7.0`. */
export const VERSION = TAG.replace(/^v/, "");

/** A file in the action's repository at the pinned tag, for example `sourceUrl("docs/configuration.md")`. */
export function sourceUrl(path: string): string {
  return `${REPO_URL}/blob/${TAG}/${path.replace(/^\/+/, "")}`;
}

/** A file in this repository on `main`. */
export function docsSourceUrl(path: string): string {
  return `${DOCS_REPO_URL}/blob/${DOCS_REF}/${path.replace(/^\/+/, "")}`;
}

/** An absolute path to a file inside the submodule. */
export function vendorPath(path: string): string {
  return join(VENDOR_DIR, path);
}

export interface PageSource {
  /** The path shown to the reader. */
  path: string;
  /** The tag or branch the link points at. */
  ref: string;
  href: string;
}

/**
 * Where a page's words come from. A page read from the action names its file in frontmatter
 * `source:` and links to it at the pinned tag. A page written here links to its own file.
 */
export function pageSource(source: string | undefined, ownFile: string): PageSource {
  if (source) return { path: source, ref: TAG, href: sourceUrl(source) };
  return { path: ownFile, ref: DOCS_REF, href: docsSourceUrl(ownFile) };
}
