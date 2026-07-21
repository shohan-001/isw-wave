"use client";

import { useState } from "react";
import { motion } from "framer-motion";

// Simple single-password gate. On success we reload so the server shell renders
// the dashboard (the admin cookie is now set).
export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Incorrect password.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-surface/70 p-7 shadow-glow backdrop-blur"
      >
        <h1 className="font-display text-2xl font-bold text-white">
          Admin access
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Enter the event password to open the control room.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="Password"
          className="mt-5 w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-white placeholder:text-white/30 focus:border-wave/50 focus:outline-none"
        />
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-wave py-3 font-bold text-white shadow-glow transition disabled:opacity-60"
        >
          {busy ? "Checking…" : "Enter"}
        </motion.button>
      </motion.form>
    </main>
  );
}
