import type { PublicRequest } from "@/lib/types";

const STYLES: Record<PublicRequest["status"], string> = {
  pending: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  approved: "bg-pulse/15 text-pulse ring-pulse/30",
  rejected: "bg-red-500/15 text-red-300 ring-red-500/30",
  played: "bg-white/10 text-white/60 ring-white/20",
};

const LABELS: Record<PublicRequest["status"], string> = {
  pending: "Pending",
  approved: "In queue",
  rejected: "Rejected",
  played: "Played",
};

export function StatusBadge({ status }: { status: PublicRequest["status"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
