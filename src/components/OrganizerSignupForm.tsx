"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

export function OrganizerSignupForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, email, password, orgName }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Signup failed.");
        setBusy(false);
        return;
      }
      window.location.href = "/organizer/events/new";
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
      className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
    >
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          Organizer signup
        </h1>
        <p className="mt-1 text-sm text-white/45">
          Create an account to run your own live song-request events.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Username
        </span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-pulse/50"
          required
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Email
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-pulse/50"
          required
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-pulse/50"
          required
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Organization name (optional)
        </span>
        <input
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="My uni society"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-pulse/50"
        />
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
        {busy ? "Creating account…" : "Sign up"}
      </button>

      <p className="text-center text-sm text-white/40">
        Already have an account?{" "}
        <Link href="/login?mode=admin" className="text-pulse hover:underline">
          Log in
        </Link>
      </p>
    </motion.form>
  );
}
