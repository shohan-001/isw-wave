"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AuthUser } from "@/lib/types";

type Mode = "login" | "signup";

// Login/signup on one screen with a mode toggle. Matches the Phase-1 visual
// language (dark ink surfaces, magenta "wave" accent) so it doesn't read as a
// bolted-on generic auth template — it's the first screen users see.
export function AuthClient() {
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState(""); // login: username or email
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const url = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const payload =
      mode === "login"
        ? { identifier, password }
        : { username, email, password };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error || "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      // Full navigation so the server components re-read the new auth cookie.
      window.location.href = data.user.isAdmin ? "/admin" : "/";
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex h-6 items-end gap-[3px] text-wave">
            <span className="w-[3px] rounded-full bg-current animate-eq-1" style={{ height: "60%" }} />
            <span className="w-[3px] rounded-full bg-current animate-eq-2" style={{ height: "100%" }} />
            <span className="w-[3px] rounded-full bg-current animate-eq-3" style={{ height: "45%" }} />
          </span>
          <span className="font-display text-sm font-medium uppercase tracking-[0.2em] text-wave-400">
            ISW Wave
          </span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-7 shadow-glow backdrop-blur">
          <h1 className="font-display text-2xl font-bold text-white">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {mode === "login"
              ? "Log in to request songs for the event."
              : "Sign up to start sending songs to the stage."}
          </p>

          {/* Mode toggle */}
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-ink-800 p-1">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className="relative rounded-lg px-3 py-2 text-sm font-semibold transition"
              >
                {mode === m && (
                  <motion.span
                    layoutId="authToggle"
                    className="absolute inset-0 rounded-lg bg-wave"
                    transition={{ type: "spring", damping: 30, stiffness: 320 }}
                  />
                )}
                <span
                  className={`relative ${
                    mode === m ? "text-white" : "text-white/50"
                  }`}
                >
                  {m === "login" ? "Log in" : "Sign up"}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {mode === "login" ? (
                <motion.div
                  key="login-fields"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Field
                    label="Username or email"
                    value={identifier}
                    onChange={setIdentifier}
                    autoComplete="username"
                    autoFocus
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-3"
                >
                  <Field
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    autoComplete="username"
                    autoFocus
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={busy}
              className="mt-1 w-full rounded-xl bg-wave py-3 font-bold text-white shadow-glow transition disabled:opacity-60"
            >
              {busy
                ? "Please wait…"
                : mode === "login"
                ? "Log in"
                : "Create account"}
            </motion.button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-white/30">
          Event organizers: use your admin credentials here to open the control room.
        </p>
      </motion.div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-wave/50 focus:outline-none"
      />
    </label>
  );
}
