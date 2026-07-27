"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

export function SetPasswordClient({ token }: { token: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLinkError("This link is missing its token.");
        setChecking(false);
        return;
      }
      const res = await fetch(
        `/api/auth/set-password?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      const d = (await res.json().catch(() => ({}))) as {
        valid?: boolean;
        username?: string;
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok || !d.valid) {
        setLinkError(d.error || "This setup link isn't valid.");
      } else {
        setUsername(d.username || null);
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) {
      setErr("Both passwords must match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(d.error || "Could not set your password.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login?mode=admin"), 1800);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#07080c] px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-glow">
        <BrandMark size={36} />

        {checking ? (
          <p className="mt-5 text-sm text-white/45">Checking your link…</p>
        ) : linkError ? (
          <>
            <h1 className="mt-4 font-display text-xl font-bold text-white">
              Link not usable
            </h1>
            <p className="mt-2 text-sm text-rose-300">{linkError}</p>
            <Link
              href="/login?mode=admin"
              className="mt-5 inline-block rounded-xl bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/80"
            >
              Go to sign in
            </Link>
          </>
        ) : done ? (
          <>
            <h1 className="mt-4 font-display text-xl font-bold text-white">
              You&apos;re all set
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Password saved. Taking you to sign in…
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 font-display text-xl font-bold text-white">
              Set your password
            </h1>
            <p className="mt-1 text-sm text-white/45">
              Your organizer username is{" "}
              <span className="font-semibold text-wave-400">{username}</span>.
            </p>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <input
                type="password"
                autoFocus
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 8)"
                className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white focus:border-wave/50 focus:outline-none"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white focus:border-wave/50 focus:outline-none"
              />
              {err ? <p className="text-xs text-rose-300">{err}</p> : null}
              <button
                type="submit"
                disabled={busy || password.length < 8 || !confirm}
                className="w-full rounded-xl bg-wave py-2.5 text-sm font-bold text-ink disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save password"}
              </button>
            </form>
            <p className="mt-4 text-[11px] leading-relaxed text-white/30">
              This link works once. After signing in you can change your password
              any time from Settings.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
