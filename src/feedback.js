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
 *
 * An optional device report (RF Ranger → Inspector → Export report) is kept
 * private in the REPORTS KV namespace, never posted: the public issue gets
 * only its model, firmware and size, and the key to read it with
 * `npx wrangler kv key get --binding REPORTS <key> --remote`. Only reports
 * exported with "Remove names & addresses" on are accepted.
 */
const REPO = 'jdnelson19/RF-Ranger';
const KINDS = { bug: 'Problem', idea: 'Idea', question: 'Question', device: 'Device report', other: 'Other' };
const MAX_REPORT_BYTES = 5_000_000;
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

  const report = await readReport(form.get('report'));
  if (report?.error) return reply(400, report.error);
  let reportLine;
  if (report) {
    if (!env.REPORTS) return reply(503, 'Device reports can’t be received yet. Please try again later.');
    const key = `report:${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`;
    await env.REPORTS.put(key, report.text, { metadata: { size: report.text.length, model: report.summary.model } });
    const s = report.summary;
    reportLine = `**Device report:** ${[s.model, s.kind, s.firmware && `firmware ${s.firmware}`, `${s.fields} fields`, `${s.messages} messages`, s.rfRanger && `RF Ranger ${s.rfRanger}`].filter(Boolean).join(' · ')}  \n` +
      `**Stored privately as** \`${key}\` (read it with \`npx wrangler kv key get --binding REPORTS ${key} --remote\` in rf-ranger-site)`;
  }

  const firstLine = message.split('\n')[0].replace(/\s+/g, ' ');
  const title = `${kind}: ${firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine}`;
  const details = [
    `**Type:** ${kind}`,
    platform && `**Using:** ${platform}`,
    version && `**Version:** ${version.replace(/[^\w.\- ]/g, '')}`,
    name && `**From:** ${name.replace(/[`*_<>[\]@#]/g, '')}`,
    reportLine,
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
    body: JSON.stringify({ title: title.replace(/@/g, '@​'), body, labels: report ? ['feedback', 'device-report'] : ['feedback'] }),
  });
  if (!res.ok) {
    console.log(`GitHub issue create failed: ${res.status} ${await res.text()}`);
    return reply(502, 'Sorry, that didn’t go through. Please try again in a minute.');
  }
  const issue = await res.json();
  return reply(200, report ? 'Thanks! Your feedback and device report were sent.' : 'Thanks! Your feedback was sent.', issue.html_url);
}

/**
 * The attached device report, if any: checked to be an anonymized RF Ranger
 * report, with a summary that is safe to post (model, firmware, counts).
 */
async function readReport(file) {
  if (!file || typeof file === 'string' || file.size === 0) return undefined;
  if (file.size > MAX_REPORT_BYTES) return { error: 'That device report is over 5 MB. Export it again after a shorter watch, then attach it.' };
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'That file isn’t an RF Ranger device report. In RF Ranger use ⚙ → Inspector → Export report.' };
  }
  if (data?.kind !== 'rf-ranger-device-report') return { error: 'That file isn’t an RF Ranger device report. In RF Ranger use ⚙ → Inspector → Export report.' };
  if (data.anonymized !== true) return { error: 'Please export the report with “Remove names & addresses” left on, then attach it again.' };
  const clean = (v, max = 40) => (typeof v === 'string' ? v.replace(/[^\w .\-/+]/g, '').trim().slice(0, max) : undefined);
  const id = data.device?.identified ?? {};
  const fw = Array.isArray(data.keysSeen) ? data.keysSeen.find((k) => k?.key === 'FW_VER')?.value : undefined;
  return {
    text,
    summary: {
      model: clean(id.model) || clean(data.device?.userTags?.model) || 'Unknown model',
      kind: clean(id.kind),
      firmware: clean(fw) || clean(data.device?.userTags?.firmware),
      fields: Array.isArray(data.keysSeen) ? data.keysSeen.length : 0,
      messages: Array.isArray(data.frames) ? data.frames.length : 0,
      rfRanger: clean(data.rfRangerVersion, 20),
    },
  };
}

function reply(status, message, issueUrl) {
  return new Response(JSON.stringify({ ok: status === 200, message, issueUrl }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
