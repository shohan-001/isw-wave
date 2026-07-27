"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { DashboardPanel } from "./panels/DashboardPanel";
import { EventsPanel } from "./panels/EventsPanel";
import { InvitesPanel } from "./panels/InvitesPanel";
import { LogsPanel } from "./panels/LogsPanel";
import { OrganizersPanel } from "./panels/OrganizersPanel";
import { RequestsPanel } from "./panels/RequestsPanel";
import { StaffPanel } from "./panels/StaffPanel";
import type { OpsTab, Overview, Viewer } from "./types";

const TABS: { id: OpsTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "requests", label: "Requests" },
  { id: "events", label: "Events" },
  { id: "organizers", label: "Organizers" },
  { id: "invites", label: "Invites" },
  { id: "staff", label: "Staff" },
  { id: "logs", label: "Logs" },
];

export function OwnerOpsClient() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [checked, setChecked] = useState(false);
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [tab, setTab] = useState<OpsTab>("dashboard");
  const [data, setData] = useState<Overview | null>(null);
  const pendingRequests = data?.stats?.pendingRequests ?? 0;

  const probe = useCallback(async () => {
    const res = await fetch("/api/owner/login", { cache: "no-store" });
    const d = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      staff?: Viewer | null;
      bootstrapAvailable?: boolean;
    };
    setViewer(d.ok && d.staff ? d.staff : null);
    setBootstrapAvailable(Boolean(d.bootstrapAvailable));
    setChecked(true);
  }, []);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/owner/overview", { cache: "no-store" });
    if (res.status === 401) {
      setViewer(null);
      setData(null);
      return;
    }
    if (!res.ok) return;
    setData((await res.json()) as Overview);
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  // Only the live-data tabs need polling; Staff / Invites / Logs fetch on demand.
  useEffect(() => {
    if (!viewer) return;
    void loadOverview();
    if (tab === "staff" || tab === "invites" || tab === "logs") return;
    const t = setInterval(() => void loadOverview(), 7000);
    return () => clearInterval(t);
  }, [viewer, tab, loadOverview]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginErr(null);
    try {
      const res = await fetch("/api/owner/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        error?: string;
        staff?: Viewer;
      };
      if (!res.ok || !d.staff) {
        setLoginErr(d.error || "Access denied.");
        return;
      }
      setPassword("");
      setViewer(d.staff);
    } catch {
      setLoginErr("Network error.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/owner/logout", { method: "POST" });
    setViewer(null);
    setData(null);
    setTab("dashboard");
    await probe();
  }

  if (!checked) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-ink text-white/40">
        Checking session…
      </main>
    );
  }

  if (!viewer) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#07080c] px-4">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-glow"
        >
          <BrandMark size={36} />
          <h1 className="mt-4 font-display text-xl font-bold text-white">
            Ops console
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Restricted to site staff. Sign in with your staff account.
          </p>
          <input
            autoFocus
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="mt-5 w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white focus:border-pulse/50 focus:outline-none"
            placeholder="Username or email"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white focus:border-pulse/50 focus:outline-none"
            placeholder="Password"
          />
          {loginErr ? (
            <p className="mt-2 text-xs text-rose-300">{loginErr}</p>
          ) : null}
          <button
            type="submit"
            disabled={loginBusy || !identifier || !password}
            className="mt-4 w-full rounded-xl bg-pulse py-2.5 text-sm font-bold text-ink disabled:opacity-50"
          >
            {loginBusy ? "Unlocking…" : "Unlock"}
          </button>
          {bootstrapAvailable ? (
            <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-[11px] leading-relaxed text-amber-200">
              First run: sign in with any username plus your OWNER_PASSWORD to
              create the owner account. The bootstrap credential stops working
              once that account exists.
            </p>
          ) : null}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#07080c] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07080c]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark size={28} showWordmark={false} />
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-pulse">
                Ops console
              </p>
              <p className="text-xs text-white/40">
                {viewer.username} · {viewer.role} · {data?.dayKey ?? "…"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/60 hover:text-white"
          >
            Sign out
          </button>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.id
                  ? "bg-pulse/15 text-pulse"
                  : "text-white/45 hover:bg-white/[0.05] hover:text-white/80"
              }`}
            >
              {t.label}
              {t.id === "requests" && pendingRequests > 0 ? (
                <span className="ml-1.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                  {pendingRequests}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {tab === "dashboard" ? (
          <DashboardPanel
            data={data}
            onOpenEvents={() => setTab("events")}
            onOpenRequests={() => setTab("requests")}
          />
        ) : null}
        {tab === "requests" ? (
          <RequestsPanel onReviewed={() => void loadOverview()} />
        ) : null}
        {tab === "events" ? (
          <EventsPanel data={data} onChanged={() => void loadOverview()} />
        ) : null}
        {tab === "organizers" ? (
          <OrganizersPanel data={data} viewerRole={viewer.role} />
        ) : null}
        {tab === "invites" ? <InvitesPanel viewerRole={viewer.role} /> : null}
        {tab === "staff" ? <StaffPanel viewerRole={viewer.role} /> : null}
        {tab === "logs" ? <LogsPanel viewerRole={viewer.role} /> : null}
      </div>
    </main>
  );
}
