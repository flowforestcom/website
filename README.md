# Flowforest Website

Static marketing site for [Flowforest](https://flowforest.com) — local-first tools that serve one person well.

Built with [Astro](https://astro.build). Output is static; deploy `dist/` to any static host.

## Structure

```
public/            served at the site root, copied to dist/ as-is
  _headers         security headers (Cloudflare Pages)
  logo.png, favicon.png, entropy.svg, …
src/
  content.config.ts               content collection schemas
  content/
    pages/home.md                 landing page metadata
    pages/flare/privacy-policy.md privacy policy (Markdown body)
    sections/01-hero.md …         landing page sections, in order
    products/flare.md …           one file per product card
  components/Section.astro        renders one section by its `type`
  components/Product.astro        renders one product card
  layouts/Base.astro              head, header, footer
  pages/index.astro               landing page
  pages/flare/privacy-policy.astro
  styles/global.css               all site styles
  scripts/hero-contours.js        animated hero canvas
r&d/hero-animated.html            hero prototype, excluded from the build
```

## Editing copy

All site text lives in Markdown under `src/content/`. The `.astro` files hold
layout and markup only.

- **Landing page sections** — one file per section in `src/content/sections/`.
  Prose and list items go in the Markdown body. The frontmatter holds the
  `type`, the `order`, the small caps `eyebrow`, and the `title`. To reorder the
  page, change `order`; to add a section, copy an existing file and pick a
  `type` the schema allows.
- **Products** — one file per card in `src/content/products/`. The body is the
  description paragraph; `name`, `step`, `lede`, `features`, `status`, and the
  optional `link` are frontmatter. `visual` selects the illustration
  (`flare`, `runway`, or `slate`).
- **Page metadata** — `<title>` and meta description live in
  `src/content/pages/home.md` and `src/content/pages/flare/privacy-policy.md`.
  The privacy policy body is plain Markdown with `##` headings; `heading`,
  `author`, and `updated` feed the title block above it.

The schema in `src/content.config.ts` validates every entry, so a mistyped field
or a missing value fails `pnpm check` rather than shipping.

## Commands

```bash
pnpm install
pnpm dev       # http://127.0.0.1:8000
pnpm build     # -> dist/
pnpm preview   # serve the built output
pnpm check     # astro check, then build
```

## Conventions

- `trailingSlash: "always"` — every route is a directory with an index, so the
  privacy policy is served at `/flare/privacy-policy/`. Internal links and the
  canonical tags include the slash.
- Assets live in `public/` and are referenced from the site root (`/logo.png`),
  so they never pass through the build.
- `r&d/` is excluded from the build by living outside `src/pages/` and is
  excluded from type-checking in `tsconfig.json`.
- The hero canvas is imported with a `<script>` tag in `index.astro`, not from
  frontmatter: frontmatter runs on the server during the build, where `document`
  does not exist.
- Markdown renders with `smartypants: false`, so quotes and dashes appear exactly
  as typed. Do not rely on the build to curl them.

## Deploy

`pnpm build`, then deploy `dist/` to Cloudflare Pages. `_headers` is copied from
`public/` into the build output and is picked up automatically.
