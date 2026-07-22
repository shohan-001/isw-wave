# AGENTS.md — ISW Wave

**Purpose:** Onboarding for any coding agent (Cursor, Claude, Codex, etc.) working in this repo.

**Maintenance rule:** Update this file after **every major feature, architecture change, or operational gotcha**. Keep it accurate — prefer short bullets over essays. If README and this file disagree, fix both.

**Last reviewed:** 2026-07-22 (favicon, display button, poll/autoplay/vote optimization, cinematic UI, voting, Pusher, Turso).

---

## What this product is

ISW Wave is a **multi-tenant live song-request app** for events.

| Role | Job |
| --- | --- |
| **Guest** | Join `/e/{slug}` with a display name; search YouTube; request; upvote queue |
| **Organizer / admin** | Own events; moderate; **play venue audio** on `/admin` (YouTube IFrame) |
| **Display** | Silent hall screen: now playing + QR + up next (`/e/{slug}/display`) |

**Hard rule:** Only the **admin** laptop produces sound. Display is informational (YouTube ToS + architecture).

**Production URLs**

- App: `https://isw-wave.isharaka.dev`
- Showcase: `https://wave.isharaka.dev` (separate repo / `showcase/` folder)

---

## Stack cheat sheet

- Next.js 14 App Router · React 18 · TypeScript · Tailwind · Framer Motion
- Prisma 6 + `@prisma/adapter-libsql` + `@libsql/client`
  - Local: `DATABASE_URL=file:./prisma/dev.db`
  - Prod: Turso via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
- Pusher Channels (optional realtime)
- YouTube Data API v3 (search, server-only) + IFrame API (admin player)

---

## Directory map

```
src/app/
  page.tsx                 # role-based redirects
  login/                   # guest join + admin login UI
  e/[slug]/                # guest request page
  e/[slug]/display/        # preferred hall display
  display/                 # DisplayClient + legacy /display
  admin/                   # AdminDashboard (player + moderation)
  organizer/               # event list / signup / create
  api/                     # REST handlers (see below)
src/lib/
  db.ts, db-config.ts      # Prisma client + Turso/local adapters
  auth.ts                  # isw_auth cookie (HMAC)
  youtube*.ts              # search, cache, quota
  realtime*.ts             # Pusher publish + shared channel/event names
  useQueuePolling.ts       # queue fetch + Pusher debounce + poll
  useYouTubePlayer.ts      # admin player (load-once, ENDED guard)
  useEventRealtime.ts      # client Pusher subscribe
  public-url.ts            # QR base URL (blocks *.vercel.app)
  slug.ts                  # eventPath / eventDisplayPath helpers
  moderation.ts, theme.ts, types.ts, queries.ts, constants.ts
src/components/cinematic/  # CinematicStage, GlassPanel, AlbumCarousel, …
prisma/schema.prisma       # source of truth for models
scripts/turso-migrate.ts   # production migrations (not plain prisma migrate on libsql)
AGENTS.md / README.md
```

---

## Data model (brief)

- **Organization** ← owns → **User** (organizer) + many **Event**
- **Event**: slug, accessCode, theme, limits, `currentRequestId`, `currentFallbackId`, `playbackPositionSec` / `playbackPlaying` / `playbackUpdatedAt`
- **Participant**: per-event device lock (`eventId` + `deviceId`)
- **Request**: pending / approved / rejected / played…; `queuePosition`, `voteCount`
- **Vote**: unique `(requestId, participantId)`
- **FallbackTrack**: ordered playlist when live queue empty
- **SearchCache**, **YouTubeQuotaDay**: shared YouTube helpers

Never hard-code a single `EVENT_ID` in APIs — resolve from session, `?code=`, `?eventId=`, or slug.

---

## Auth

- Cookie name: `isw_auth` (`AUTH_COOKIE` in `src/lib/constants.ts`)
- Admin: `admin.{userId}.{eventId}.{hmac}` (active event switchable)
- Guest: `participant.{participantId}.{hmac}`
- Guests join via `POST /api/auth/join` `{ name, code|slug, deviceId }` — device keeps one display name per event
- Organizers: signup → org → create events → login
- Legacy `useSession` / `/api/session` are obsolete — do not revive

---

## Important API surfaces

| Area | Routes |
| --- | --- |
| Auth | `/api/auth/{join,login,signup,logout,me}` |
| Search | `GET /api/search?q=` · `GET /api/quota` |
| Requests | `/api/requests`, `/api/requests/[id]` (`approve|reject|remove|move|play|next`), `/api/requests/bulk` |
| Votes | `POST /api/votes` |
| Queue / display | `GET /api/queue` (includes `playback`, `nowPlayingIsFallback`) |
| Playback | `POST /api/playback` — fallback pointer + timeline ticks |
| Fallback | `/api/fallback` |
| Settings / events | `/api/settings`, `/api/events`, `/api/events/switch` |

### Playback / realtime gotcha (critical)

`POST /api/playback` must **NOT** call `notifyQueue` on timeline ticks or `resetTimeline`. Only broadcast when the **fallback track pointer** changes. Timeline spam caused client queue-fetch storms.

---

## Realtime & polling

- Channel: `event-{eventId}`
- Events: `queue:update`, `pending:update`, `requests:update`, `fallback:update`, `settings:update`
- Env: `PUSHER_*` + `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER`
- Without Pusher: slow polling only (~8s+). With Pusher: rare safety poll (~45s+) + debounced refetch on events
- `useQueuePolling`: **in-flight dedupe** + pending-after-flight; never stack parallel `/api/queue` calls

---

## YouTube

- Search cost ≈ **101 units**/uncached query (100 search + 1 videos) against ~10k/day free quota
- Cache TTL **15 minutes** (`SearchCache`)
- Filter duration &lt; `MIN_SONG_SECONDS` (default 60)
- Admin player (`useYouTubePlayer`):
  - Load video **only when id changes**
  - Play once on CUED; do **not** spam `playVideo` retries (causes end→replay→skip)
  - Guard duplicate `ENDED`; allow retry if advance fails after ~4s

---

## UI / product behavior agents should preserve

1. **Display mobile:** QR must **not** overlay album art (art + title, then compact QR row / desktop sidebar).
2. **Timeline:** display interpolates locally; re-anchor only on song change, play/pause, or &gt;1.5s drift (`useSyncedElapsed` in `DisplayClient`).
3. **Votes:** optimistic UI on guest; server still authoritative; queue sort `voteCount desc`, then `queuePosition`.
4. **Fallback as nowPlaying:** queue API may return fallback mirrored as `nowPlaying` with `nowPlayingIsFallback: true`. Admin must not treat that id as a live `Request` for PATCH.
5. **Public URL:** `getPublicBaseUrl()` — never encode `*.vercel.app` into QR (Deployment Protection). Prod default `https://isw-wave.isharaka.dev`.
6. **Cinematic public UI:** cyan/charcoal; ignore organizer pink accent on guest/display surfaces unless product direction changes.
7. **Request page** has a **Display** link → `eventDisplayPath(slug)`.

---

## Database commands

```bash
# Local
npx prisma migrate deploy
npm run db:seed

# Production Turso (required — Prisma CLI cannot migrate libsql:// directly)
TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:turso
# Destructive:
npm run db:turso -- --reset   # then seed
```

After adding a Prisma migration, run `db:turso` against production or the live event DB will miss columns (playback fields, fallback pointer, etc.).

---

## Env checklist (Vercel)

Required: `TURSO_*`, `YOUTUBE_API_KEY`, `SESSION_SECRET`, `NEXT_PUBLIC_BASE_URL=https://isw-wave.isharaka.dev`

Strongly recommended: full Pusher set (`PUSHER_APP_ID/KEY/SECRET/CLUSTER` + matching `NEXT_PUBLIC_PUSHER_*`)

Seed-related: `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`

---

## Do / don’t (for agents)

**Do**

- Keep admin as sole audio source
- Deduplicate network fetches; prefer Pusher + slow polls
- Update `README.md` + **this file** on major changes
- Match existing cinematic / cyan UI language on public surfaces
- Use `eventDisplayPath` / `getPublicBaseUrl` for links and QR

**Don’t**

- Migrate to Supabase “for speed” without evidence — past lag was **client poll storms**, not Turso
- Call `notifyQueue` on every playback tick
- Reintroduce sub-second polling
- Put venue playback on the display page
- Commit secrets (`.env`, tokens)
- Use interactive git (`-i`) or force-push `main` unless explicitly asked

---

## Showcase site

Marketing landing may live in `./showcase` or GitHub `shohan-001/isw-wave-showcase`.

- Live app CTA env: `NEXT_PUBLIC_APP_URL=https://isw-wave.isharaka.dev`
- Site URL: `NEXT_PUBLIC_SITE_URL=https://wave.isharaka.dev`
- Deploy as a **separate** Vercel project

---

## Suggested agent workflow for big changes

1. Read this file + relevant paths above  
2. Prefer small, focused diffs  
3. Typecheck: `npx tsc --noEmit`  
4. Manually smoke: search → request → approve → vote → next/auto-advance → display mobile layout  
5. If schema changed: local migrate + document `db:turso` for prod  
6. **Update this `AGENTS.md` “Last reviewed” date and any changed sections**  
7. Update `README.md` feature/route lists if user-facing  

---

## Out of scope (unless explicitly requested)

- Native mobile admin apps
- Per-organizer YouTube API keys
- Skipping YouTube ads (platform limitation)
- Replacing Turso solely for perceived speed without profiling
