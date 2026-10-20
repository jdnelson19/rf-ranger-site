# rf-ranger-site

The landing page for [RF Ranger](https://github.com/jdnelson19/RF-Ranger), served at **https://rfranger.app** by Cloudflare Pages.

- `public/`: the page (plain HTML, CSS and JS, no build step) and its screenshots
- `functions/api/latest.js`: `GET /api/latest`, the newest RF Ranger release and its Mac/Windows download links, read from GitHub and cached for 5 minutes. The download buttons use it, so nothing here changes when a version ships.
- `functions/api/feedback.js`: `POST /api/feedback`, turns the feedback form into a GitHub issue on RF-Ranger, labelled `feedback`

## Cloudflare Pages setup (once)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**, and pick `jdnelson19/rf-ranger-site`.
2. Build settings: framework **None**, build command *(empty)*, output directory **`public`**.
3. **Settings → Variables and Secrets**, add a **secret** `GITHUB_TOKEN` for Production (and Preview, if you want the form to work on previews):
   a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to **only** `jdnelson19/RF-Ranger` and the permission **Issues: Read and write**. Nothing else.
   It also raises the release lookup's GitHub rate limit.
4. **Custom domains → Set up a domain → `rfranger.app`** (and `www.rfranger.app` if you like). With the domain on Cloudflare DNS this is one click. `.app` domains are HTTPS-only, which Pages handles.
5. In the RF-Ranger repo, create a label named `feedback` (Issues → Labels) so submissions are easy to filter.

Pushes to `main` deploy automatically; other branches get preview URLs.

## Run it locally

```
npx wrangler pages dev
```

Opens http://localhost:8788 with the functions running. For the feedback form to create real issues locally, put `GITHUB_TOKEN=...` in a `.dev.vars` file (ignored by git). Without it the form answers "Feedback isn't set up yet".

## Screenshots

`public/screenshots/` are taken from RF Ranger's demo mode (`npm run demo` in RF-Ranger/server): fictional names, simulated hardware. Retake them at 1280×760, 2× scale, as WebP when the UI changes.

## Spam

The form has a hidden field that bots fill in, a minimum time on the page, size limits and a same-origin check. If spam gets through anyway, add [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) to the form and verify its token in `feedback.js`.
