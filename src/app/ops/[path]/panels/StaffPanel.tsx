"use client";

import { useCallback, useEffect, useState } from "react";
import type { StaffRole, StaffRow } from "../types";

export function StaffPanel({ viewerRole }: { viewerRole: StaffRole }) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("moderator");

  const isOwner = viewerRole === "owner";

  const load = useCallback(async () => {
    const res = await fetch("/api/owner/staff", { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json()) as { staff: StaffRow[] };
    setRows(d.staff);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/owner/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, email, password, role }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(d.error || "Could not create staff account.");
        return;
      }
      setMsg(`${username} added as ${role}.`);
      setUsername("");
      setEmail("");
      setPassword("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, string>, label: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/owner/staff/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(d.error || "Action failed.");
        return;
      }
      setMsg(label);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(row: StaffRow) {
    const next = prompt(`New password for ${row.username} (min 8 characters)`);
    if (!next) return;
    if (next.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    await patch(
      row.id,
      { action: "password", password: next },
      `Password updated for ${row.username}.`
    );
  }

  return (
    <div className="space-y-5">
      {!isOwner ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45">
          You&apos;re signed in as a moderator. Staff management is owner-only —
          this list is read-only for you.
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-pulse">
          Staff accounts ({rows.length})
        </h2>
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-xl bg-black/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {row.username}
                  <span
                    className={`ml-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                      row.role === "owner"
                        ? "bg-pulse/20 text-pulse"
                        : "bg-white/10 text-white/60"
                    }`}
                  >
                    {row.role}
                  </span>
                  {row.disabled ? (
                    <span className="ml-2 text-[10px] uppercase text-rose-300">
                      disabled
                    </span>
                  ) : null}
                  {row.isSelf ? (
                    <span className="ml-2 text-[10px] uppercase text-white/30">
                      you
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-[11px] text-white/35">{row.email}</p>
              </div>

              {isOwner ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resetPassword(row)}
                    className="rounded-lg bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/70 disabled:opacity-40"
                  >
                    Reset password
                  </button>
                  <button
                    type="button"
                    disabled={busy || row.isSelf}
                    onClick={() =>
                      void patch(
                        row.id,
                        {
                          action: "role",
                          role: row.role === "owner" ? "moderator" : "owner",
                        },
                        `${row.username} is now ${
                          row.role === "owner" ? "moderator" : "owner"
                        }.`
                      )
                    }
                    className="rounded-lg bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/70 disabled:opacity-40"
                  >
                    {row.role === "owner" ? "Make moderator" : "Make owner"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || row.isSelf}
                    onClick={() =>
                      void patch(
                        row.id,
                        { action: row.disabled ? "enable" : "disable" },
                        `${row.username} ${row.disabled ? "enabled" : "disabled"}.`
                      )
                    }
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40 ${
                      row.disabled
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-rose-500/20 text-rose-200"
                    }`}
                  >
                    {row.disabled ? "Enable" : "Disable"}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
          {!rows.length ? (
            <li className="text-sm text-white/35">No staff accounts yet.</li>
          ) : null}
        </ul>
      </section>

      {isOwner ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
            Add staff
          </h2>
          <form onSubmit={createStaff} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Username" value={username} onChange={setUsername} />
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <Field
              label="Password (min 8)"
              value={password}
              onChange={setPassword}
              type="password"
            />
            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-white/40">
                Role
              </span>
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value === "owner" ? "owner" : "moderator")
                }
                className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm"
              >
                <option value="moderator">Moderator</option>
                <option value="owner">Owner</option>
              </select>
            </label>

            <div className="sm:col-span-2">
              {err ? <p className="text-xs text-rose-300">{err}</p> : null}
              {msg ? <p className="text-xs text-pulse">{msg}</p> : null}
              <button
                type="submit"
                disabled={busy || !username || !email || password.length < 8}
                className="mt-2 rounded-xl bg-pulse px-4 py-2 text-sm font-bold text-ink disabled:opacity-40"
              >
                {busy ? "Saving…" : "Create staff account"}
              </button>
              <p className="mt-2 text-[11px] text-white/30">
                Moderators can ban guests and review events. Owners also manage
                staff, credentials, and log deletion.
              </p>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-white/40">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-pulse/50 focus:outline-none"
      />
    </label>
  );
}
