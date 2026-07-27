"use client";

import { useCallback, useEffect, useState } from "react";
import type { EventRequestRow, ApprovalResult } from "../types";

export function RequestsPanel({ onReviewed }: { onReviewed: () => void }) {
  const [rows, setRows] = useState<EventRequestRow[]>([]);
  const [emailOn, setEmailOn] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [handover, setHandover] = useState<ApprovalResult | null>(null);

  const load = useCallback(async () => {
    const qs = filter ? `?status=${filter}` : "";
    const res = await fetch(`/api/owner/event-requests${qs}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const d = (await res.json()) as {
      requests: EventRequestRow[];
      emailConfigured: boolean;
    };
    setRows(d.requests);
    setEmailOn(d.emailConfigured);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      {!emailOn ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200">
          Email is not configured (<code>RESEND_API_KEY</code>). Approvals still
          work — you&apos;ll get a copy-ready handover to send yourself.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-pulse">
          Hosting requests ({rows.length})
        </h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-ink-800 px-3 py-1.5 text-xs"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      {handover ? (
        <HandoverCard result={handover} onClose={() => setHandover(null)} />
      ) : null}

      {err ? (
        <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
          {err}
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((row) => (
          <RequestCard
            key={row.id}
            row={row}
            open={openId === row.id}
            busy={busy}
            onToggle={() => setOpenId(openId === row.id ? null : row.id)}
            onReview={async (body) => {
              setBusy(true);
              setErr(null);
              try {
                const res = await fetch(`/api/owner/event-requests/${row.id}`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(body),
                });
                const d = (await res.json().catch(() => ({}))) as {
                  error?: string;
                  emailSent?: boolean;
                  organizer?: ApprovalResult["organizer"];
                };
                if (!res.ok) {
                  setErr(d.error || "Action failed.");
                  return;
                }
                if (d.organizer) {
                  setHandover({
                    emailSent: Boolean(d.emailSent),
                    organizer: d.organizer,
                  });
                }
                setOpenId(null);
                await load();
                onReviewed();
              } finally {
                setBusy(false);
              }
            }}
          />
        ))}
        {!rows.length ? (
          <li className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/35">
            No {filter || ""} requests.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function RequestCard({
  row,
  open,
  busy,
  onToggle,
  onReview,
}: {
  row: EventRequestRow;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onReview: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [slug, setSlug] = useState(row.suggestedSlug);
  const [eventName, setEventName] = useState(row.eventName);
  const [eventLimit, setEventLimit] = useState("3");
  const [note, setNote] = useState("");

  const pending = row.status === "pending";

  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-white">
            {row.eventName}
          </p>
          <p className="truncate text-xs text-white/40">
            {row.orgName} · {row.contactName} · {row.contactEmail}
          </p>
          <p className="mt-1 text-xs text-white/35">
            Starts {row.startsAt.replace("T", " ").slice(0, 16)}
            {row.timezone ? ` (${row.timezone})` : ""}
            {row.expectedGuests ? ` · ~${row.expectedGuests} guests` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
            row.status === "pending"
              ? "bg-amber-500/20 text-amber-100"
              : row.status === "approved"
              ? "bg-emerald-500/20 text-emerald-200"
              : "bg-rose-500/20 text-rose-200"
          }`}
        >
          {row.status}
        </span>
      </button>

      {open ? (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/65">
            {row.eventDetails}
          </p>
          <p className="mt-3 text-[11px] text-white/30">
            {row.venue ? `Venue: ${row.venue} · ` : ""}
            {row.contactPhone ? `Phone: ${row.contactPhone} · ` : ""}
            Submitted {new Date(row.createdAt).toLocaleString()}
            {row.ip ? ` from ${row.ip}` : ""}
          </p>

          {row.status !== "pending" ? (
            <p className="mt-3 text-xs text-white/45">
              {row.status} by {row.reviewedBy || "—"}
              {row.reviewedAt
                ? ` on ${new Date(row.reviewedAt).toLocaleString()}`
                : ""}
              {row.reviewNote ? ` — ${row.reviewNote}` : ""}
            </p>
          ) : null}

          {pending ? (
            <div className="mt-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Event name"
                  value={eventName}
                  onChange={setEventName}
                />
                <Input label="URL slug" value={slug} onChange={setSlug} />
                <Input
                  label="Event limit"
                  value={eventLimit}
                  onChange={setEventLimit}
                />
              </div>
              <p className="text-[11px] text-white/30">
                Guests will join at /e/{slug || "…"}. Event limit caps how many
                events this organizer can create later.
              </p>
              <Input
                label="Note (sent to them on reject, kept on approve)"
                value={note}
                onChange={setNote}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !slug || !eventName}
                  onClick={() =>
                    void onReview({
                      action: "approve",
                      slug,
                      eventName,
                      eventLimit: Number(eventLimit) || 3,
                      note,
                    })
                  }
                  className="rounded-xl bg-pulse px-4 py-2 text-sm font-bold text-ink disabled:opacity-40"
                >
                  Approve & create event
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(`Reject "${row.eventName}"?`)) return;
                    void onReview({ action: "reject", note });
                  }}
                  className="rounded-xl bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-200 disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function HandoverCard({
  result,
  onClose,
}: {
  result: ApprovalResult;
  onClose: () => void;
}) {
  const o = result.organizer;
  const message = [
    `Your event is approved on ISW Wave.`,
    ``,
    `Username: ${o.username}`,
    `Set your password: ${o.setupUrl}`,
    `Guests join: ${o.eventUrl}  (code ${o.accessCode})`,
    ``,
    `The setup link works once and expires in 72 hours.`,
  ].join("\n");

  return (
    <div className="rounded-2xl border border-pulse/30 bg-pulse/[0.07] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-pulse">
          Approved · {result.emailSent ? "email sent" : "send this yourself"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/[0.08] px-2.5 py-1 text-xs text-white/60"
        >
          Dismiss
        </button>
      </div>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/30 px-3 py-2.5 text-xs leading-relaxed text-white/70">
        {message}
      </pre>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(message)}
        className="mt-3 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/70"
      >
        Copy message
      </button>
      {result.emailSent ? (
        <p className="mt-2 text-[11px] text-white/35">
          Already emailed to {o.email} — this copy is just a backup.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-amber-200/70">
          Email was not sent. Send this to {o.email} yourself — the setup link is
          the only way in.
        </p>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-white/40">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white focus:border-pulse/50 focus:outline-none"
      />
    </label>
  );
}
