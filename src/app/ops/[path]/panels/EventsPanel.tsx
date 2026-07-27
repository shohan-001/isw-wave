"use client";

import { useCallback, useEffect, useState } from "react";
import type { Overview, ParticipantRow, TopSong } from "../types";

export function EventsPanel({
  data,
  onChanged,
}: {
  data: Overview | null;
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [eventTop, setEventTop] = useState<TopSong[]>([]);
  const [banBusy, setBanBusy] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [capInput, setCapInput] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  const loadEvent = useCallback(async (eventId: string) => {
    const res = await fetch(`/api/owner/events/${eventId}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const d = (await res.json()) as {
      participants: ParticipantRow[];
      topSongs: TopSong[];
      event?: { youtubeDailyQuotaCap?: number; suspendReason?: string };
    };
    setParticipants(d.participants);
    setEventTop(d.topSongs);
    if (d.event) {
      setCapInput(String(d.event.youtubeDailyQuotaCap ?? 0));
      setSuspendReason(d.event.suspendReason || "");
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadEvent(selectedId);
    const t = setInterval(() => void loadEvent(selectedId), 8000);
    return () => clearInterval(t);
  }, [selectedId, loadEvent]);

  useEffect(() => {
    const selected = data?.events.find((e) => e.id === selectedId);
    if (selected) {
      setCapInput(String(selected.youtubeDailyQuotaCap ?? 0));
      setSuspendReason(selected.suspendReason || "");
    }
  }, [selectedId, data]);

  async function toggleBan(p: ParticipantRow) {
    setBanBusy(p.id);
    try {
      const res = await fetch("/api/owner/ban", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participantId: p.id,
          banned: !p.banned,
          reason: p.banned ? "" : "Banned from ops console",
        }),
      });
      if (res.ok && selectedId) await loadEvent(selectedId);
      onChanged();
    } finally {
      setBanBusy(null);
    }
  }

  async function patchEvent(body: Record<string, unknown>, okMsg: string) {
    if (!selectedId) return;
    setActionBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/owner/events/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(d.error || "Action failed.");
        return;
      }
      setMsg(okMsg);
      await loadEvent(selectedId);
      onChanged();
    } finally {
      setActionBusy(false);
    }
  }

  const selected = data?.events.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
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
                        {ev.suspended ? (
                          <span className="ml-2 rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-200">
                            Suspended
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-white/40">
                        /e/{ev.slug} · {ev.admin.username} · code {ev.accessCode}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                        ev.suspended
                          ? "bg-rose-500/20 text-rose-200"
                          : ev.nowPlaying
                            ? "bg-pulse/20 text-pulse"
                            : "bg-white/10 text-white/40"
                      }`}
                    >
                      {ev.suspended
                        ? "Suspended"
                        : ev.nowPlaying
                          ? ev.playbackPlaying
                            ? "Live"
                            : "Idle track"
                          : "Quiet"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm text-white/70">
                    {ev.nowPlaying ? `♪ ${ev.nowPlaying.title}` : "Nothing playing"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/50">
                    <Chip label="Guests" value={ev.activeGuestCount} />
                    <Chip label="Banned" value={ev.bannedCount} />
                    <Chip label="Pending" value={ev.pendingCount} />
                    <Chip label="Queue" value={ev.queueDepth} />
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5">
                      YT{" "}
                      <strong className="text-white/80">
                        {ev.youtubeUnitsUsedToday}
                        {ev.youtubeDailyQuotaCap > 0
                          ? ` / ${ev.youtubeDailyQuotaCap}`
                          : ""}
                      </strong>
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="space-y-4">
        {selected ? (
          <>
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-pulse">
                Safety · {selected.name}
              </h2>
              <p className="mt-2 text-xs text-white/40">
                Suspend blocks guest join, search, request, and vote. Organizer
                admin and this console stay available.
              </p>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-white/40">
                    Suspend reason (optional)
                  </span>
                  <input
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Shown to guests if they try to join"
                    className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-pulse/50 focus:outline-none"
                  />
                </label>

                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    void patchEvent(
                      selected.suspended
                        ? { action: "unsuspend" }
                        : {
                            action: "suspend",
                            reason: suspendReason,
                          },
                      selected.suspended
                        ? "Event unsuspended."
                        : "Event suspended."
                    )
                  }
                  className={`rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40 ${
                    selected.suspended
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-rose-500/20 text-rose-200"
                  }`}
                >
                  {selected.suspended ? "Unsuspend event" : "Suspend event"}
                </button>
              </div>

              <div className="mt-5 border-t border-white/10 pt-4">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-white/40">
                    YouTube daily quota cap (units, 0 = unlimited)
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={capInput}
                      onChange={(e) => setCapInput(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-pulse/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() =>
                        void patchEvent(
                          {
                            action: "quota_cap",
                            youtubeDailyQuotaCap: Number(capInput) || 0,
                          },
                          "Quota cap updated."
                        )
                      }
                      className="shrink-0 rounded-xl bg-pulse px-3 py-2 text-sm font-bold text-ink disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </label>
                <p className="mt-2 text-[11px] text-white/35">
                  Today: {selected.youtubeUnitsUsedToday} units used
                  {selected.youtubeDailyQuotaCap > 0
                    ? ` of ${selected.youtubeDailyQuotaCap}`
                    : " (no per-event cap)"}
                  . Uncached search ≈ 101 units.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[0, 505, 1010, 2020, 5050].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={actionBusy}
                      onClick={() => {
                        setCapInput(String(n));
                        void patchEvent(
                          { action: "quota_cap", youtubeDailyQuotaCap: n },
                          n === 0
                            ? "Cap removed (unlimited)."
                            : `Cap set to ${n} units/day.`
                        );
                      }}
                      className="rounded-lg bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/60 disabled:opacity-40"
                    >
                      {n === 0 ? "Unlimited" : `~${Math.floor(n / 101)} searches`}
                    </button>
                  ))}
                </div>
              </div>

              {err ? <p className="mt-3 text-xs text-rose-300">{err}</p> : null}
              {msg ? <p className="mt-3 text-xs text-pulse">{msg}</p> : null}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
                Guests · {selected.name}
              </h2>
              {eventTop.length ? (
                <p className="mt-2 text-xs text-white/40">
                  Event top today: {eventTop[0].title} ({eventTop[0].playCount}×)
                </p>
              ) : null}
              <ul className="mt-3 max-h-[360px] space-y-2 overflow-y-auto">
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
          </>
        ) : (
          <p className="text-sm text-white/35">
            Select an event to manage safety controls and guests.
          </p>
        )}
      </aside>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-white/[0.06] px-2 py-0.5">
      {label} <strong className="text-white/80">{value}</strong>
    </span>
  );
}
