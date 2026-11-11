# Hosting on Cloudflare Workers

This app builds to a Cloudflare **Worker** (server-rendered, not a static site).
`npm run build` produces `.output/`, and `npx wrangler deploy` ships it using the
generated `.output/server/wrangler.json`.

It talks to the **same Supabase database** as your Lovable site, so data is shared.

---

## Option A — Deploy from GitHub (recommended, auto-deploys on push)

1. Go to **dash.cloudflare.com → Workers & Pages → Create → Workers → Import a repository**.
2. Pick **`fibin-babu/xoto-work-buddy`** and the `main` branch.
3. Build settings:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
4. Add the environment variables (see the list below) under the project's
   **Settings → Variables and Secrets**. Mark the keys as **Secret**.
5. Deploy. Every push to `main` then redeploys automatically.

## Option B — Deploy from your computer (one-off)

```bash
npx wrangler login          # opens the browser to authorise
cp .env.example .env        # then fill in the real values
npm install
npm run build               # bakes the VITE_* values into the browser bundle
npx wrangler deploy         # publishes the Worker
```

Then set the server (runtime) secrets once:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Re-run `npm run build && npx wrangler deploy` whenever you change the code.

---

## Environment variables

| Name | Where | Needed for |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | build | the browser app |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build | the browser app |
| `SUPABASE_URL` | runtime (secret) | login, attendance |
| `SUPABASE_PUBLISHABLE_KEY` | runtime (secret) | login, attendance |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime (secret) | admin: create / suspend / delete users |
| `LOVABLE_CRON_SECRET` | runtime (secret) | only if you use the cron endpoint |
| `GOOGLE_MAPS_API_KEY`, `LOVABLE_API_KEY` | runtime (secret) | only for Maps place-name search (pasting a link works without) |

Get the values from Lovable (Project → Supabase/Settings). The **service role key**
is in Supabase → Project → **API → `service_role`** — treat it like a password.

## Notes
- Your first URL will be `https://tanstack-start-ts.<your-account>.workers.dev`.
  Rename the Worker or add a custom domain in the Cloudflare dashboard.
- Database migrations still run through **Lovable**, not Cloudflare. This host only
  serves the app; it reads/writes the same Supabase database.
