"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DEVICE_ID_KEY } from "@/lib/constants";
import type { AuthUser } from "@/lib/types";

type Mode = "join" | "admin";

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `tmp-${Date.now()}`;
  }
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function AuthClient({
  initialCode = "",
}: {
  initialCode?: string;
}) {
  const [mode, setMode] = useState<Mode>("join");
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockedName, setLockedName] = useState<string | null>(null);

  useEffect(() => {
    // Prefill locked name if this device already joined once.
    void (async () => {
      try {
        const deviceId = getOrCreateDeviceId();
        // Soft hint only — the server enforces the lock on join.
        const hint = sessionStorage.getItem(`isw_locked_name:${deviceId}`);
        if (hint) {
          setLockedName(hint);
          setName(hint);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "join") {
        const deviceId = getOrCreateDeviceId();
        const res = await fetch("/api/auth/join", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, code, deviceId }),
        });
        const data = await readJsonSafe<{
          user?: AuthUser;
          error?: string;
          lockedName?: string;
          eventSlug?: string;
        }>(res);

        if (!res.ok || !data?.user) {
          if (data?.lockedName) {
            setLockedName(data.lockedName);
            setName(data.lockedName);
            try {
              sessionStorage.setItem(
                `isw_locked_name:${deviceId}`,
                data.lockedName
              );
            } catch {
              /* ignore */
            }
          }
          setError(
            data?.error ||
              (res.status >= 500
                ? "Server error. Database may not be set up — check Turso/seed."
                : "Could not join. Try again.")
          );
          setBusy(false);
          return;
        }

        try {
          sessionStorage.setItem(
            `isw_locked_name:${deviceId}`,
            data.user.role === "participant" ? data.user.displayName : name
          );
        } catch {
          /* ignore */
        }
        window.location.href =
          data.user.role === "participant" && data.user.eventSlug
            ? `/e/${data.user.eventSlug}`
            : "/";
        return;
      }

      // Admin password login
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await readJsonSafe<{ user?: AuthUser; error?: string }>(res);
      if (!res.ok || !data?.user) {
        setError(
          data?.error ||
            (res.status >= 500
              ? "Server error. Check database env vars and run db:seed."
              : "Login failed. Try again.")
        );
        setBusy(false);
        return;
      }
      window.location.href = data.user.eventId ? "/admin" : "/organizer/events/new";
    } catch {
      setError("Network error. Check your connection and try again.");
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
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex h-6 items-end gap-[3px] text-wave">
            <span
              className="w-[3px] rounded-full bg-current animate-eq-1"
              style={{ height: "60%" }}
            />
            <span
              className="w-[3px] rounded-full bg-current animate-eq-2"
              style={{ height: "100%" }}
            />
            <span
              className="w-[3px] rounded-full bg-current animate-eq-3"
              style={{ height: "45%" }}
            />
          </span>
          <span className="font-display text-sm font-medium uppercase tracking-[0.2em] text-wave-400">
            ISW Wave
          </span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface/70 p-7 shadow-glow backdrop-blur">
          <h1 className="font-display text-2xl font-bold text-white">
            {mode === "join" ? "Join the wave" : "Control room"}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {mode === "join"
              ? "Enter your name and the code on the big screen."
              : "Organizer login — manage the queue and venue audio."}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-ink-800 p-1">
            {(["join", "admin"] as Mode[]).map((m) => (
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
                  {m === "join" ? "Join event" : "Admin"}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {mode === "join" ? (
                <motion.div
                  key="join-fields"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-3"
                >
                  <Field
                    label="Your name"
                    value={name}
                    onChange={setName}
                    autoComplete="nickname"
                    autoFocus
                    readOnly={!!lockedName}
                  />
                  {lockedName && (
                    <p className="text-xs text-white/40">
                      This device is locked to &ldquo;{lockedName}&rdquo;.
                    </p>
                  )}
                  <Field
                    label="Event code"
                    value={code}
                    onChange={(v) => setCode(v.toUpperCase())}
                    autoComplete="off"
                    placeholder="Shown on screen"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="admin-fields"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-3"
                >
                  <Field
                    label="Username or email"
                    value={identifier}
                    onChange={setIdentifier}
                    autoComplete="username"
                    autoFocus
                  />
                  <Field
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                  />
                </motion.div>
              )}
            </AnimatePresence>

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
                : mode === "join"
                ? "Join & request songs"
                : "Open control room"}
            </motion.button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-white/30">
          {mode === "join" ? (
            <>No account needed for guests — just a name and the event code.</>
          ) : (
            <>
              New organizer?{" "}
              <a href="/organizer/signup" className="text-wave-400 hover:underline">
                Create an account
              </a>
            </>
          )}
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
  placeholder,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  placeholder?: string;
  readOnly?: boolean;
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
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-wave/50 focus:outline-none read-only:opacity-70"
      />
    </label>
  );
}
