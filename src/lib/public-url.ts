/** Public site origin used in QR codes and absolute links. */
export function getPublicBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  // Vercel sets VERCEL_URL (no protocol), e.g. isw-wave.vercel.app
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return "http://localhost:3000";
}
