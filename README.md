# ISW Wave — Live Song Request System (Phase 1 MVP)

A live song-request wave for events. Attendees scan a QR code on the hall
screen, search YouTube for a song, and submit a request. The event's tech lead
approves requests from an admin dashboard; approved songs flow into a queue and
play — with the admin device driving venue audio.

**Core loop:** search → request → approve → queue → now playing.

This is the Phase 1 single-event MVP. No user accounts; identity is a display
name + session cookie. Admin is a single shared password.

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill in the values below
npx prisma migrate deploy # create the SQLite schema
npm run db:seed           # create the single event row
npm run dev               # http://localhost:3000
```

### Required environment variables (`.env`)

| Var | What it is |
| --- | --- |
| `DATABASE_URL` | Local dev DB. Leave as `file:./dev.db` (→ `prisma/dev.db`). |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key. Search is disabled without it. |
| `ADMIN_PASSWORD` | Password for the admin dashboard. Default in example is `changeme`. |
| `SESSION_SECRET` | Long random string used to sign session/admin cookies. |
| `NEXT_PUBLIC_BASE_URL` | Public URL encoded into the display-page QR code. |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Production only — see Deployment. |

**Get a YouTube API key:** [Google Cloud Console](https://console.cloud.google.com)
→ create a project → enable **YouTube Data API v3** → create an API key → paste
into `YOUTUBE_API_KEY`. The key is used **server-side only** and never reaches
the browser.

---

## The three screens

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | Attendees (phones) | Search a song, pick it, request with a name. Mobile-first. |
| `/display` | Projector / second screen | Now Playing hero + upcoming queue + QR code. **Silent, informational only.** Polls every 5s. |
| `/admin` | Tech lead (audio laptop) | Password-gated. Pending approvals, queue reorder, **the active YouTube player that produces venue audio**, and settings. |

### Try the full loop locally

1. Open **`/`**, search a real song (needs `YOUTUBE_API_KEY`), tap a result, enter a name, request it.
2. Open **`/admin`**, log in with `ADMIN_PASSWORD`, see the pending request, **Approve** it.
3. Open **`/display`** — the song is in the queue; the admin player promotes it to Now Playing.
4. In `/admin`, click **⏭ Next / Mark played** — the queue advances and Now Playing clears.

> The admin player is the one wired to speakers. Run `/admin` on the laptop
> connected to the hall audio, and `/display` on the projector. This is a hard
> requirement (and keeps the visible player YouTube-ToS compliant).

---

## Architecture notes

- **Next.js 14 App Router + TypeScript + Tailwind + Framer Motion.**
- **Database: Prisma + LibSQL driver adapter.** Local dev uses a plain SQLite
  file (`prisma/dev.db`); production points at a hosted Turso/LibSQL instance.
  Same schema, same queries — swapping to Postgres later is a provider change,
  not a rewrite. Path handling for the local file lives in `src/lib/db-config.ts`.
- **YouTube search** (`src/lib/youtube.ts`) proxies `search.list` server-side to
  protect the API key and quota, then fetches durations via `videos.list`.
  The request page requires an explicit **Search** button and a **500 ms
  debounce** — `search.list` costs 100 units against the 10k/day free quota, so
  per-keystroke search is deliberately impossible.
- **Sessions** (`src/lib/session.ts`) are random ids signed with HMAC. The
  client mirrors the id into `localStorage` and re-syncs the cookie on load
  (`/api/session`) because in-app browsers (Instagram/WhatsApp/camera) often
  drop cookies. Best-effort, not bulletproof — see the code comments.
- **Request limit** (default 3 active per attendee) is enforced **server-side**
  and stored on the `Event` row, adjustable in the admin Settings panel.
- **Realtime** is 5-second polling (`src/lib/useQueuePolling.ts`). Phase 3
  swaps this for WebSockets — the swap is isolated to that hook. Look for
  `TODO(Phase 3)`.
- **Multi-tenancy:** everything is keyed by `eventId`, but Phase 1 uses one
  fixed event (`src/lib/constants.ts` → `EVENT_ID`).

### API routes

| Method + Route | Purpose |
| --- | --- |
| `GET /api/search?q=` | Proxied YouTube search (server-side key). |
| `POST /api/requests` | Create a request; enforces the per-session limit. |
| `GET /api/requests?mine=1` | The caller's own requests (status list). |
| `GET /api/requests?status=pending` | Admin: list by status. |
| `PATCH /api/requests/:id` | Admin: `approve` / `reject` / `remove` / `move` / `play` / `next`. |
| `GET /api/queue` | Public: Now Playing + upcoming queue. |
| `GET`/`PATCH /api/settings` | Admin: request limit + approval mode. |
| `GET`/`POST`/`DELETE /api/admin/login` | Admin cookie auth. |
| `GET`/`POST /api/session` | Issue/sync the attendee session. |

---

## Deployment (Vercel + Turso)

Vercel's filesystem is **ephemeral**, so a local SQLite file will not persist.
Use Turso (hosted LibSQL) for any real deployment:

1. Install the Turso CLI, then:
   ```bash
   turso db create isw-wave
   turso db show isw-wave --url          # → TURSO_DATABASE_URL
   turso db tokens create isw-wave       # → TURSO_AUTH_TOKEN
   ```
2. Apply the schema to Turso (point `DATABASE_URL` at the libsql URL for the
   migrate step, or use `turso db shell` with the generated migration SQL).
3. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `YOUTUBE_API_KEY`,
   `ADMIN_PASSWORD`, `SESSION_SECRET`, and `NEXT_PUBLIC_BASE_URL` in the Vercel
   project's environment variables. When `TURSO_DATABASE_URL` is set, the app
   uses it automatically (see `src/lib/db-config.ts`).

---

## Scope boundaries (intentionally NOT built in Phase 1)

- No signup/login (name + session only) — Phase 2.
- No WebSockets (polling instead) — Phase 3.
- No crowd voting — Phase 3.
- No multi-event UI (schema is ready, one event row used) — Phase 5.
- YouTube ads can't be skipped via the API; preloading only removes the
  load-time gap between songs, not ads. This is a platform limitation.
