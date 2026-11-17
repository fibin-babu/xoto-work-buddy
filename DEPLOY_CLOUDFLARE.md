# Hosting on Cloudflare Workers

This app builds to a Cloudflare **Worker** (server-rendered, not a static site).
Production is the Worker `app`, served at **https://app.xotobuddy.workers.dev**.
`npm run build` produces `.output/`, and `npx wrangler deploy` ships it using the
generated `.output/server/wrangler.json`.

It reads and writes the Supabase database configured in the environment variables below.

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
| `GOOGLE_MAPS_API_KEY` | runtime (secret) | only for Maps place-name search (pasting a link works without) |

Get the values from Supabase → **Project Settings → API**. The **service role key**
(`service_role`) bypasses row-level security — treat it like a password.

## Notes
- `npm run deploy` publishes to the Worker named `app` (→ `app.xotobuddy.workers.dev`).
  Add a custom domain in the Cloudflare dashboard if needed.
- Database migrations are **not** run by the deploy. Apply new SQL from
  `drizzle/migrations` / the root `*.sql` files in Supabase → **SQL Editor** first.
- `LOVABLE_CRON_SECRET` and `LOVABLE_API_KEY` are no longer used; you can delete
  them from the Worker's secrets.
