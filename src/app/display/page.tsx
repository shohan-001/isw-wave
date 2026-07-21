import { DisplayClient } from "./DisplayClient";

// Public projector/display page (server shell). Passes the request-page URL for
// the QR code. This screen is INFORMATIONAL and SILENT — it never produces
// audio. The admin dashboard drives venue audio (see the admin player).
export const dynamic = "force-dynamic";

export default function DisplayPage() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return <DisplayClient requestUrl={baseUrl} />;
}
