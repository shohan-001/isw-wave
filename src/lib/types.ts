// Shared types + tiny helpers usable on client and server (no server-only deps).

export type AuthUser =
  | {
      role: "admin";
      id: string;
      username: string;
      email: string;
      eventId: string;
      eventSlug: string;
      isAdmin: true;
    }
  | {
      role: "participant";
      id: string;
      displayName: string;
      eventId: string;
      eventSlug: string;
      isAdmin: false;
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
  voteCount: number;
  flagged: boolean;
  flagReason: string;
  iVoted?: boolean;
};

export type QueuePayload = {
  eventId: string;
  eventName: string;
  accessCode: string;
  accentColor: string;
  logoUrl: string;
  displayMode: "minimal" | "full";
  nowPlaying: PublicRequest | null;
  queue: PublicRequest[];
};

export type Settings = {
  requestLimit: number;
  approvalMode: "manual" | "auto";
  accessCode: string;
  eventName: string;
  eventId: string;
  maxSongSeconds: number;
  blockedKeywords: string;
  autoModMode: "reject" | "flag";
  accentColor: string;
  logoUrl: string;
  displayMode: "minimal" | "full";
};

export type EventStats = {
  totalRequests: number;
  approved: number;
  rejected: number;
  pending: number;
  played: number;
  queueLength: number;
  mostActiveRequester: string | null;
  mostActiveCount: number;
};

export type QuotaInfo = {
  dayKey: string;
  unitsUsed: number;
  limit: number;
  remaining: number;
  percentUsed: number;
};

export type FallbackTrack = {
  id: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  channelName: string;
  position: number;
};

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
