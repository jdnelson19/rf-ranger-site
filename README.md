# rf-ranger-site

The landing page for [RF Ranger](https://github.com/jdnelson19/RF-Ranger), served at **https://rfranger.app** by a Cloudflare Worker with static assets.

- `public/`: the page (plain HTML, CSS and JS, no build step) and its screenshots. Cloudflare serves these directly.
- `src/worker.js`: handles requests that don't match a file, which means the two API routes:
  - `src/latest.js`: `GET /api/latest`, the newest RF Ranger release and its Mac/Windows download links, read from GitHub and cached for 5 minutes. The download buttons use it, so nothing here changes when a version ships.
  - `src/feedback.js`: `POST /api/feedback`, turns the feedback form into a GitHub issue on RF-Ranger, labelled `feedback`
  - `src/subscribe.js`: `POST /api/subscribe`, the "Get updates" email sign-up
- `wrangler.toml`: the Worker's name and assets folder. `name` must match the Worker's name in Cloudflare.

## Cloudflare setup (once)

1. Cloudflare dashboard → **Workers & Pages → Create → Workers → Import a repository**, and pick `jdnelson19/rf-ranger-site`. The defaults are right: no build command, and the deploy command `npx wrangler deploy`.
2. On the Worker, go to **Settings → Variables and Secrets** and add a **secret** `GITHUB_TOKEN`. It's a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to **only** `jdnelson19/RF-Ranger` and the permission **Issues: Read and write**, nothing else. It also raises the release lookup's GitHub rate limit.
3. **Settings → Domains & Routes → Add → Custom domain → `rfranger.app`**, and `www.rfranger.app` too if you want it. With the domain on Cloudflare DNS this is one step. `.app` domains are HTTPS-only, which Cloudflare handles.
4. In the RF-Ranger repo, create a label named `feedback` (Issues → Labels) so submissions are easy to filter.

Pushes to `main` deploy through GitHub Actions (`.github/workflows/deploy.yml`, which runs `wrangler deploy`). That needs two repository secrets: `CLOUDFLARE_API_TOKEN` (an API token from the **Edit Cloudflare Workers** template) and `CLOUDFLARE_ACCOUNT_ID`. Deploy logs are in the repository's **Actions** tab, and **Run workflow** deploys again by hand. Cloudflare's own Git builds for the Worker stopped picking up pushes, so they are not used.

## Email sign-ups

"Get updates" stores each address in a Workers KV namespace bound as `SUBSCRIBERS` (see `wrangler.toml`). Wrangler creates the namespace on the first deploy, so there is nothing to set up. Addresses are never shown on the site or posted anywhere public.

- **See the list:** Cloudflare dashboard → Storage & Databases → **KV** → the namespace → KV pairs. Or, from this folder: `npx wrangler kv key list --binding SUBSCRIBERS --remote`
- **Unsubscribe someone:** delete their `email:<address>` key.
- **Sending:** this site doesn't send email. Export the list and use your own email service, with an unsubscribe link, when a major version ships.

## Device reports

The feedback form takes an optional **device report**: the file RF Ranger's Inspector exports for a receiver or charger that isn't supported yet. The Worker only accepts reports exported with **Remove names & addresses** on. It keeps the file private in the `REPORTS` KV namespace (created on the first deploy) and posts only the model, firmware and size in the public issue, labelled `device-report`, with the key to read the file:

```
npx wrangler kv key get --binding REPORTS report:2026-10-20-ab12cd34 --remote > report.json
```

## Run it locally

```
npx wrangler dev
```

Opens http://localhost:8787 with the API routes running. For the feedback form to create real issues locally, put `GITHUB_TOKEN=...` in a `.dev.vars` file (ignored by git). Without it the form answers "Feedback isn't set up yet".

## When RF Ranger releases a new version

- **Automatic:** the download buttons and the "Version x.y.z" line under them update by themselves from `/api/latest`, cached for up to 5 minutes.
- **By hand:** update the website's version note. Today that's checking the site shows the new version. Once the **What's new** area exists (below), it means adding the release's highlights there.
- **Screenshots:** retake them (see below) if the release changed what's shown in them.

## To do

- **What's new area:** a short, dated list of each release's highlights in plain language, for people choosing whether to update. It could come from the GitHub release notes (via `/api/latest`, extended to include `body`) or be written by hand here.

## Screenshots

`public/screenshots/` are taken from RF Ranger's demo mode (`npm run demo` in RF-Ranger/server): fictional names, simulated hardware. Retake them at 1280×760, 2× scale, as WebP when the UI changes.

## Spam

The form has a hidden field that bots fill in, a minimum time on the page, size limits and a same-origin check. If spam gets through anyway, add [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) to the form and verify its token in `feedback.js`.
