"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

type OverviewEvent = {
  id: string;
  name: string;
  slug: string;
  accessCode: string;
  organizationName: string;
  admin: { id: string; username: string; email: string };
  participantCount: number;
  activeGuestCount: number;
  bannedCount: number;
  pendingCount: number;
  queueDepth: number;
  nowPlaying: {
    id: string;
    title: string;
    youtubeVideoId: string;
    requesterName: string;
  } | null;
  playbackPlaying: boolean;
  updatedAt: string;
};

type TopSong = {
  eventId: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  playCount: number;
};

type Organizer = {
  id: string;
  username: string;
  email: string;
  eventCount: number;
};

type ParticipantRow = {
  id: string;
  displayName: string;
  deviceId: string;
  banned: boolean;
  banReason: string;
  requestCount: number;
  voteCount: number;
  createdAt: string;
};

type Overview = {
  dayKey: string;
  events: OverviewEvent[];
  topSongs: TopSong[];
  organizers: Organizer[];
};

export function OwnerOpsClient() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [data, setData] = useState<Overview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [eventTop, setEventTop] = useState<TopSong[]>([]);
  const [banBusy, setBanBusy] = useState<string | null>(null);

  const [resetUserId, setResetUserId] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);

  const probe = useCallback(async () => {
    const res = await fetch("/api/owner/login", { cache: "no-store" });
    const d = (await res.json().catch(() => ({}))) as { ok?: boolean };
    setAuthed(Boolean(res.ok && d.ok));
  }, []);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/owner/overview", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      setData(null);
      return;
    }
    if (!res.ok) return;
    const d = (await res.json()) as Overview;
    setData(d);
  }, []);

  const loadEvent = useCallback(async (eventId: string) => {
    const res = await fetch(`/api/owner/events/${eventId}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const d = (await res.json()) as {
      participants: ParticipantRow[];
      topSongs: TopSong[];
    };
    setParticipants(d.participants);
    setEventTop(d.topSongs);
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    if (!authed) return;
    void loadOverview();
    const t = setInterval(() => void loadOverview(), 7000);
    return () => clearInterval(t);
  }, [authed, loadOverview]);

  useEffect(() => {
    if (!selectedId || !authed) return;
    void loadEvent(selectedId);
    const t = setInterval(() => void loadEvent(selectedId), 8000);
    return () => clearInterval(t);
  }, [selectedId, authed, loadEvent]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginErr(null);
    try {
      const res = await fetch("/api/owner/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setLoginErr(d.error || "Access denied.");
        return;
      }
      setPassword("");
      setAuthed(true);
    } catch {
      setLoginErr("Network error.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/owner/logout", { method: "POST" });
    setAuthed(false);
    setData(null);
    setSelectedId(null);
  }

  async function toggleBan(p: ParticipantRow) {
    setBanBusy(p.id);
    try {
      const res = await fetch("/api/owner/ban", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participantId: p.id,
          banned: !p.banned,
          reason: p.banned ? "" : "Banned by owner",
        }),
      });
      if (res.ok && selectedId) await loadEvent(selectedId);
      await loadOverview();
    } finally {
      setBanBusy(null);
    }
  }

  async function resetAdminPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetMsg(null);
    setResetErr(null);
    const res = await fetch("/api/owner/admin-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: resetUserId, newPassword: resetPw }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setResetErr(d.error || "Reset failed.");
      return;
    }
    setResetPw("");
    setResetMsg("Password updated for organizer.");
  }

  if (authed === null) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-ink text-white/40">
        Checking session…
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#07080c] px-4">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-glow"
        >
          <BrandMark size={36} />
          <h1 className="mt-4 font-display text-xl font-bold text-white">
            Ops console
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Restricted access. Enter the owner passphrase.
          </p>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-5 w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white focus:border-pulse/50 focus:outline-none"
            placeholder="Passphrase"
          />
          {loginErr ? (
            <p className="mt-2 text-xs text-rose-300">{loginErr}</p>
          ) : null}
          <button
            type="submit"
            disabled={loginBusy || !password}
            className="mt-4 w-full rounded-xl bg-pulse py-2.5 text-sm font-bold text-ink disabled:opacity-50"
          >
            {loginBusy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </main>
    );
  }

  const selected = data?.events.find((e) => e.id === selectedId) ?? null;

  return (
    <main className="min-h-[100dvh] bg-[#07080c] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07080c]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark size={28} showWordmark={false} />
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-pulse">
                Owner ops
              </p>
              <p className="text-xs text-white/40">
                Live · {data?.dayKey ?? "…"} · auto-refresh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/60"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
            Events ({data?.events.length ?? 0})
          </h2>
          {!data?.events.length ? (
            <p className="text-sm text-white/35">No events yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.events.map((ev) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(ev.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedId === ev.id
                        ? "border-pulse/40 bg-pulse/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg font-bold">
                          {ev.name}
                        </p>
                        <p className="truncate text-xs text-white/40">
                          /e/{ev.slug} · {ev.admin.username} · code{" "}
                          {ev.accessCode}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          ev.nowPlaying
                            ? "bg-pulse/20 text-pulse"
                            : "bg-white/10 text-white/40"
                        }`}
                      >
                        {ev.nowPlaying
                          ? ev.playbackPlaying
                            ? "Live"
                            : "Idle track"
                          : "Quiet"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm text-white/70">
                      {ev.nowPlaying
                        ? `♪ ${ev.nowPlaying.title}`
                        : "Nothing playing"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/50">
                      <Chip label="Guests" value={ev.activeGuestCount} />
                      <Chip label="Banned" value={ev.bannedCount} />
                      <Chip label="Pending" value={ev.pendingCount} />
                      <Chip label="Queue" value={ev.queueDepth} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-pulse">
              Top songs today
            </h2>
            <ul className="mt-3 space-y-2">
              {(data?.topSongs ?? []).slice(0, 8).map((s) => (
                <li
                  key={`${s.eventId}-${s.youtubeVideoId}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="w-6 tabular-nums text-pulse">
                    {s.playCount}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-white/80">
                    {s.title}
                  </span>
                </li>
              ))}
              {!data?.topSongs?.length ? (
                <li className="text-sm text-white/35">No plays recorded yet.</li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
              Reset organizer password
            </h2>
            <form onSubmit={resetAdminPassword} className="mt-3 space-y-2">
              <select
                value={resetUserId}
                onChange={(e) => setResetUserId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm"
              >
                <option value="">Select organizer…</option>
                {(data?.organizers ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.username} ({o.email})
                  </option>
                ))}
              </select>
              <input
                type="password"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="New password (min 8)"
                className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm"
              />
              {resetErr ? (
                <p className="text-xs text-rose-300">{resetErr}</p>
              ) : null}
              {resetMsg ? (
                <p className="text-xs text-pulse">{resetMsg}</p>
              ) : null}
              <button
                type="submit"
                disabled={!resetUserId || resetPw.length < 8}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Set password
              </button>
            </form>
          </section>

          {selected ? (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
                Guests · {selected.name}
              </h2>
              {eventTop.length ? (
                <p className="mt-2 text-xs text-white/40">
                  Event top today: {eventTop[0].title} ({eventTop[0].playCount}
                  ×)
                </p>
              ) : null}
              <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
                {participants.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {p.displayName}
                        {p.banned ? (
                          <span className="ml-2 text-[10px] uppercase text-rose-300">
                            banned
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-white/35">
                        {p.requestCount} req · {p.voteCount} votes · {p.deviceId}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={banBusy === p.id}
                      onClick={() => void toggleBan(p)}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                        p.banned
                          ? "bg-white/10 text-white/70"
                          : "bg-rose-500/20 text-rose-200"
                      }`}
                    >
                      {p.banned ? "Unban" : "Ban"}
                    </button>
                  </li>
                ))}
                {!participants.length ? (
                  <li className="text-sm text-white/35">No guests yet.</li>
                ) : null}
              </ul>
            </section>
          ) : (
            <p className="text-sm text-white/35">
              Select an event to manage guests.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-white/[0.06] px-2 py-0.5">
      {label} <strong className="text-white/80">{value}</strong>
    </span>
  );
}
