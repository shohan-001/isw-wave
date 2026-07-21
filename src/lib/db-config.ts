import path from "node:path";

// Resolve the LibSQL connection config from env, used by BOTH the app runtime
// (src/lib/db.ts) and the seed script so they always target the same database.
//
// Path-resolution gotcha: the Prisma CLI resolves a `file:` URL relative to the
// schema directory (prisma/), but a libsql adapter created at runtime resolves
// it relative to process.cwd(). To keep the CLI (migrate/seed) and the running
// app pointing at ONE file, we normalize any local `file:` URL to an absolute
// path at <cwd>/prisma/<filename>.
export function resolveDbConfig(): { url: string; authToken?: string } {
  const turso = process.env.TURSO_DATABASE_URL;
  if (turso) {
    return { url: turso, authToken: process.env.TURSO_AUTH_TOKEN || undefined };
  }

  const raw = process.env.DATABASE_URL || "file:./dev.db";
  if (raw.startsWith("file:")) {
    const rel = raw.slice("file:".length); // e.g. "./dev.db"
    const filename = path.basename(rel); // "dev.db"
    const abs = path.join(process.cwd(), "prisma", filename);
    return { url: `file:${abs}` };
  }

  // libsql:// or http(s):// URL supplied directly via DATABASE_URL.
  return { url: raw, authToken: process.env.TURSO_AUTH_TOKEN || undefined };
}
