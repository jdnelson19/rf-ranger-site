// Download links from the latest release, and the feedback form.
// Without JavaScript the buttons still go to the GitHub releases page and the
// form still posts (the function answers with JSON either way).

const RELEASES = 'https://github.com/jdnelson19/RF-Ranger/releases/latest';

function visitorOs() {
  const p = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent).toLowerCase();
  if (p.includes('win')) return 'windows';
  if (p.includes('mac')) return 'mac';
  return undefined;
}

const mb = (bytes) => `${Math.round(bytes / 1_000_000)} MB`;

async function downloads() {
  const box = document.querySelector('[data-downloads]');
  const mine = visitorOs();
  if (mine) box.querySelector(`[data-os="${mine}"]`)?.setAttribute('data-mine', '');
  box.setAttribute('data-ready', '');

  try {
    const res = await fetch('/api/latest');
    if (!res.ok) return;
    const r = await res.json();
    const set = (os, asset, detail) => {
      const a = box.querySelector(`[data-os="${os}"]`);
      if (!asset) return; // keeps the link to the releases page
      a.href = asset.url;
      a.querySelector('[data-detail]').textContent = `${detail} · ${mb(asset.size)}`;
    };
    set('mac', r.mac, `v${r.version} · macOS 11+`);
    set('windows', r.windows, `v${r.version} · Windows 10/11 installer`);

    const line = document.querySelector('[data-release]');
    line.textContent = '';
    const date = new Date(r.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    line.append(`Version ${r.version}, released ${date} · `);
    const notes = Object.assign(document.createElement('a'), { href: r.notesUrl || RELEASES, textContent: 'What’s new' });
    line.append(notes);
    if (r.windowsPortable) {
      line.append(' · ');
      line.append(Object.assign(document.createElement('a'), { href: r.windowsPortable.url, textContent: 'Windows portable .zip' }));
    }
  } catch {
    // offline or the API is down: the static links still work
  }
}

function feedback() {
  const form = document.querySelector('[data-feedback]');
  const status = form.querySelector('[data-status]');
  const button = form.querySelector('button[type="submit"]');
  form.elements.started.value = String(Date.now());
  const mine = visitorOs();
  if (mine) form.elements.platform.value = mine;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    button.disabled = true;
    status.removeAttribute('data-tone');
    status.textContent = 'Sending…';
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Sorry, that didn’t go through. Please try again.');
      status.dataset.tone = 'ok';
      status.textContent = body.message || 'Thanks! Your feedback was sent.';
      if (body.issueUrl) {
        status.append(' ', Object.assign(document.createElement('a'), { href: body.issueUrl, textContent: 'See it on GitHub' }), '.');
      }
      form.elements.message.value = '';
      form.elements.started.value = String(Date.now());
    } catch (err) {
      status.dataset.tone = 'bad';
      status.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}

downloads();
feedback();
