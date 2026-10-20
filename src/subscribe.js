/**
 * POST /api/subscribe: add an email address to the "major release" list.
 *
 * Addresses are kept in the SUBSCRIBERS KV namespace (created on first
 * deploy), one key per address: `email:<address>` → { email, at }. They are
 * never shown on the site or posted anywhere public. To read the list:
 *   npx wrangler kv key list --binding SUBSCRIBERS --remote
 *
 * Same spam defences as the feedback form: a hidden field people leave
 * empty, a minimum time on the page, and same-origin requests only.
 */
const MIN_FILL_MS = 2000;
// Deliberately loose: one @, something on each side, a dot in the domain.
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return reply(403, 'Please sign up from rfranger.app.');

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(400, 'That sign-up was in an unexpected format.');
  }
  const field = (name, max) => String(form.get(name) ?? '').trim().slice(0, max);

  const started = Number(field('started', 20));
  if (field('website', 200) || !started || Date.now() - started < MIN_FILL_MS) return reply(200, 'Thanks! You’re on the list.');

  const email = field('email', 255).toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return reply(400, 'That doesn’t look like an email address.');
  if (!env.SUBSCRIBERS) return reply(503, 'Sign-ups aren’t set up yet. Please try again later.');

  const key = `email:${email}`;
  if (!(await env.SUBSCRIBERS.get(key))) {
    await env.SUBSCRIBERS.put(key, JSON.stringify({ email, at: new Date().toISOString() }));
  }
  return reply(200, 'Thanks! You’re on the list for major releases.');
}

function reply(status, message) {
  return new Response(JSON.stringify({ ok: status === 200, message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
