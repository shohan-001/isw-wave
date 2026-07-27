import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL as PrismaLibSQLNode } from "@prisma/adapter-libsql";
import { PrismaLibSQL as PrismaLibSQLWeb } from "@prisma/adapter-libsql/web";
import { resolveDbConfig } from "./db-config";

// Prisma + LibSQL:
 // - Local file DB → Node adapter
 // - Turso / remote on Vercel serverless → Web adapter (HTTP/fetch). The Node
 //   WebSocket path is a common source of opaque 401 / connection failures on
 //   Vercel even when the same token works from a laptop.
const config = resolveDbConfig();
const Adapter = config.remote ? PrismaLibSQLWeb : PrismaLibSQLNode;
const adapter = new Adapter({
  url: config.url,
  authToken: config.authToken,
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
