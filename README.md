# Flowforest Website

Static marketing site for [Flowforest](https://flowforest.com) — local-first tools that serve one person well.

## Contents

- `index.html` — landing page
- `style.css` — styles
- `logo.svg`, `favicon.svg` — branding
- `_headers` — security headers (Cloudflare Pages)

## Local preview

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080

## Deploy

Static files only — deploy the repo root to any static host. The `_headers` file is used automatically on Cloudflare Pages.
