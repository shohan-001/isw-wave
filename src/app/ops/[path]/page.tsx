import { notFound } from "next/navigation";
import { getOwnerPanelPath } from "@/lib/auth";
import { OwnerOpsClient } from "./OwnerOpsClient";

export const dynamic = "force-dynamic";

export default function OwnerOpsPage({
  params,
}: {
  params: { path: string };
}) {
  // Only the secret path gates the page now; staff accounts gate the data, so
  // the console stays reachable after OWNER_PASSWORD is retired.
  const expected = getOwnerPanelPath();
  if (!expected) notFound();
  if (params.path !== expected) notFound();

  return <OwnerOpsClient />;
}
