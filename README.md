# Xoto Task Hub

Daily work tracker for Xoto Proptech. Employees sign in with their company email,
clock in and out, take breaks, and log the tasks they completed. Team managers see
their team's work; organization admins see every metric (time in, time out, tasks,
locations) and manage people, teams and roles.

**Live app**: https://app.xotobuddy.workers.dev

## Stack

- React + TanStack Start (server-rendered), Vite, Tailwind, shadcn/ui
- Supabase for auth and the Postgres database
- Hosted as a Cloudflare Worker — see [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md)

## Development

You need Node.js 22+ and [Bun](https://bun.sh) (or npm).

```sh
cp .env.example .env   # fill in the Supabase values
bun install
bun run dev
```

Other scripts: `bun run build`, `bun run test`, `bun run lint`, `bun run deploy`.

## Database changes

Schema changes live in `drizzle/migrations` and the `*.sql` files at the repo root.
Apply them in the Supabase dashboard (**SQL Editor**) before deploying code that
depends on them.
