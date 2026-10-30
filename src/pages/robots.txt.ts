import type { APIRoute } from 'astro';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
const sitemapUrl = new URL(`${base}sitemap-index.xml`, import.meta.env.SITE).href;

const robotsTxt = `
User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`.trim();

export const GET: APIRoute = () => {
  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};