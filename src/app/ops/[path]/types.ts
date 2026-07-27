export type StaffRole = "owner" | "moderator";

export type Viewer = {
  id: string;
  username: string;
  email: string;
  role: StaffRole;
};

export type OverviewEvent = {
  id: string;
  name: string;
  slug: string;
  accessCode: string;
  organizationName: string;
  admin: { id: string; username: string; email: string };
  participantCount: number;
  activeGuestCount: number;
  bannedCount: number;
  pendingCount: number;
  queueDepth: number;
  suspended: boolean;
  suspendReason: string;
  youtubeDailyQuotaCap: number;
  youtubeUnitsUsedToday: number;
  nowPlaying: {
    id: string;
    title: string;
    youtubeVideoId: string;
    requesterName: string;
  } | null;
  playbackPlaying: boolean;
  updatedAt: string;
};

export type TopSong = {
  eventId: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  playCount: number;
};

export type Organizer = {
  id: string;
  username: string;
  email: string;
  eventCount: number;
  createdAt: string;
};

export type ParticipantRow = {
  id: string;
  displayName: string;
  deviceId: string;
  banned: boolean;
  banReason: string;
  requestCount: number;
  voteCount: number;
  createdAt: string;
};

export type DashboardStats = {
  pendingRequests: number;
  liveNow: number;
  totalEvents: number;
  totalOrganizers: number;
  guestsToday: number;
  loginsToday: number;
  staffCount: number;
  quotaUnitsUsed: number;
  quotaLimit: number;
  quotaPercentUsed: number;
};

export type Overview = {
  dayKey: string;
  viewer: Viewer;
  stats: DashboardStats;
  events: OverviewEvent[];
  topSongs: TopSong[];
  organizers: Organizer[];
};

export type StaffRow = {
  id: string;
  username: string;
  email: string;
  role: StaffRole;
  disabled: boolean;
  createdAt: string;
  isSelf: boolean;
};

export type LogRow = {
  id: string;
  type: string;
  actorType: string;
  actorLabel: string;
  eventId: string;
  targetType: string;
  targetId: string;
  details: string;
  ip: string;
  userAgent: string;
  createdAt: string;
};

export type EventRequestRow = {
  id: string;
  publicToken: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  orgName: string;
  eventName: string;
  eventDetails: string;
  venue: string;
  expectedGuests: number;
  startsAt: string;
  timezone: string;
  status: string;
  reviewNote: string;
  reviewedBy: string;
  reviewedAt: string | null;
  createdEventId: string;
  createdUserId: string;
  ip: string;
  createdAt: string;
  suggestedSlug: string;
};

export type ApprovalResult = {
  emailSent: boolean;
  organizer: {
    username: string;
    email: string;
    setupUrl: string;
    eventUrl: string;
    accessCode: string;
    eventLimit: number;
  };
};

export type InviteCodeRow = {
  id: string;
  code: string;
  label: string;
  maxUses: number;
  usedCount: number;
  eventLimit: number;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  status: "active" | "revoked" | "expired" | "exhausted";
};

export type OpsTab =
  | "dashboard"
  | "requests"
  | "events"
  | "organizers"
  | "invites"
  | "staff"
  | "logs";
