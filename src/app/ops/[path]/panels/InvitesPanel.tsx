"use client";

import { useCallback, useEffect, useState } from "react";
import type { InviteCodeRow, StaffRole } from "../types";

export function InvitesPanel({ viewerRole }: { viewerRole: StaffRole }) {
  const [rows, setRows] = useState<InviteCodeRow[]>([]);
  const [signupUrl, setSignupUrl] = useState("");
  const [envFallbackActive, setEnvFallbackActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [freshCode, setFreshCode] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [eventLimit, setEventLimit] = useState("3");
  const [expiresInDays, setExpiresInDays] = useState("30");

  const isOwner = viewerRole === "owner";

  const load = useCallback(async () => {
    const res = await fetch("/api/owner/invite-codes", { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json()) as {
      codes: InviteCodeRow[];
      signupUrl?: string;
      envFallbackActive?: boolean;
    };
    setRows(d.codes);
    setSignupUrl(d.signupUrl || "");
    setEnvFallbackActive(Boolean(d.envFallbackActive));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    setFreshCode(null);
    try {
      const res = await fetch("/api/owner/invite-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label,
          code: customCode.trim() || undefined,
          maxUses: Number(maxUses) || 0,
          eventLimit: Number(eventLimit) || 0,
          expiresInDays: Number(expiresInDays) || 0,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: InviteCodeRow;
      };
      if (!res.ok || !d.code) {
        setErr(d.error || "Could not create invite code.");
        return;
      }
      setFreshCode(d.code.code);
      setMsg(`Created "${d.code.label}". Copy the code below and send it.`);
      setLabel("");
      setCustomCode("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, action: "revoke" | "restore", labelText: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/owner/invite-codes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(d.error || "Action failed.");
        return;
      }
      setMsg(labelText);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, labelText: string) {
    if (!confirm(`Delete unused code "${labelText}"?`)) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/owner/invite-codes/${id}`, {
        method: "DELETE",
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(d.error || "Delete failed.");
        return;
      }
      setMsg(`Deleted "${labelText}".`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(done);
    } catch {
      setErr("Could not copy — select the text manually.");
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-white/45">
        Invite codes are the fast path for organizers you already trust. They
        skip the request review and land at{" "}
        {signupUrl ? (
          <a href={signupUrl} className="text-pulse hover:underline">
            /organizer/signup
          </a>
        ) : (
          "/organizer/signup"
        )}
        . Everyone else should use Request to host.
      </p>

      {envFallbackActive ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Legacy env codes from <code className="text-amber-50">ORGANIZER_INVITE_CODE</code>{" "}
          are still accepted, but they don&apos;t appear in this list and have no
          usage tracking. Prefer codes created here.
        </p>
      ) : null}

      {!isOwner ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45">
          You&apos;re signed in as a moderator. You can view codes; only the
          owner can create, revoke, or delete them.
        </p>
      ) : null}

      {freshCode ? (
        <section className="rounded-2xl border border-pulse/30 bg-pulse/10 p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-pulse">
            New code ready
          </h2>
          <p className="mt-2 break-all font-mono text-lg font-bold text-white">
            {freshCode}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copy(freshCode, "Code copied.")}
              className="rounded-xl bg-pulse px-3 py-1.5 text-xs font-bold text-ink"
            >
              Copy code
            </button>
            {signupUrl ? (
              <button
                type="button"
                onClick={() =>
                  void copy(
                    `${signupUrl}\nInvite code: ${freshCode}`,
                    "Signup link + code copied."
                  )
                }
                className="rounded-xl bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/80"
              >
                Copy link + code
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-pulse">
          Invite codes ({rows.length})
        </h2>
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-xl bg-black/20 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {row.label || "(no label)"}
                  <StatusBadge status={row.status} />
                </p>
                <p className="mt-0.5 break-all font-mono text-[12px] text-white/70">
                  {row.code}
                </p>
                <p className="mt-1 text-[11px] text-white/35">
                  Uses {row.usedCount}
                  {row.maxUses > 0 ? ` / ${row.maxUses}` : " · unlimited"}
                  {" · "}
                  Event limit{" "}
                  {row.eventLimit > 0 ? row.eventLimit : "unlimited"}
                  {row.expiresAt
                    ? ` · expires ${row.expiresAt.slice(0, 10)}`
                    : ""}
                  {row.lastUsedAt
                    ? ` · last used ${row.lastUsedAt.slice(0, 10)}`
                    : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void copy(row.code, "Code copied.")}
                  className="rounded-lg bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/70 disabled:opacity-40"
                >
                  Copy
                </button>
                {isOwner && row.status === "active" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patch(row.id, "revoke", `Revoked "${row.label}".`)
                    }
                    className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-200 disabled:opacity-40"
                  >
                    Revoke
                  </button>
                ) : null}
                {isOwner && row.status === "revoked" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patch(row.id, "restore", `Restored "${row.label}".`)
                    }
                    className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 disabled:opacity-40"
                  >
                    Restore
                  </button>
                ) : null}
                {isOwner && row.usedCount === 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(row.id, row.label || row.code)}
                    className="rounded-lg bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/50 disabled:opacity-40"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {!rows.length ? (
            <li className="text-sm text-white/35">
              No invite codes yet. Create one below for someone you trust.
            </li>
          ) : null}
        </ul>
      </section>

      {isOwner ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
            Create invite code
          </h2>
          <form onSubmit={createCode} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Label (who is this for?)"
              value={label}
              onChange={setLabel}
              placeholder="NSBM Robotics Club"
              required
            />
            <Field
              label="Custom code (optional)"
              value={customCode}
              onChange={setCustomCode}
              placeholder="Leave blank to auto-generate"
            />
            <Field
              label="Max uses (0 = unlimited)"
              value={maxUses}
              onChange={setMaxUses}
              type="number"
            />
            <Field
              label="Event limit (0 = unlimited)"
              value={eventLimit}
              onChange={setEventLimit}
              type="number"
            />
            <Field
              label="Expires in days (0 = never)"
              value={expiresInDays}
              onChange={setExpiresInDays}
              type="number"
            />

            <div className="sm:col-span-2">
              {err ? <p className="text-xs text-rose-300">{err}</p> : null}
              {msg ? <p className="text-xs text-pulse">{msg}</p> : null}
              <button
                type="submit"
                disabled={busy || !label.trim()}
                className="mt-2 rounded-xl bg-pulse px-4 py-2 text-sm font-bold text-ink disabled:opacity-40"
              >
                {busy ? "Creating…" : "Create invite code"}
              </button>
              <p className="mt-2 text-[11px] text-white/30">
                Defaults: 1 use, 3 events, expires in 30 days. Send the code
                privately — anyone with it can create an organizer account.
              </p>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: InviteCodeRow["status"] }) {
  const styles: Record<InviteCodeRow["status"], string> = {
    active: "bg-emerald-500/20 text-emerald-200",
    revoked: "bg-rose-500/20 text-rose-200",
    expired: "bg-amber-400/20 text-amber-100",
    exhausted: "bg-white/10 text-white/50",
  };
  return (
    <span
      className={`ml-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
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
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-pulse/50 focus:outline-none"
      />
    </label>
  );
}
