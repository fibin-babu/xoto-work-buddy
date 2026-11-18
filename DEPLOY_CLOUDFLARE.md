# Hosting on Cloudflare Workers

This app builds to a Cloudflare **Worker** (server-rendered, not a static site).
Production is the Worker `app`, served at **https://app.xotobuddy.workers.dev**.
`npm run build` produces `.output/`, and `npx wrangler deploy` ships it using the
generated `.output/server/wrangler.json`.

It reads and writes the Supabase database configured in the environment variables below.

---

## How production deploys (current setup)

The production Worker `app` is connected to this GitHub repo with Cloudflare
**Workers Builds** (Worker `app` → Settings → Build):

- **Branch:** `main` — every push to `main` builds and goes live automatically.
- **Build command:** `bun run build`
- **Deploy command:** `npx wrangler deploy --name app` (the `--name app` is required;
  without it Wrangler uses the generated name and deploys a separate Worker).
- **Build variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

Do work on a branch and merge to `main` only when it is ready to go live.
Build logs are under Worker `app` → **Deployments**.

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
