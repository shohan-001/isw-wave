import { notFound } from "next/navigation";
import { getOwnerPanelPath, ownerPasswordConfigured } from "@/lib/auth";
import { OwnerOpsClient } from "./OwnerOpsClient";

export const dynamic = "force-dynamic";

export default function OwnerOpsPage({
  params,
}: {
  params: { path: string };
}) {
  const expected = getOwnerPanelPath();
  if (!expected || !ownerPasswordConfigured()) notFound();
  if (params.path !== expected) notFound();

  return <OwnerOpsClient />;
}
