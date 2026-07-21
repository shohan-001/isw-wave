// Shared types + tiny helpers usable on client and server (no server-only deps).

// Client-safe view of the logged-in account (never includes the password hash).
export type AuthUser = {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
};

export type PublicRequest = {
  id: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  channelName: string;
  requesterName: string;
  status: "pending" | "approved" | "rejected" | "played";
  queuePosition: number | null;
  createdAt: string;
};

export type QueuePayload = {
  eventName: string;
  nowPlaying: PublicRequest | null;
  queue: PublicRequest[]; // approved, in play order
};

export type Settings = {
  requestLimit: number;
  approvalMode: "manual" | "auto";
};

// Format seconds as m:ss (or h:mm:ss for long videos).
export function formatDuration(total: number): string {
  if (!total || total < 0) return "0:00";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
