import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://onlinebiblia.com',
  output: 'static',
  integrations: [
    sitemap({
      changefreq: 'monthly',
      priority: 0.8,
      lastmod: new Date(),
      filter: (page) => !page.includes('/404'),
    }),
  ],
});

