// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { playDevServer } from './scripts/play-dev-server.mjs';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://pengzzzccc.github.io',
  base: process.env.PUBLIC_BASE_PATH || undefined,
  trailingSlash: 'ignore',
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    mdx(),
    sitemap({
      i18n: { defaultLocale: 'zh', locales: { zh: 'zh-CN', en: 'en' } },
    }),
  ],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
  vite: {
    // 开发时把 ./games 映射到 /play/*，模拟生产环境 Caddy 的行为
    plugins: [tailwindcss(), playDevServer()],
  },
});
