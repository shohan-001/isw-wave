"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type EventRow = {
  id: string;
  name: string;
  slug: string;
  accessCode: string;
  accentColor: string;
  createdAt: string;
};

export function OrganizerEventsList({ activeEventId }: { activeEventId?: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/events", { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { events: EventRow[] };
      setEvents(d.events);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function switchEvent(eventId: string) {
    await fetch("/api/events/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    window.location.href = "/admin";
  }

  if (loading) {
    return <p className="text-sm text-white/40">Loading events…</p>;
  }

  return (
    <div className="space-y-4">
      {events.length === 0 ? (
        <p className="text-sm text-white/45">
          No events yet. Create your first one to get started.
        </p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-white">{ev.name}</p>
                <p className="text-sm text-white/40">
                  /e/{ev.slug}
                  {ev.id === activeEventId ? (
                    <span className="ml-2 text-pulse">· active</span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/e/${ev.slug}/display`}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/60 hover:text-white"
                >
                  Display
                </Link>
                <button
                  type="button"
                  onClick={() => switchEvent(ev.id)}
                  className="rounded-lg bg-pulse/90 px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
                >
                  Open control room
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/organizer/events/new"
        className="inline-flex rounded-xl border border-pulse/40 px-4 py-2 text-sm font-medium text-pulse hover:bg-pulse/10"
      >
        + New event
      </Link>
    </div>
  );
}
