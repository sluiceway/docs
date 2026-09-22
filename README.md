# Sluiceway docs

The documentation site for [Sluiceway](https://github.com/sluiceway/sluiceway), the GitHub Action that keeps one issue showing which infrastructure stacks have changes waiting, and deploys a stack when you tick its box. The site is built with Astro Starlight and published at https://sluiceway.github.io/docs/.

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
| `bun run lint` | Checks formatting and lint with Biome. `bun run lint:fix` fixes what it can. |
| `bun run typecheck` | Runs `astro check`. |
| `bun run check` | Lint, the tokens check, the pin check, typecheck and build. CI runs this. |
| `bun run links` | Checks every link and anchor inside `dist/`, offline. Run it after a build, with the same `DOCS_SITE` and `DOCS_BASE`. |
| `bun run pin` | Checks that the submodule is at a release tag and that `.gitmodules` names the same tag. |
| `bun run tokens` | Writes `src/styles/tokens.css` from `src/styles/tokens.json`. |

The site URL comes from two environment variables: `DOCS_SITE` (default `https://sluiceway.github.io`) and `DOCS_BASE` (default `/docs`).

## Deploying

Every push to `main` builds the site and deploys it to GitHub Pages (`.github/workflows/pages.yml`). You can also start the workflow by hand from the Actions tab.

The site is at https://sluiceway.github.io/docs/ until the custom domain https://docs.sluiceway.dev/ is set. Two repository variables decide which address the build uses:

| Variable | Unset | With the custom domain |
| --- | --- | --- |
| `DOCS_SITE` | `https://sluiceway.github.io` | `https://docs.sluiceway.dev` |
| `DOCS_BASE` | `/docs` | `/` |

The domain itself lives in the repository's Pages settings, not in a `CNAME` file. To move the site, set the domain there, set both variables, and run the workflow.

CI builds the site under both addresses and checks every internal link and anchor. A weekly workflow (`.github/workflows/links.yml`) checks the external links and opens an issue when some fail.

## Updating to a new release of Sluiceway

The docs read the action's files from a git submodule at `vendor/sluiceway`, checked out at a release tag. The `branch` line in `.gitmodules` names the same tag, and `bun run pin` fails when the two differ or when the submodule is not at a tag.

When Sluiceway publishes a release, Renovate opens a pull request that moves the submodule and the `branch` line to the new tag. It never picks a commit on `main`, and it never merges on its own: the build is the check, and a person looks at the site before merging.

By hand:

```sh
git -C vendor/sluiceway fetch --tags
git -C vendor/sluiceway checkout v0.8.0
git submodule set-branch --branch v0.8.0 vendor/sluiceway
git add .gitmodules vendor/sluiceway
git commit -m "chore: follow sluiceway v0.8.0"
```

Then run `bun run check` and open a pull request. `git submodule update --remote` does not work here, because the `branch` line names a tag.

## Licence

Apache-2.0. See `LICENSE`.
