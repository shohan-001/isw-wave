import { RequestClient } from "./RequestClient";
import { getEvent } from "@/lib/queries";

// Public request page (server shell). We read the event name here so branding
// is present on first paint; all interactivity lives in the client component.
export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const event = await getEvent();
  return <RequestClient eventName={event.name} />;
}
