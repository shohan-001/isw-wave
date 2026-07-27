import { SetPasswordClient } from "./SetPasswordClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set your password · ISW Wave",
  robots: { index: false, follow: false },
};

export default function SetPasswordPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  return <SetPasswordClient token={(searchParams?.token || "").trim()} />;
}
