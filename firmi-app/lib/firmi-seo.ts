import { PUBLIC_PATHS, ROBOTS_TXT, SITEMAP_XML } from './firmi-seo-manifest';
export function isPublicSeoPage(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}
export function seoResponse(request: Request): Response | null {
  const pathname = new URL(request.url).pathname;
  const sitemap = pathname === '/sitemap.xml';
  if (!sitemap && pathname !== '/robots.txt') return null;
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  return new Response(request.method === 'HEAD' ? null : sitemap ? SITEMAP_XML : ROBOTS_TXT, {
    headers: {
      'Content-Type': sitemap ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
