/** Canonical public origin for QR codes and absolute links. */
const PRODUCTION_ORIGIN = "https://isw-wave.isharaka.dev";

function isVercelAppHost(origin: string): boolean {
  try {
    const withProto = /^https?:\/\//i.test(origin) ? origin : `https://${origin}`;
    return /\.vercel\.app$/i.test(new URL(withProto).hostname);
  } catch {
    return false;
  }
}

/**
 * Public site origin used in QR codes and absolute links.
 * Prefer NEXT_PUBLIC_BASE_URL; never fall back to *.vercel.app so guests
 * are not sent through Vercel Deployment Protection / SSO.
 */
export function getPublicBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) {
    const origin = configured.replace(/\/$/, "");
    if (isVercelAppHost(origin)) return PRODUCTION_ORIGIN;
    return origin;
  }

  // On Vercel / production, always use the custom domain for public QR links.
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return PRODUCTION_ORIGIN;
  }

  return "http://localhost:3000";
}
