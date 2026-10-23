// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://flowforest.com',
  output: 'static',
  // house convention: every route gets a trailing slash
  trailingSlash: 'always',
  build: { format: 'directory' },
  server: { port: 8000, host: '127.0.0.1' },
});
