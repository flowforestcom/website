# Flowforest Website

Static marketing site for [Flowforest](https://flowforest.com) — local-first tools that serve one person well.

Built with [Astro](https://astro.build). Output is static; deploy `dist/` to any static host.

## Structure

```
public/            served at the site root, copied to dist/ as-is
  _headers         security headers (Cloudflare Pages)
  logo.png, favicon.png, entropy.svg, …
src/
  layouts/Base.astro              head, header, footer
  pages/index.astro               landing page
  pages/flare/privacy-policy.astro
  styles/global.css               all site styles
  scripts/hero-contours.js        animated hero canvas
r&d/hero-animated.html            hero prototype, excluded from the build
```

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

## Deploy

`pnpm build`, then deploy `dist/` to Cloudflare Pages. `_headers` is copied from
`public/` into the build output and is picked up automatically.
