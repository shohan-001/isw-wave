"use client";

import { useState } from "react";
import Link from "next/link";

type Fields = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  orgName: string;
  eventName: string;
  venue: string;
  startsAt: string;
  expectedGuests: string;
  eventDetails: string;
};

const EMPTY: Fields = {
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  orgName: "",
  eventName: "",
  venue: "",
  startsAt: "",
  expectedGuests: "",
  eventDetails: "",
};

export function HostRequestForm() {
  const [f, setF] = useState<Fields>(EMPTY);
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusToken, setStatusToken] = useState<string | null>(null);

  function set<K extends keyof Fields>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/event-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...f,
          expectedGuests: Number(f.expectedGuests) || 0,
          // Sent so review shows the organizer's local time, not the server's.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
          website: honeypot,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        token?: string;
        error?: string;
      };
      if (!res.ok || !d.ok) {
        setErr(d.error || "Could not send your request. Try again.");
        return;
      }
      setStatusToken(d.token || "");
    } catch {
      setErr("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (statusToken !== null) {
    return (
      <div className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-10 shadow-glow sm:px-10">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-wave/30 bg-wave/10 text-wave">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
            <path
              d="m5 13 4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold text-white">
          Request sent
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/50">
          Thanks — it&apos;s in the review queue. Reviews are done by hand,
          usually within a day or two, and you&apos;ll get an email with a link
          to set your password once it&apos;s approved.
        </p>
        {statusToken ? (
          <Link
            href={`/host/${statusToken}`}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-wave px-5 py-2.5 text-sm font-bold text-white shadow-glow transition hover:brightness-110"
          >
            Check request status
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-white/10 bg-surface/70 px-6 py-8 shadow-glow backdrop-blur sm:px-8"
    >
      <Fieldset legend="About you">
        <Field
          label="Your name"
          value={f.contactName}
          onChange={(v) => set("contactName", v)}
          required
        />
        <Field
          label="Email"
          type="email"
          value={f.contactEmail}
          onChange={(v) => set("contactEmail", v)}
          hint="Approval and your setup link go here."
          required
        />
        <Field
          label="Phone or WhatsApp"
          value={f.contactPhone}
          onChange={(v) => set("contactPhone", v)}
          hint="Optional — useful if something breaks mid-event."
        />
        <Field
          label="Club, society, or company"
          value={f.orgName}
          onChange={(v) => set("orgName", v)}
          required
        />
      </Fieldset>

      <Fieldset legend="About the event">
        <Field
          label="Event name"
          value={f.eventName}
          onChange={(v) => set("eventName", v)}
          required
        />
        <Field
          label="Venue"
          value={f.venue}
          onChange={(v) => set("venue", v)}
          hint="Optional."
        />
        <Field
          label="Starts at"
          type="datetime-local"
          value={f.startsAt}
          onChange={(v) => set("startsAt", v)}
          hint="Date and time the music starts, in your local time."
          required
        />
        <Field
          label="Expected guests"
          type="number"
          value={f.expectedGuests}
          onChange={(v) => set("expectedGuests", v)}
          hint="A rough number is fine."
        />

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/45">
            Event details
          </span>
          <textarea
            value={f.eventDetails}
            onChange={(e) => set("eventDetails", e.target.value)}
            rows={5}
            maxLength={1500}
            required
            placeholder="What kind of event is it, who's attending, and how you plan to use live song requests."
            className="w-full resize-y rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-wave/50 focus:outline-none"
          />
          <span className="mt-1 block text-[11px] text-white/30">
            {f.eventDetails.length}/1500 — the more context, the faster the
            review.
          </span>
        </label>
      </Fieldset>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      {err ? (
        <p className="mt-5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {err}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-7 w-full rounded-xl bg-wave px-6 py-3.5 text-base font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Sending…" : "Send request"}
      </button>

      <p className="mt-4 text-[11px] leading-relaxed text-white/30">
        Already have an invite code?{" "}
        <Link href="/organizer/signup" className="text-white/50 hover:text-wave-400">
          Sign up directly
        </Link>
        .
      </p>
    </form>
  );
}

function Fieldset({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="mb-8 last:mb-0">
      <legend className="mb-4 font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-wave-400">
        {legend}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/45">
        {label}
        {required ? <span className="ml-1 text-wave-400">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-wave/50 focus:outline-none"
      />
      {hint ? (
        <span className="mt-1 block text-[11px] text-white/30">{hint}</span>
      ) : null}
    </label>
  );
}
