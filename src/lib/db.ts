import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { resolveDbConfig } from "./db-config";

// Single Prisma client backed by the LibSQL driver adapter.
//
// - In production, set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) to a hosted
//   Turso instance. Vercel's filesystem is ephemeral, so a local SQLite file
//   would be wiped between invocations — Turso is the persistent target.
// - In local dev (no TURSO_DATABASE_URL), we use the same prisma/dev.db file
//   the Prisma CLI migrates/seeds (see resolveDbConfig for the path handling).
const adapter = new PrismaLibSQL(resolveDbConfig());

// Reuse the client across hot reloads in dev to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
