"use client";

import type { Overview } from "../types";

export function DashboardPanel({
  data,
  onOpenEvents,
  onOpenRequests,
}: {
  data: Overview | null;
  onOpenEvents: () => void;
  onOpenRequests: () => void;
}) {
  const s = data?.stats;
  const quotaHot = (s?.quotaPercentUsed ?? 0) >= 70;
  const pending = s?.pendingRequests ?? 0;

  return (
    <div className="space-y-6">
      {pending > 0 ? (
        <button
          type="button"
          onClick={onOpenRequests}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-left transition hover:border-amber-400/50"
        >
          <span className="text-sm text-amber-100">
            {pending} hosting {pending === 1 ? "request" : "requests"} waiting for
            review
          </span>
          <span className="shrink-0 text-xs font-semibold text-amber-200">
            Review →
          </span>
        </button>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending requests" value={pending} warn={pending > 0} />
        <StatCard label="Live now" value={s?.liveNow ?? 0} accent />
        <StatCard label="Events total" value={s?.totalEvents ?? 0} />
        <StatCard label="Organizers" value={s?.totalOrganizers ?? 0} />
        <StatCard label="Guests today" value={s?.guestsToday ?? 0} />
        <StatCard label="Staff logins today" value={s?.loginsToday ?? 0} />
        <StatCard label="Staff accounts" value={s?.staffCount ?? 0} />
        <StatCard
          label="YouTube quota used"
          value={`${s?.quotaPercentUsed ?? 0}%`}
          hint={`${s?.quotaUnitsUsed ?? 0} / ${s?.quotaLimit ?? 0} units`}
          warn={quotaHot}
        />
        <StatCard
          label="Searches left today"
          value={Math.max(
            0,
            Math.floor(((s?.quotaLimit ?? 0) - (s?.quotaUnitsUsed ?? 0)) / 101)
          )}
          hint="uncached, 101 units each"
          warn={quotaHot}
        />
      </div>

      {quotaHot ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          YouTube quota is {s?.quotaPercentUsed}% used today. Guest search will
          start failing when it runs out.
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-pulse">
            Live events
          </h2>
          <button
            type="button"
            onClick={onOpenEvents}
            className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-white/60 hover:text-white"
          >
            Manage →
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {(data?.events ?? [])
            .filter((e) => e.nowPlaying)
            .slice(0, 6)
            .map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {e.name}
                  </p>
                  <p className="truncate text-xs text-white/40">
                    ♪ {e.nowPlaying?.title}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-white/40">
                  {e.activeGuestCount} guests
                </span>
              </li>
            ))}
          {!(data?.events ?? []).some((e) => e.nowPlaying) ? (
            <li className="text-sm text-white/35">Nothing playing right now.</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
          Top songs today
        </h2>
        <ul className="mt-3 space-y-2">
          {(data?.topSongs ?? []).slice(0, 8).map((song) => (
            <li
              key={`${song.eventId}-${song.youtubeVideoId}`}
              className="flex items-center gap-3 text-sm"
            >
              <span className="w-6 shrink-0 tabular-nums text-pulse">
                {song.playCount}
              </span>
              <span className="min-w-0 flex-1 truncate text-white/80">
                {song.title}
              </span>
            </li>
          ))}
          {!data?.topSongs?.length ? (
            <li className="text-sm text-white/35">No plays recorded yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
  warn,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        warn
          ? "border-amber-400/30 bg-amber-400/[0.06]"
          : accent
          ? "border-pulse/30 bg-pulse/[0.06]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-bold ${
          warn ? "text-amber-200" : accent ? "text-pulse" : "text-white"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-white/30">{hint}</p> : null}
    </div>
  );
}
