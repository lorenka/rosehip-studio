# Rosehip Studio

Personal studio/portfolio site for Lorraine Sawicki, deployed to **rosehip.studio**
via GitHub Pages. Built with Astro 7 + React islands.

## Architecture

The site has two distinct halves. Match the right pattern to the task:

- **Static case studies** live in the `work` content collection
  (`src/content/work/*.md`), validated by the Zod schema in
  `src/content.config.ts` (title, description, publishDate, tags, img, img_alt).
  They render through the single dynamic route `src/pages/work/[...slug].astro`.
  **Adding a project = add a markdown file.** Ships no JavaScript.

- **Interactive features** are React components hydrated as islands
  (`client:load`), each given its own dedicated `.astro` page rather than going
  through the collection. Current islands:
  - `WearingNature.jsx` — node-vibrant palette extraction + Unsplash outfit builder
  - `GBBOViz.jsx` — d3 visualizations reading CSVs from `public/files/`

When adding something interactive, follow this pattern: React island in
`src/components/`, mounted from a bespoke page in `src/pages/`. Reach for an
island only for genuine interactivity — prefer `.astro` components otherwise to
keep JS off the page.

Dependencies are intentionally minimal: React, d3, node-vibrant. Prefer the
existing stack over adding libraries.

## Environment variables

Astro only exposes env vars **prefixed with `PUBLIC_`** to client-side
(browser/island) code — the Vite `VITE_` prefix does NOT work client-side here.
Any key an island reads via `import.meta.env` must be `PUBLIC_`-prefixed in
`.env` (and documented in `.env.example`). Note this makes the value public in
the shipped bundle, so never use `PUBLIC_` for a real secret — move that logic
server-side instead.

After changing `.env`, restart the dev server — it does not hot-reload env vars.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
Astro site on a GitHub Actions runner (`withastro/action`) and publishes to
GitHub Pages (`actions/deploy-pages`). No manual build or `dist/` commit — the
runner builds from source. Custom domain `rosehip.studio` (also
`workflow_dispatch` for manual runs).

**Client env vars in production:** the build runs on the runner, where `.env`
does NOT exist (it's gitignored). Any `PUBLIC_` var an island needs at build
time must be added as a GitHub **repository secret** and passed through in
`deploy.yml`'s build step, e.g.:

    - name: Build Astro site
      uses: withastro/action@v4
      env:
        PUBLIC_UNSPLASH_ACCESS_KEY: ${{ secrets.PUBLIC_UNSPLASH_ACCESS_KEY }}

Without that, `PUBLIC_`-prefixed values are empty in the deployed bundle.

### Checklist when adding a new client-side `PUBLIC_` env var

A new `PUBLIC_` var works locally but silently breaks in production unless the
runner can see it. Whenever a new `PUBLIC_` var is introduced, do all of:

1. Add it to `.env` (real value) and `.env.example` (placeholder).
2. Add a matching GitHub repository secret:
   `gh secret set PUBLIC_<NAME>`
3. Add an `env:` entry under the "Build Astro site" step in `deploy.yml`.
4. Verify with `gh secret list` that the secret exists before relying on the
   deployed site.

When working in this repo, if you add or notice a `PUBLIC_` var that lacks a
matching secret in `gh secret list` or an `env:` entry in `deploy.yml`, flag it
to Lorraine as a production gap rather than assuming it's wired up.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
