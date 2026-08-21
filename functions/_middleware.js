// Pages Function middleware: consolidate the default *.pages.dev subdomain
// onto the canonical allsoft.asia domain.
// Cloudflare Pages keeps <project>.pages.dev live by default even after a
// custom domain is set, which splits SEO and pollutes visitor analytics.
// 301-redirect only the exact root pages.dev host; branch preview URLs
// (<branch>.allsoft-asia.pages.dev) keep working untouched.

const CANONICAL_HOST = 'allsoft.asia';
const PAGES_DEV_HOST = 'allsoft-asia.pages.dev';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (url.hostname === PAGES_DEV_HOST) {
    const target = 'https://' + CANONICAL_HOST + url.pathname + url.search;
    return new Response(null, {
      status: 301,
      headers: { 'Location': target, 'Cache-Control': 'no-store' }
    });
  }

  return next();
}
