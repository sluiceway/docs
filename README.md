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
| `bun run check` | Lint, the tokens check, typecheck and build. CI runs this. |
| `bun run tokens` | Writes `src/styles/tokens.css` from `src/styles/tokens.json`. |

The site URL comes from two environment variables: `DOCS_SITE` (default `https://sluiceway.github.io`) and `DOCS_BASE` (default `/docs`).

## Updating to a new release of Sluiceway

The docs read the action's files from a git submodule at `vendor/sluiceway`, checked out at a release tag. `src/lib/source.ts` reads that tag, and every link to the action's source points at it.

To follow a new release, check the submodule out at the new tag, commit, and open a pull request:

```sh
git -C vendor/sluiceway fetch --tags
git -C vendor/sluiceway checkout v0.8.0
git add vendor/sluiceway
git commit -m "chore: follow sluiceway v0.8.0"
```

Run `bun run check` before you push. Later, Renovate opens these pull requests.

## Licence

Apache-2.0. See `LICENSE`.
