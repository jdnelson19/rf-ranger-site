/**
 * rfranger.app Worker. Static files in public/ are served by Cloudflare before
 * this runs; only requests with no matching file arrive here.
 */
import { onRequestPost as feedback } from './feedback.js';
import { onRequestGet as latest } from './latest.js';

const ROUTES = {
  'GET /api/latest': latest,
  'POST /api/feedback': feedback,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const handler = ROUTES[`${request.method} ${pathname}`];
    if (handler) return handler({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
    if (pathname.startsWith('/api/')) return new Response('Method not allowed', { status: 405 });
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  },
};
