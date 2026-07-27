# AGENTS.md — ISW Wave

**Purpose:** Onboarding for any coding agent (Cursor, Claude, Codex, etc.) working in this repo.

**Maintenance rule:** Update this file after **every major feature, architecture change, or operational gotcha**. Keep it accurate — prefer short bullets over essays. If README and this file disagree, fix both.

**Last reviewed:** 2026-07-26 (fallback playlist import + smart fill; Flutter dual-mode admin; Phase 4 safety).

---

## What this product is

ISW Wave is a **multi-tenant live song-request app** for events.

| Role | Job |
| --- | --- |
| **Guest** | Join `/e/{slug}` with a display name; search YouTube; request; upvote queue |
| **Organizer / admin** | Own events; moderate; **play venue audio** on `/admin` (YouTube IFrame); change password |
| **Display** | Silent hall screen: now playing + QR + up next (`/e/{slug}/display`) |
| **Owner / moderator** | Hidden `/ops/<OWNER_PANEL_PATH>` — named staff logins, dashboard, Requests, Invites (mint/revoke codes), ban guests, top songs, reset organizer passwords, activity logs |

**Root `/` is a public landing page** (`src/components/landing/LandingPage.tsx`), not a redirect. Signed-in users still bounce to `/admin` or `/e/{slug}`; anonymous visitors get marketing + a primary "I have an event code" CTA.

**Hard rule:** Only the **admin** laptop produces sound. Display is informational (YouTube ToS + architecture). Owner is **ops/monitor**, not a second player.

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
- Flutter dual-mode admin: `apps/isw_wave_admin/` — organizer control room + staff ops (Android first). Staff login returns Bearer `token` (`signStaffToken`); phone is remote control only (no venue audio).

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
  ops/[path]/              # hidden owner console (404 unless path matches env)
  api/                     # REST handlers (see below)
src/lib/
  db.ts, db-config.ts      # Prisma client + Turso/local adapters
  auth.ts / auth-core.ts   # isw_auth + owner cookie + Bearer support
  song-play-stats.ts       # daily play rollups + prune
  youtube*.ts              # search, cache, quota
  realtime*.ts             # Pusher publish + shared channel/event names
  useQueuePolling.ts       # queue fetch + Pusher debounce + poll
  useYouTubePlayer.ts      # admin player (load-once, ENDED guard)
  …
apps/isw_wave_admin/       # Flutter control-room MVP
prisma/schema.prisma
scripts/turso-migrate.ts
AGENTS.md / README.md
```

---

## Data model (brief)

- **Organization** ← owns → **User** (organizer) + many **Event**
- **Event**: slug, accessCode, theme, limits, `currentRequestId`, `currentFallbackId`, playback timeline fields, `suspended` / `suspendReason`, `youtubeDailyQuotaCap`
- **Participant**: per-event device lock; **`banned` / `bannedAt` / `banReason`**
- **Request**: pending / approved / rejected / played…; `queuePosition`, `voteCount`
- **Vote**: unique `(requestId, participantId)`
- **FallbackTrack**: ordered playlist when live queue empty
- **SongPlayStat**: `(dayKey, eventId, youtubeVideoId)` play counts — **prune days &lt; today** on write
- **SearchCache**, **YouTubeQuotaDay**: shared YouTube helpers; **EventYouTubeQuotaDay**: per-event daily units
- **User.staffRole**: `""` = organizer, `"owner"` / `"moderator"` = site staff; plus `disabledAt`, `eventLimit` (0 = unlimited, enforced in `POST /api/events`)
- **ActivityLog**: audit trail (type, actor, target, details, IP, UA) — pruned past `LOG_RETENTION_DAYS` (default 30)
- **EventRequest**: public host application (contact, org, details, `startsAt` + `timezone`, `publicToken` for the status page). Approval stores `createdUserId` / `createdEventId`
- **PasswordSetupToken**: single-use, SHA-256 hashed, 72h TTL — approval emails carry a link, **never a password**

Never hard-code a single `EVENT_ID` in APIs — resolve from session, `?code=`, `?eventId=`, or slug.

---

## Auth

- Cookie name: `isw_auth` (`AUTH_COOKIE`)
- Staff cookie: `isw_owner` (`OWNER_COOKIE`) — `staff.{userId}.{hmac}`, carries identity so actions are attributable
- Admin: `admin.{userId}.{eventId}.{hmac}` (active event switchable)
- Guest: `participant.{participantId}.{hmac}` — banned participants resolve as logged out
- **Bearer**: `Authorization: Bearer <token>` accepted (same token string as cookie). Organizer login + event switch return `{ token }`. Staff login (`POST /api/owner/login`) returns `{ token }` (`staff.{userId}.{hmac}`) and `getStaffSession()` accepts Bearer or `isw_owner` cookie.
- Ops gate: `OWNER_PANEL_PATH` (env) — wrong path → `notFound()`. Staff accounts gate the data.
- `requireStaff()` = owner or moderator; `requireStaffOwner()` = owner only (staff mgmt, credentials, log deletion)
- `OWNER_PASSWORD` is a **bootstrap credential**: works only while zero staff accounts exist, then creates/promotes that account to owner
- Admin password change: `POST /api/auth/password`
- Owner reset organizer: `POST /api/owner/admin-password`
- Guests join via `POST /api/auth/join` — rejected if banned
- **Organizer signup is invite-gated:** `POST /api/auth/signup` accepts a code from the `InviteCode` table (ops **Invites** tab) or the legacy `ORGANIZER_INVITE_CODE` env fallback. **Fails closed** when neither has a usable code → 503. DB codes support label, maxUses, expiresAt, revoke, and per-code `eventLimit`. Rationale: shared YouTube quota. `GET /api/auth/signup` reports `{ inviteRequired, open }`.
- Legacy `useSession` / `/api/session` are obsolete — do not revive

---

## Important API surfaces

| Area | Routes |
| --- | --- |
| Auth | `/api/auth/{join,login,signup,logout,me,password}` |
| Search | `GET /api/search?q=` (session + event-scoped) · `GET /api/quota` |
| Requests | `/api/requests`, `/api/requests/[id]` (`approve|reject|remove|move|play|next`), `/api/requests/bulk` |
| Votes | `POST /api/votes` |
| Queue / display | `GET /api/queue` (includes `playback`, `nowPlayingIsFallback`) |
| Playback | `POST /api/playback` — fallback pointer + timeline ticks |
| Fallback | `/api/fallback` (`import_playlist`, `add_many`, legacy single-add) · `GET /api/fallback/suggest` |
| Settings / events | `/api/settings`, `/api/events`, `/api/events/switch` |
| Staff ops | `/api/owner/{login,logout,overview,ban,admin-password,top-songs,logs}`, `/api/owner/staff[/id]`, `/api/owner/event-requests[/id]`, `/api/owner/invite-codes[/id]`, `/api/owner/events/[eventId]` |
| Host requests | `POST /api/event-requests` (public, rate-limited + honeypot) · `GET|POST /api/auth/set-password` |

### Playback / realtime gotcha (critical)

`POST /api/playback` must **NOT** call `notifyQueue` on timeline ticks or `resetTimeline`. Only broadcast when the **fallback track pointer** changes. Timeline spam caused client queue-fetch storms.

### Staff ops console

- Never link from public UI / login.
- Document path only via env + this file.
- Tabbed panel (`src/app/ops/[path]/panels/`): Dashboard · Requests · Events · Organizers · Invites · Staff · Logs.
- Ban guests with `POST /api/owner/ban`; join/request/vote blocked for banned participants.
- `SongPlayStat` increments on `action: "next"`; prune older days automatically.
- **Every mutating staff route must call `logActivity()`** (`src/lib/activity-log.ts`) — add new action types to `ACTIVITY_TYPES` so the Logs filter and cleanup dropdown pick them up.
- Ops login is rate limited via `src/lib/rate-limit.ts` (in-memory, per lambda — friction, not a hard global cap).

### Request-to-host flow (phase 2, shipped)

1. Public form at `/host` → `POST /api/event-requests` (3/hour per IP, honeypot field `website`, duplicate pending email returns the existing token).
2. Requester tracks state at `/host/{publicToken}` — no account needed.
3. Staff review in the ops **Requests** tab. Approve is editable (event name, slug, `eventLimit`) because organizers submit slugs like "our event 2026".
4. Approval runs in one transaction: `User` (isAdmin, `eventLimit`) + `Organization` + `Event` + status update, then issues a `PasswordSetupToken`.
5. Organizer sets their password at `/organizer/set-password?token=` → `/login?mode=admin`.

**Email is optional by design.** Without `RESEND_API_KEY`, approval still succeeds and the console returns a copy-ready handover (username, setup link, join URL, access code). Never make approval depend on email delivery.

Schedule fields are **metadata only** — do not gate guest joins on `startsAt` without an explicit decision.

#### Safety controls (phase 4, shipped)

- `Event.suspended` / `suspendedAt` / `suspendReason` — staff toggle in ops **Events** tab. Blocks guest join, search, request, vote; participant sessions resolve as logged out. Organizer admin + ops stay up.
- `Event.youtubeDailyQuotaCap` (0 = unlimited) + `EventYouTubeQuotaDay` — uncached searches charge `SEARCH_FLOW_COST` (101) against both the global day counter and the event counter. Cache hits free. `/api/search` requires a participant or admin session so usage is attributable.
- Mutating ops route: `PATCH /api/owner/events/[eventId]` `{ action: "suspend"|"unsuspend"|"quota_cap" }` — every action `logActivity()`'d.

#### Remaining planned phases

None from the original 4-phase ops plan. Further work (e.g. per-organizer YouTube API keys) stays out of scope unless requested.
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
- **No recommendation API:** `relatedToVideoId` is gone — do not fake “the algorithm” with search loops
- **Fallback bulk fill (prefer over search spam):**
  - Playlist URL import: `playlistItems.list` + batched `videos.list` ≈ **2–5 units** for ~40 tracks (`POST /api/fallback` `import_playlist`)
  - Suggest from this event’s played/approved requests: **0** units (`GET /api/fallback/suggest`)
  - Cold-start top-up: `videos.list?chart=mostPopular&videoCategoryId=10` ≈ **1** unit (day-cached in process)
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

Staff ops: `OWNER_PANEL_PATH` (random slug) + `OWNER_PASSWORD` (bootstrap only) + optional `LOG_RETENTION_DAYS`

Organizer gate: create codes in ops **Invites** tab (preferred). Optional legacy: `ORGANIZER_INVITE_CODE`. Signup closed when neither is usable.

Seed-related: `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`

---

## Do / don’t (for agents)

**Do**

- Keep admin as sole audio source
- Deduplicate network fetches; prefer Pusher + slow polls
- Update `README.md` + **this file** on major changes
- Match existing cinematic / cyan UI language on public surfaces
- Use `eventDisplayPath` / `getPublicBaseUrl` for links and QR
- After schema changes: `npm run db:turso` on production

**Don’t**

- Migrate to Supabase “for speed” without evidence — past lag was **client poll storms**, not Turso
- Call `notifyQueue` on every playback tick
- Reintroduce sub-second polling
- Put venue playback on the display page
- Link the owner `/ops/…` URL from public pages or login
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
