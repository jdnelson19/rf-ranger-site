/**
 * POST /api/feedback: turn a feedback form submission into a GitHub issue on
 * the RF Ranger repo, labelled "feedback".
 *
 * The repo is public, so the form collects no email address and says that
 * submissions are posted publicly. Needs the GITHUB_TOKEN secret: a
 * fine-grained token for jdnelson19/RF-Ranger with Issues: read and write.
 *
 * Spam defences: a hidden "website" field that people leave empty, a minimum
 * time on the page, size limits, and same-origin requests only.
 */
const REPO = 'jdnelson19/RF-Ranger';
const KINDS = { bug: 'Problem', idea: 'Idea', question: 'Question', other: 'Other' };
const PLATFORMS = { mac: 'Mac', windows: 'Windows', both: 'Mac and Windows', none: 'Not using it yet' };
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 5000;
const MIN_FILL_MS = 3000;

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return reply(403, 'Please send feedback from rfranger.app.');

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(400, 'That submission was in an unexpected format.');
  }
  const field = (name, max) => String(form.get(name) ?? '').trim().slice(0, max);

  // Bots fill every field and submit instantly. Pretend it worked so they don't adapt.
  const started = Number(field('started', 20));
  if (field('website', 200) || !started || Date.now() - started < MIN_FILL_MS) return reply(200, 'Thanks!');

  const message = field('message', MAX_MESSAGE + 1);
  if (message.length < MIN_MESSAGE) return reply(400, 'Please write a little more so we can act on it.');
  if (message.length > MAX_MESSAGE) return reply(400, `Please keep it under ${MAX_MESSAGE} characters.`);
  const kind = KINDS[field('kind', 20)] ?? KINDS.other;
  const platform = PLATFORMS[field('platform', 20)];
  const name = field('name', 80);
  const version = field('version', 20);

  if (!env.GITHUB_TOKEN) return reply(503, 'Feedback isn’t set up yet. Please try again later.');

  const firstLine = message.split('\n')[0].replace(/\s+/g, ' ');
  const title = `${kind}: ${firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine}`;
  const details = [
    `**Type:** ${kind}`,
    platform && `**Using:** ${platform}`,
    version && `**Version:** ${version.replace(/[^\w.\- ]/g, '')}`,
    name && `**From:** ${name.replace(/[`*_<>[\]@#]/g, '')}`,
  ].filter(Boolean);
  // A code block, so text from the form can't @mention people, link or format anything.
  const fence = '~'.repeat(Math.max(3, ...[...message.matchAll(/~+/g)].map((m) => m[0].length + 1)));
  const body = `${details.join('  \n')}\n\n${fence}text\n${message}\n${fence}\n\n_Sent from the feedback form on rfranger.app._`;

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'rfranger.app',
    },
    body: JSON.stringify({ title: title.replace(/@/g, '@​'), body, labels: ['feedback'] }),
  });
  if (!res.ok) {
    console.log(`GitHub issue create failed: ${res.status} ${await res.text()}`);
    return reply(502, 'Sorry, that didn’t go through. Please try again in a minute.');
  }
  const issue = await res.json();
  return reply(200, 'Thanks! Your feedback was sent.', issue.html_url);
}

function reply(status, message, issueUrl) {
  return new Response(JSON.stringify({ ok: status === 200, message, issueUrl }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
