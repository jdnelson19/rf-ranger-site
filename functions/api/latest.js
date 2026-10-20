/**
 * GET /api/latest: the newest RF Ranger release and its download links, so the
 * page never needs editing when a version ships. Cached for five minutes at
 * the edge to stay well inside GitHub's API limits.
 */
const REPO = 'jdnelson19/RF-Ranger';
const CACHE_SECONDS = 300;

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL('/api/latest', request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'rfranger.app',
      ...(env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!res.ok) return json({ error: `GitHub answered ${res.status}` }, 502, 'no-store');

  const release = await res.json();
  const asset = (pattern) => {
    const a = release.assets.find((x) => pattern.test(x.name));
    return a ? { name: a.name, url: a.browser_download_url, size: a.size } : null;
  };
  const out = json(
    {
      version: release.tag_name.replace(/^v/, ''),
      publishedAt: release.published_at,
      notesUrl: release.html_url,
      mac: asset(/\.dmg$/i),
      windows: asset(/-Windows-Setup\.exe$/i),
      windowsPortable: asset(/-Windows-portable\.zip$/i),
    },
    200,
    `public, max-age=${CACHE_SECONDS}`,
  );
  waitUntil(cache.put(key, out.clone()));
  return out;
}

function json(body, status, cacheControl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cacheControl },
  });
}
