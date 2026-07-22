import path from "node:path";

export type DbConfig = {
  url: string;
  authToken?: string;
  /** True when pointing at hosted Turso / remote LibSQL. */
  remote: boolean;
};

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

// Resolve the LibSQL connection config from env, used by BOTH the app runtime
 // (src/lib/db.ts) and the seed script so they always target the same database.
 //
 // On Vercel, TURSO_DATABASE_URL + TURSO_AUTH_TOKEN are required. An empty or
 // missing Turso URL would otherwise fall through to a local file: path that
 // cannot work on the ephemeral serverless filesystem.
export function resolveDbConfig(): DbConfig {
  const turso = trimEnv("TURSO_DATABASE_URL");
  const token = trimEnv("TURSO_AUTH_TOKEN");

  if (turso) {
    return { url: turso, authToken: token, remote: true };
  }

  // Production without Turso is a hard misconfiguration — fail early with a
  // clear message instead of a cryptic SQLite / JSON parse error in the UI.
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing TURSO_DATABASE_URL. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the Vercel project environment (Production), then redeploy."
    );
  }

  const raw = trimEnv("DATABASE_URL") || "file:./dev.db";
  if (raw.startsWith("file:")) {
    const rel = raw.slice("file:".length);
    const filename = path.basename(rel);
    const abs = path.join(process.cwd(), "prisma", filename);
    return { url: `file:${abs}`, remote: false };
  }

  return {
    url: raw,
    authToken: token,
    remote: raw.startsWith("libsql://") || raw.startsWith("https://"),
  };
}
