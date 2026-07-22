# ISW Wave

Live song-request platform for campus events, hack nights, and parties.

Guests scan a QR code, search YouTube, request tracks, and upvote the queue. Organizers moderate in a control room and drive **venue audio** from the admin laptop. A hall **display** stays silent and shows now playing, up next, and the join QR.

**Live app:** [isw-wave.isharaka.dev](https://isw-wave.isharaka.dev)  
**Showcase:** [wave.isharaka.dev](https://wave.isharaka.dev)
**Author:** Isharaka Shohan

> For AI / coding agents: read **[`AGENTS.md`](./AGENTS.md)** first. Update it after every major change.

---

## Core loop

```
Scan QR → search YouTube → request → (approve) → upvote queue → admin plays → display syncs → auto-advance
```

- **Admin device** = speakers / YouTube IFrame player (ToS-safe; display never plays audio).
- Queue order is **vote-first**, then queue position.
- When the live queue is empty, admin can loop a **fallback playlist** (also mirrored on the display).

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion |
| DB | Prisma 6 + LibSQL (local SQLite file · production **Turso**) |
| Realtime | Pusher Channels (optional; UI falls back to slow polling) |
| Media | YouTube Data API v3 (search) · YouTube IFrame API (admin playback) |
| Hosting | Vercel + custom domain `isw-wave.isharaka.dev` |

---

## Quick start (local)

```bash
npm install
cp .env.example .env   # fill required vars below
npx prisma migrate deploy
npm run db:seed
npm run dev            # http://localhost:3000
```

### Required `.env`

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Local file, e.g. `file:./prisma/dev.db` |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (**server-only**) |
| `ADMIN_PASSWORD` | Seeded organizer password |
| `SESSION_SECRET` | Long random string for signed auth cookies |
| `NEXT_PUBLIC_BASE_URL` | Public origin for QR links (`http://localhost:3000` locally) |

### Optional but recommended

| Variable | Purpose |
| --- | --- |
| `PUSHER_*` / `NEXT_PUBLIC_PUSHER_*` | Live votes / queue updates without aggressive polling |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Production DB (required on Vercel) |
| `MIN_SONG_SECONDS` | Filter Shorts/teasers (default `60`) |

**YouTube key tip:** enable *YouTube Data API v3* in Google Cloud. Do **not** lock the key to HTTP referrers — it is used from the server. Prefer IP / API restriction.

---

## Screens & roles

| Route | Who | Purpose |
| --- | --- | --- |
| `/login` | Guests + organizers | Join with access code, or admin login |
| `/e/{slug}` | Guests | Search, request, upvote · **Display** button → hall view |
| `/e/{slug}/display` | Projector / TV | Now playing, QR, up next (silent) |
| `/display?code=` | Legacy display | Same UI; prefer slug URL |
| `/admin` | Organizer laptop | Moderate, play audio, settings, fallback |
| `/organizer` | Organizer | List / switch / create events |

### Local smoke test

1. Log in as admin (`/login`) → open `/admin` with speakers.
2. Open `/e/{slug}/display` on another tab (projector).
3. On a phone (or another tab), open `/e/{slug}`, join with a name, search + request.
4. Approve in admin → upvote from guest → confirm queue order and display.
5. Let a track end (or hit Next) — next highest-voted song should start without replay glitches.

---

## Features (current)

- Multi-event organizers (slug URL + access code per event)
- Guest join by name + device lock (no email)
- YouTube search with DB cache (15 min) and daily quota tracking
- Pending moderation, bulk actions, blocked keywords / max duration
- Crowd upvotes on pending + approved (not currently playing)
- Vote-ranked “next” / auto-advance when a song ends
- Fallback playlist when the live queue is empty
- Display timeline sync (admin position ticks → smooth interpolation on display)
- Cinematic public UI (cyan / charcoal; art-tinted stage)
- Pusher realtime with slow safety polling + in-flight request dedupe
- Public QR always prefers custom domain (never `*.vercel.app`)

---

## Scripts

```bash
npm run dev              # app
npm run build
npm run db:seed          # seed admin + default event
npm run db:deploy        # prisma migrate deploy (local DATABASE_URL)
npm run db:turso         # apply migrations to Turso (production)
npm run db:turso -- --reset  # destructive Turso reset → then db:seed
npm run showcase:dev     # marketing site in ./showcase (if present)
```

---

## Deployment (Vercel + Turso)

Vercel’s filesystem is ephemeral — **local SQLite will not persist**. Use Turso:

1. Create a Turso DB and set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` on Vercel.
2. Apply schema:  
   `TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:turso`
3. Set also: `YOUTUBE_API_KEY`, `SESSION_SECRET`, `NEXT_PUBLIC_BASE_URL=https://isw-wave.isharaka.dev`, and Pusher keys.
4. Attach custom domain `isw-wave.isharaka.dev`. Disable Deployment Protection for public guest/QR routes if guests would otherwise hit Vercel SSO.
5. Redeploy after env changes.

**Showcase / portfolio landing** lives in [`showcase/`](./showcase) at `wave.isharaka.dev`. Deploy it as its **own** Vercel project.

---

## Project map (high level)

```
src/app/           # pages + API routes
src/lib/           # db, auth, youtube, realtime, polling, player
src/components/    # UI (incl. cinematic/)
prisma/            # schema + migrations + seed
scripts/           # turso-migrate, phase data helpers
showcase/          # marketing site (optional nested / separate repo)
AGENTS.md          # source-of-truth notes for coding agents
```

---

## License / status

Private project · actively used for live events. See `AGENTS.md` for architecture gotchas and maintenance rules.
