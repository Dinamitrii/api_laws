import { PUBLIC_PATHS, ROBOTS_TXT, SITEMAP_PATHS } from './firmi-seo-manifest';

export function isPublicSeoPage(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

function buildSitemap(origin: string): string {
  const urls = SITEMAP_PATHS.map((entry) => {
    const loc = `${origin}${entry.path === '/' ? '/' : entry.path}`;
    return `  <url><loc>${loc}</loc><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function seoResponse(request: Request): Response | null {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const sitemap = pathname === '/sitemap.xml';
  if (!sitemap && pathname !== '/robots.txt') return null;
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const robots = ROBOTS_TXT.replace(/^Sitemap: .*$/m, `Sitemap: ${url.origin}/sitemap.xml`);
  // Generate the sitemap from the request origin so every host (prod domains and
  // localhost alike) lists only its own URLs — no duplicate content across hosts.
  const body = sitemap ? buildSitemap(url.origin) : robots;
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': sitemap ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}