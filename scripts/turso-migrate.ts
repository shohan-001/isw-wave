/**
 * Apply Prisma migration SQL files to Turso/LibSQL.
 *
 * Prisma's sqlite provider rejects libsql:// URLs, so `prisma migrate deploy`
 * cannot target Turso. The app uses the LibSQL adapter at runtime — this script
 * applies the same migration files over that connection.
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:turso
 *
 * If an older schema is half-applied and migrations fail, reset then seed:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:turso -- --reset
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:seed
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient, type Client } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
const reset = process.argv.includes("--reset");

if (!url || !url.startsWith("libsql://")) {
  console.error(
    "Set TURSO_DATABASE_URL to your libsql://… URL (not a local file: URL)."
  );
  process.exit(1);
}
if (!authToken) {
  console.error("Set TURSO_AUTH_TOKEN.");
  process.exit(1);
}

const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

function listMigrations(): { name: string; sqlPath: string }[] {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => ({
      name,
      sqlPath: path.join(migrationsDir, name, "migration.sql"),
    }))
    .filter((m) => fs.existsSync(m.sqlPath));
}

function splitStatements(sql: string): string[] {
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlockComments
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean);
}

async function ensureMigrationsTable(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function resetSchema(client: Client) {
  console.log("Resetting Turso schema (drops app tables)…");
  // Order matters for FKs; IF EXISTS keeps this safe on empty DBs.
  for (const table of [
    "Request",
    "Participant",
    "Event",
    "User",
    "_prisma_migrations",
  ]) {
    await client.execute(`DROP TABLE IF EXISTS "${table}"`);
  }
}

/** Final Phase-2 schema in one shot (used after --reset). */
async function applyFinalSchema(client: Client) {
  const statements = [
    `CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "isAdmin" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX "User_username_key" ON "User"("username")`,
    `CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`,
    `CREATE TABLE "Event" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "accessCode" TEXT NOT NULL,
      "adminId" TEXT NOT NULL,
      "requestLimit" INTEGER NOT NULL DEFAULT 3,
      "approvalMode" TEXT NOT NULL DEFAULT 'manual',
      "currentRequestId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Event_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX "Event_accessCode_key" ON "Event"("accessCode")`,
    `CREATE UNIQUE INDEX "Event_currentRequestId_key" ON "Event"("currentRequestId")`,
    `CREATE INDEX "Event_adminId_idx" ON "Event"("adminId")`,
    `CREATE TABLE "Participant" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "eventId" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "deviceId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Participant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX "Participant_eventId_deviceId_key" ON "Participant"("eventId", "deviceId")`,
    `CREATE INDEX "Participant_deviceId_idx" ON "Participant"("deviceId")`,
    `CREATE INDEX "Participant_eventId_idx" ON "Participant"("eventId")`,
    `CREATE TABLE "Request" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "eventId" TEXT NOT NULL,
      "youtubeVideoId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "thumbnailUrl" TEXT NOT NULL,
      "durationSeconds" INTEGER NOT NULL,
      "channelName" TEXT NOT NULL DEFAULT '',
      "participantId" TEXT NOT NULL,
      "requesterName" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "queuePosition" INTEGER,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Request_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Request_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE INDEX "Request_eventId_status_idx" ON "Request"("eventId", "status")`,
    `CREATE INDEX "Request_participantId_idx" ON "Request"("participantId")`,
  ];

  for (const statement of statements) {
    await client.execute(statement);
  }

  await ensureMigrationsTable(client);

  // Mark every migration file as applied so future incremental deploys skip them.
  for (const m of listMigrations()) {
    const sql = fs.readFileSync(m.sqlPath, "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    await client.execute({
      sql: `INSERT INTO "_prisma_migrations"
        ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
        VALUES (?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, 1)`,
      args: [crypto.randomUUID(), checksum, m.name],
    });
  }
}

async function applyPending(client: Client) {
  await ensureMigrationsTable(client);

  const applied = await client.execute(
    `SELECT "migration_name" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL`
  );
  const done = new Set(applied.rows.map((r) => String(r.migration_name)));
  const migrations = listMigrations();

  console.log(`Found ${migrations.length} migration(s).`);

  for (const m of migrations) {
    if (done.has(m.name)) {
      console.log(`  ✓ already applied: ${m.name}`);
      continue;
    }

    const sql = fs.readFileSync(m.sqlPath, "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    const statements = splitStatements(sql);
    const id = crypto.randomUUID();

    console.log(`  → applying ${m.name} (${statements.length} statements)…`);

    await client.execute({
      sql: `INSERT INTO "_prisma_migrations"
        ("id", "checksum", "migration_name", "started_at", "applied_steps_count")
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)`,
      args: [id, checksum, m.name],
    });

    try {
      for (const statement of statements) {
        await client.execute(statement);
      }
      await client.execute({
        sql: `UPDATE "_prisma_migrations"
              SET "finished_at" = CURRENT_TIMESTAMP,
                  "applied_steps_count" = ?
              WHERE "id" = ?`,
        args: [statements.length, id],
      });
      console.log(`  ✓ applied: ${m.name}`);
    } catch (err) {
      await client.execute({
        sql: `UPDATE "_prisma_migrations" SET "logs" = ? WHERE "id" = ?`,
        args: [String(err), id],
      });
      console.error(`  ✗ failed: ${m.name}`);
      console.error(
        "Tip: if the remote DB has an older schema, re-run with --reset then db:seed."
      );
      throw err;
    }
  }
}

async function main() {
  const client = createClient({ url, authToken });
  console.log(`Turso: ${url}`);

  if (reset) {
    await resetSchema(client);
    await applyFinalSchema(client);
    console.log("Turso schema reset to current Phase 2 model.");
  } else {
    await applyPending(client);
    console.log("Turso migrations complete.");
  }

  console.log(
    "Next: TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… ADMIN_PASSWORD=… npm run db:seed"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
