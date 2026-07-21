import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import { resolveDbConfig } from "../src/lib/db-config";

// Standalone seed client, using the same connection resolver as the app so the
// CLI and runtime always target one database file (see src/lib/db-config.ts).
const adapter = new PrismaLibSQL(resolveDbConfig());
const prisma = new PrismaClient({ adapter });

const EVENT_ID = "isw-wave-main-event";

async function main() {
  // The single Phase-1 event row.
  await prisma.event.upsert({
    where: { id: EVENT_ID },
    update: {},
    create: {
      id: EVENT_ID,
      name: "ISW Wave — Live Requests",
      requestLimit: 3,
      approvalMode: "manual",
    },
  });
  console.log(`Seeded event "${EVENT_ID}".`);

  // Phase 2: seed one admin account from env. A full "invite other admins" flow
  // is intentionally out of scope — this is the single bootstrap admin.
  const email = (process.env.ADMIN_EMAIL || "admin@iswwave.local")
    .trim()
    .toLowerCase();
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "changeme";

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { isAdmin: true, username, passwordHash },
    create: { email, username, passwordHash, isAdmin: true },
  });
  console.log(
    `Seeded admin user "${admin.username}" <${admin.email}> (isAdmin=true).`
  );
  if (password === "changeme") {
    console.warn(
      "  ⚠ Using default password 'changeme' — set ADMIN_PASSWORD before any real deployment."
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
