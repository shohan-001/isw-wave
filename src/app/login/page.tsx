import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthClient } from "./AuthClient";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { code?: string };
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.isAdmin ? "/admin" : "/");
  return <AuthClient initialCode={(searchParams?.code || "").toUpperCase()} />;
}
