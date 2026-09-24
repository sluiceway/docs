# Sluiceway docs

The documentation site for [Sluiceway](https://github.com/sluiceway/sluiceway), the GitHub Action that keeps one issue showing which infrastructure stacks have changes waiting, and deploys a stack when you tick its box. The site is built with Astro Starlight and published at https://docs.sluiceway.dev/.

## Run it locally

You need [Bun](https://bun.sh) at the version in `.bun-version`, and git.

```sh
git clone --recurse-submodules https://github.com/sluiceway/docs.git
cd docs
bun install
bun run dev
```

If you cloned without `--recurse-submodules`, run `git submodule update --init` first. The build stops with an error when the submodule is missing or not checked out at a release tag.

Other scripts:

| Script | What it does |
| --- | --- |
| `bun run build` | Builds the site into `dist/`. |
| `bun run preview` | Serves the built site. |
| `bun run serve` | Serves `dist/` the way GitHub Pages does, at http://localhost:4321 under `DOCS_BASE`. |
| `bun run lint` | Checks formatting and lint with Biome. `bun run lint:fix` fixes what it can. |
| `bun run typecheck` | Runs `astro check`. |
| `bun run test` | Runs the tests. Some of them read the built site, so build first, with the same `DOCS_SITE` and `DOCS_BASE`. |
| `bun run check` | Lint, the tokens check, the pin check, the release check, typecheck, build and the tests. CI runs this. |
| `bun run links` | Checks every link and anchor inside `dist/`, offline. Run it after a build, with the same `DOCS_SITE` and `DOCS_BASE`. |
| `bun run lighthouse` | Runs Lighthouse on a production build. See [Search and sharing](#search-and-sharing). |
| `bun run pin` | Checks that the submodule is at a release tag and that `.gitmodules` names the same tag. |
| `bun run release` | Warns when the pin is behind the action's latest release. Never fails. See [Updating to a new release of Sluiceway](#updating-to-a-new-release-of-sluiceway). |
| `bun run tokens` | Writes `src/styles/tokens.css` from `src/styles/tokens.json`. |

The site URL comes from two environment variables: `DOCS_SITE` (default `https://sluiceway.github.io`) and `DOCS_BASE` (default `/docs`).

## Deploying

Every push to `main` builds the site and deploys it to GitHub Pages (`.github/workflows/pages.yml`). You can also start the workflow by hand from the Actions tab.

The site is at https://docs.sluiceway.dev/, the custom domain in the repository's Pages settings. The Pages address, https://sluiceway.github.io/docs/, redirects to it and keeps the path. Two repository variables decide which address the build uses, and both are set for the custom domain:

| Variable | Unset | With the custom domain |
| --- | --- | --- |
| `DOCS_SITE` | `https://sluiceway.github.io` | `https://docs.sluiceway.dev` |
| `DOCS_BASE` | `/docs` | `/` |

The domain itself lives in the repository's Pages settings, not in a `CNAME` file. To move the site, set the domain there, set both variables, and run the workflow.

CI builds the site under both addresses and checks every internal link and anchor. A weekly workflow (`.github/workflows/links.yml`) checks the external links and opens an issue when some fail.

## Search and sharing

Every page has one title and one description. The pages read from the action take theirs from `src/lib/pages.ts`: the title is usually the file's own heading, and the description is written there, in the product's words, 70 to 160 characters. A decision record's description is made from its title. The pages written here set both in their frontmatter. A title longer than about 60 characters with " | Sluiceway" after it drops that suffix, which only happens to decision records.

`src/route-data.ts` adds what Starlight does not: the self-hosted fonts and their preloads, the share image tags, `og:type`, and the JSON-LD (a `SoftwareApplication` on the start page, a `BreadcrumbList` on every other page).

The share image, `share.png`, is Penny's `in-sync` header in light from the action's `assets/mascot` at the pinned tag, placed on a 1200 by 630 ground and rendered with resvg on every build (`src/lib/share-image.ts`). A new release of the art changes it with no work here.

The sitemap (`sitemap-index.xml`) and `robots.txt` follow `DOCS_SITE` and `DOCS_BASE`. The pages in `UNLISTED` in `src/lib/site.ts` (the 404 and the style check) carry `noindex` and stay out of the sitemap. `test/built-site.test.ts` checks all of this in `dist/`.

The `lighthouse` job in CI builds with the production address and runs Lighthouse three times on each URL in `lighthouserc.json`, as a phone. It fails when a median score for performance, accessibility, best practices or SEO is under 90 on any of them, and keeps the reports as the `lighthouse` artifact. To run it locally you need Chrome:

```sh
DOCS_SITE=https://docs.sluiceway.dev DOCS_BASE=/ bun run build
bun run lighthouse
bun scripts/lighthouse-summary.ts
```

The reports are in `.lighthouseci/`. Set `CHROME_PATH` if Lighthouse cannot find Chrome.

## Analytics

The Umami website id is `DEFAULT_UMAMI_WEBSITE_ID` in `src/lib/analytics-build.ts`, and `PUBLIC_UMAMI_WEBSITE_ID` overrides it at build time. An empty `PUBLIC_UMAMI_WEBSITE_ID` fails the build. To build without analytics, in a fork or locally, set `ANALYTICS_OFF=1` for the build and for `bun test`. `test/analytics-built.test.ts` follows each sampled page's scripts and their imports in `dist/` and fails when the script URL or the id is missing, so analytics cannot go quiet unnoticed.

## Updating to a new release of Sluiceway

The docs read the action's files from a git submodule at `vendor/sluiceway`, checked out at a release tag. The `branch` line in `.gitmodules` names the same tag, and `bun run pin` fails when the two differ or when the submodule is not at a tag.

When Sluiceway publishes a release, Renovate opens a pull request that moves the submodule and the `branch` line to the new tag. It never picks a commit on `main`, and it never merges on its own: the build is the check, and a person looks at the site before merging.

A weekly workflow (`.github/workflows/freshness.yml`) compares the tag in `.gitmodules` with the action's latest release. While the pin is behind, it keeps one issue open, titled "The docs pin vX.Y.Z; the action released vA.B.C", with the releases in between. It closes the issue once the pin catches up. You can also start it by hand from the Actions tab.

The fast signal is `bun run release`, part of `bun run check`. It asks GitHub for the action's releases and, when the pin is behind, prints a warning that names both versions and the releases in between. In CI the warning is an annotation and a note in the job summary of every pull request. It never fails the build, and when GitHub cannot be reached (offline, a rate limit, a fork) it says so in one line and carries on. `GH_TOKEN` or `GITHUB_TOKEN`, when set, lifts the rate limit.

The start page, the sidebar and the footer say which release the docs describe. The version comes from the submodule's tag, so it always matches the pin.

By hand:

```sh
git -C vendor/sluiceway fetch --tags
git -C vendor/sluiceway checkout v0.9.0
git submodule set-branch --branch v0.9.0 vendor/sluiceway
git add .gitmodules vendor/sluiceway
git commit -m "chore: follow sluiceway v0.9.0"
```

Then run `bun run check` and open a pull request. `git submodule update --remote` does not work here, because the `branch` line names a tag.

## Licence

Apache-2.0. See `LICENSE`.
