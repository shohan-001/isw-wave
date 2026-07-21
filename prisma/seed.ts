import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { resolveDbConfig } from "../src/lib/db-config";

// Standalone seed client, using the same connection resolver as the app so the
// CLI and runtime always target one database file (see src/lib/db-config.ts).
const adapter = new PrismaLibSQL(resolveDbConfig());
const prisma = new PrismaClient({ adapter });

const EVENT_ID = "isw-wave-main-event";

async function main() {
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
