import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

// Serve sitemap in local dev server (Astro's sitemap plugin only outputs to dist on build)
const devSitemapPlugin = () => ({
  name: 'dev-sitemap-server',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const cleanUrl = req.url ? req.url.split('?')[0] : '';
      if (cleanUrl === '/sitemap-index.xml' || (cleanUrl.startsWith('/sitemap-') && cleanUrl.endsWith('.xml'))) {
        const file = path.resolve('dist', cleanUrl.slice(1));
        if (fs.existsSync(file)) {
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.end(fs.readFileSync(file, 'utf-8'));
          return;
        }
      }
      next();
    });
  },
});

export default defineConfig({
  site: 'https://onlinebiblia.com',
  output: 'static',
  vite: {
    plugins: [devSitemapPlugin()],
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404') && !page.includes('/offline'),
    }),
  ],
});
