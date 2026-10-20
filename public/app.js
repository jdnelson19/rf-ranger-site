// Download links from the latest release, the feedback form and the update sign-up.
// Without JavaScript the buttons still go to the GitHub releases page and the
// forms still post (the Worker answers with JSON either way).

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
    set('mac', r.mac, 'macOS 11 or later');
    set('windows', r.windows, 'Windows 10 or 11');
    document.querySelector('[data-release]').textContent = `Version ${r.version}`;
  } catch {
    // offline or the API is down: the static links still work
  }
}

/** Post a form to its Worker route and show the answer next to the button. */
function wire(form, { onSent } = {}) {
  const status = form.querySelector('[data-status]');
  const button = form.querySelector('button[type="submit"]');
  form.elements.started.value = String(Date.now());

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
      status.textContent = body.message || 'Thanks!';
      onSent?.(body, status);
      form.elements.started.value = String(Date.now());
    } catch (err) {
      status.dataset.tone = 'bad';
      status.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}

function feedback() {
  const form = document.querySelector('[data-feedback]');
  const mine = visitorOs();
  if (mine) form.elements.platform.value = mine;
  wire(form, {
    onSent: (body, status) => {
      if (body.issueUrl) status.append(' ', Object.assign(document.createElement('a'), { href: body.issueUrl, textContent: 'See it on GitHub' }), '.');
      form.elements.message.value = '';
    },
  });
}

function subscribe() {
  const form = document.querySelector('[data-subscribe]');
  wire(form, { onSent: () => { form.elements.email.value = ''; } });
}

downloads();
feedback();
subscribe();
