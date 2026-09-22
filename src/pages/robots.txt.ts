// Allows everything and names the sitemap on the site's own address, from DOCS_SITE and
// DOCS_BASE. Crawlers read robots.txt only at the root of a host, so it matters when the base
// is `/`, as on docs.sluiceway.dev.
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const sitemap = new URL(`${base}/sitemap-index.xml`, site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
