"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { slugify } from "@/lib/slug";
import { DEFAULT_ACCENT, normalizeHex } from "@/lib/theme";

export function CreateEventForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [requestLimit, setRequestLimit] = useState(3);
  const [approvalMode, setApprovalMode] = useState<"manual" | "auto">("manual");
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slugTouched && name) {
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          requestLimit,
          approvalMode,
          accentColor: normalizeHex(accentColor) || DEFAULT_ACCENT,
        }),
      });
      const data = (await res.json()) as { error?: string; event?: { slug: string } };
      if (!res.ok || !data.event) {
        setError(data.error || "Could not create event.");
        setBusy(false);
        return;
      }
      window.location.href = `/admin`;
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={submit}
      className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
    >
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          Create your event
        </h1>
        <p className="mt-1 text-sm text-white/45">
          Set up name, URL, and defaults. You can change these later in the control room.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Event name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Junior Hack 2027"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-pulse/50"
          required
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          URL slug
        </span>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <span className="shrink-0 text-sm text-white/35">/e/</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="juniorhack-2027"
            className="min-w-0 flex-1 bg-transparent text-white outline-none"
            required
          />
        </div>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">
            Request limit
          </span>
          <input
            type="number"
            min={1}
            max={20}
            value={requestLimit}
            onChange={(e) => setRequestLimit(Number(e.target.value))}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-pulse/50"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">
            Approval mode
          </span>
          <select
            value={approvalMode}
            onChange={(e) =>
              setApprovalMode(e.target.value === "auto" ? "auto" : "manual")
            }
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-pulse/50"
          >
            <option value="manual">Manual</option>
            <option value="auto">Auto-approve</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Theme color
        </span>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={normalizeHex(accentColor) || DEFAULT_ACCENT}
            onChange={(e) => setAccentColor(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
          />
          <input
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-pulse/50"
          />
        </div>
      </label>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-pulse px-4 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create event"}
      </button>
    </motion.form>
  );
}
