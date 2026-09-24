# Deploy to a China-accessible host

`*.github.io` is sometimes slow or blocked on some mobile networks, so here are
two hosting options that are generally more reachable in mainland China.

Both are **free** and serve this project as-is (it's a static site — no build
step required). Both require signing in to your own account once.

---

## Option A — Cloudflare Pages (recommended)

The `wrangler` CLI is already installed on this machine.

```bash
# 1. One-time login (opens a browser window)
wrangler login

# 2. Create the Pages project (one-time)
wrangler pages project create superkid-saves-the-planet

# 3. Deploy the current folder
wrangler pages deploy . --project-name=superkid-saves-the-planet
```

You'll get a URL like: `https://superkid-saves-the-planet.pages.dev`

To update later, just re-run step 3.

---

## Option B — Vercel

```bash
# 1. One-time login
npx vercel login

# 2. Deploy (production)
npx vercel --prod
```

Vercel gives you a `https://<project>.vercel.app` URL.

---

## Using an API token instead of browser login

If you'd rather not run the login in a terminal, you can set a scoped token and
the deploy can run non-interactively:

```bash
# Cloudflare
export CLOUDFLARE_API_TOKEN=...   # Create at dash.cloudflare.com → My Profile → API Tokens
wrangler pages deploy . --project-name=superkid-saves-the-planet

# Vercel
export VERCEL_TOKEN=...           # vercel.com → Settings → Tokens
npx vercel --prod --yes
```

> Keep tokens private — never commit them to the repo.
