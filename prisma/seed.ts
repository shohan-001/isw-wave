import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { resolveDbConfig } from "../src/lib/db-config";

const adapter = new PrismaLibSQL(resolveDbConfig());
const prisma = new PrismaClient({ adapter });

const EVENT_ID = "isw-wave-main-event";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateAccessCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

async function main() {
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

  // Ensure a unique access code for the seeded event.
  const existing = await prisma.event.findUnique({ where: { id: EVENT_ID } });
  const accessCode = existing?.accessCode || generateAccessCode();

  await prisma.event.upsert({
    where: { id: EVENT_ID },
    update: { adminId: admin.id, name: "ISW Wave — Live Requests" },
    create: {
      id: EVENT_ID,
      name: "ISW Wave — Live Requests",
      accessCode,
      adminId: admin.id,
      requestLimit: 3,
      approvalMode: "manual",
    },
  });

  const event = await prisma.event.findUniqueOrThrow({ where: { id: EVENT_ID } });
  console.log(
    `Seeded event "${event.id}" with access code: ${event.accessCode}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
