"use client";

import { useCallback, useEffect, useState } from "react";
import type { LogRow, StaffRole } from "../types";

type LogsResponse = {
  logs: LogRow[];
  total: number;
  page: number;
  pageSize: number;
  types: string[];
  retentionDays: number;
};

export function LogsPanel({ viewerRole }: { viewerRole: StaffRole }) {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [type, setType] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [olderThan, setOlderThan] = useState("30");
  const [pruneType, setPruneType] = useState("");

  const canPrune = viewerRole === "owner";

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (type) qs.set("type", type);
    if (page) qs.set("page", String(page));
    const res = await fetch(`/api/owner/logs?${qs}`, { cache: "no-store" });
    if (!res.ok) return;
    setData((await res.json()) as LogsResponse);
  }, [type, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function prune(query: string, label: string) {
    if (!confirm(`Delete logs (${label})? This cannot be undone.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/owner/logs?${query}`, { method: "DELETE" });
      const d = (await res.json().catch(() => ({}))) as {
        deleted?: number;
        error?: string;
      };
      setMsg(res.ok ? `Removed ${d.deleted ?? 0} row(s).` : d.error || "Failed.");
      setPage(0);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      {canPrune ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
            Log cleanup
          </h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-white/40">
                Delete older than
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={olderThan}
                  onChange={(e) => setOlderThan(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void prune(
                      `olderThanDays=${Number(olderThan) || 0}`,
                      `older than ${olderThan} days`
                    )
                  }
                  className="shrink-0 rounded-xl bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-white/40">
                Delete by type
              </label>
              <div className="mt-1.5 flex gap-2">
                <select
                  value={pruneType}
                  onChange={(e) => setPruneType(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm"
                >
                  <option value="">Select type…</option>
                  {(data?.types ?? []).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !pruneType}
                  onClick={() =>
                    void prune(`type=${encodeURIComponent(pruneType)}`, pruneType)
                  }
                  className="shrink-0 rounded-xl bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-rose-300/70">
                Danger zone
              </label>
              <div className="mt-1.5 flex gap-2">
                <p className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  Deletes every log row.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void prune("all=1", "ALL logs")}
                  className="shrink-0 rounded-xl bg-rose-500/25 px-3 py-2 text-xs font-semibold text-rose-100 disabled:opacity-40"
                >
                  Delete all
                </button>
              </div>
            </div>
          </div>
          {msg ? <p className="mt-3 text-xs text-pulse">{msg}</p> : null}
          <p className="mt-3 text-[11px] text-white/30">
            Rows older than {data?.retentionDays ?? 30} days are pruned
            automatically.
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-pulse">
            Recent activity{data ? ` (${data.total})` : ""}
          </h2>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(0);
            }}
            className="rounded-xl border border-white/10 bg-ink-800 px-3 py-1.5 text-xs"
          >
            <option value="">All activity types</option>
            {(data?.types ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                <th className="pb-2 pr-3 font-semibold">Time</th>
                <th className="pb-2 pr-3 font-semibold">Type</th>
                <th className="pb-2 pr-3 font-semibold">Actor</th>
                <th className="pb-2 pr-3 font-semibold">IP / agent</th>
                <th className="pb-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {(data?.logs ?? []).map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]">
                  <td className="py-2 pr-3 text-xs tabular-nums text-white/50">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${badgeClass(
                        row.type
                      )}`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-white/70">
                    {row.actorLabel || "—"}
                    <span className="block text-white/30">{row.actorType}</span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-white/50">
                    {row.ip || "—"}
                    <span className="block max-w-[220px] truncate text-white/25">
                      {row.userAgent}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-white/60">
                    {row.details || "—"}
                  </td>
                </tr>
              ))}
              {!data?.logs?.length ? (
                <tr>
                  <td colSpan={5} className="py-4 text-sm text-white/35">
                    No activity recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-xs text-white/45">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 disabled:opacity-30"
            >
              ← Newer
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 disabled:opacity-30"
            >
              Older →
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function badgeClass(type: string): string {
  if (type.endsWith("_failed")) return "bg-rose-500/20 text-rose-200";
  if (type.startsWith("guest.ban")) return "bg-amber-500/20 text-amber-100";
  if (type.startsWith("staff.login")) return "bg-emerald-500/20 text-emerald-200";
  if (type.startsWith("logs.")) return "bg-white/10 text-white/60";
  return "bg-pulse/20 text-pulse";
}
