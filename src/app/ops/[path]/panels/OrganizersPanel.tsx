"use client";

import { useState } from "react";
import type { Overview, StaffRole } from "../types";

export function OrganizersPanel({
  data,
  viewerRole,
}: {
  data: Overview | null;
  viewerRole: StaffRole;
}) {
  const [resetUserId, setResetUserId] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isOwner = viewerRole === "owner";
  const organizers = data?.organizers ?? [];

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/owner/admin-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: resetUserId, newPassword: resetPw }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setErr(d.error || "Reset failed.");
      return;
    }
    setResetPw("");
    setMsg("Password updated for organizer.");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-pulse">
          Organizers ({organizers.length})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                <th className="pb-2 pr-3 font-semibold">Organizer</th>
                <th className="pb-2 pr-3 font-semibold">Email</th>
                <th className="pb-2 pr-3 font-semibold">Events</th>
                <th className="pb-2 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((o) => (
                <tr key={o.id} className="border-t border-white/[0.06]">
                  <td className="py-2 pr-3 font-medium text-white">
                    {o.username}
                  </td>
                  <td className="py-2 pr-3 text-xs text-white/50">{o.email}</td>
                  <td className="py-2 pr-3 tabular-nums text-white/70">
                    {o.eventCount}
                  </td>
                  <td className="py-2 text-xs text-white/40">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {!organizers.length ? (
                <tr>
                  <td colSpan={4} className="py-4 text-sm text-white/35">
                    No organizers yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
          Reset organizer password
        </h2>
        {isOwner ? (
          <form onSubmit={resetPassword} className="mt-3 max-w-md space-y-2">
            <select
              value={resetUserId}
              onChange={(e) => setResetUserId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm"
            >
              <option value="">Select organizer…</option>
              {organizers.map((o) => (
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
            {err ? <p className="text-xs text-rose-300">{err}</p> : null}
            {msg ? <p className="text-xs text-pulse">{msg}</p> : null}
            <button
              type="submit"
              disabled={!resetUserId || resetPw.length < 8}
              className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              Set password
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-white/45">
            Owner-only. Ask the owner to reset organizer credentials.
          </p>
        )}
      </section>
    </div>
  );
}
