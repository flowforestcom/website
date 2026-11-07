import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Page-level metadata: <title>, meta description, and anything else the
 * layout needs. The page body is rendered from the section and product
 * collections below.
 */
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    canonical: z.string().optional(),
    /** Human-readable date shown on policy pages, e.g. "9 September 2026". */
    updated: z.string().optional(),
    /** H1 for pages whose heading is not part of the Markdown body. */
    heading: z.string().optional(),
    author: z.string().optional(),
  }),
});

/**
 * The landing page is a sequence of typed sections. Each entry's Markdown
 * body holds its prose or list items; the type picks the markup in
 * `src/components/Section.astro`.
 */
const sectionBase = <T extends string>(type: T) =>
  z.object({
    type: z.literal(type),
    order: z.number().int(),
  });

const sections = defineCollection({
  loader: glob({ base: './src/content/sections', pattern: '*.md' }),
  schema: z.discriminatedUnion('type', [
    sectionBase('hero').extend({
      lines: z.array(z.string()).min(2),
      sub: z.string(),
    }),
    sectionBase('introduction').extend({
      eyebrow: z.string(),
      title: z.string(),
    }),
    sectionBase('products').extend({
      eyebrow: z.string(),
      title: z.string(),
    }),
    sectionBase('beliefs').extend({
      eyebrow: z.string(),
      title: z.string(),
    }),
    sectionBase('method').extend({
      eyebrow: z.string(),
      title: z.string(),
      nameNote: z.array(z.object({ term: z.string(), note: z.string() })),
    }),
    sectionBase('boundaries').extend({
      eyebrow: z.string(),
      title: z.string(),
    }),
  ]),
});

/** One entry per product card. The Markdown body is the description. */
const products = defineCollection({
  loader: glob({ base: './src/content/products', pattern: '*.md' }),
  schema: z.object({
    order: z.number().int(),
    name: z.string(),
    step: z.string(),
    lede: z.string(),
    features: z.array(z.string()),
    status: z.string(),
    /** Selects the product's visual in `src/components/Section.astro`. */
    visual: z.enum(['flare', 'runway', 'slate']),
    link: z
      .object({
        label: z.string(),
        href: z.string(),
      })
      .optional(),
  }),
});

export const collections = { pages, sections, products };
