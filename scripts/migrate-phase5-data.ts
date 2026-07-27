/**
 * Phase 5 data migration — run AFTER prisma migrate deploy.
 *
 * Creates an Organization per event owner, assigns organizationId + slug to
 * every Event, preserving all requests/participants/settings.
 *
 * Usage:
 *   npm run db:migrate-phase5
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { resolveDbConfig } from "../src/lib/db-config";
import { slugify, ensureUniqueSlug } from "../src/lib/slug";

const db = resolveDbConfig();
const adapter = new PrismaLibSQL({ url: db.url, authToken: db.authToken });
const prisma = new PrismaClient({ adapter });

const LEGACY_SLUG = "isw-wave-main";
const LEGACY_EVENT_ID = "isw-wave-main-event";

async function main() {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "asc" },
  });

  if (events.length === 0) {
    console.log("No events to migrate.");
    return;
  }

  const ownerIds = [...new Set(events.map((e) => e.adminId))];
  const orgByOwner = new Map<string, string>();

  for (const ownerId of ownerIds) {
    const user = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!user) {
      console.warn(`Skipping owner ${ownerId} — user not found`);
      continue;
    }

    const existing = await prisma.organization.findUnique({
      where: { ownerId },
    });
    if (existing) {
      orgByOwner.set(ownerId, existing.id);
      console.log(`Organization exists for ${user.username}: ${existing.id}`);
      continue;
    }

    const org = await prisma.organization.create({
      data: {
        name: `${user.username}'s events`,
        ownerId,
      },
    });
    orgByOwner.set(ownerId, org.id);
    console.log(`Created organization for ${user.username}: ${org.id}`);
  }

  const usedSlugs = new Set<string>();

  for (const event of events) {
    const orgId = orgByOwner.get(event.adminId);
    if (!orgId) {
      console.warn(`No org for event ${event.id}, skipping`);
      continue;
    }

    let slug = event.slug;
    if (!slug || slug === "pending" || slug.startsWith("legacy-")) {
      if (event.id === LEGACY_EVENT_ID) {
        slug = LEGACY_SLUG;
      } else {
        slug = slugify(event.name) || `event-${event.id.slice(0, 8)}`;
      }
      slug = ensureUniqueSlug(slug, usedSlugs);
      usedSlugs.add(slug);
    } else {
      usedSlugs.add(slug);
    }

    await prisma.event.update({
      where: { id: event.id },
      data: { organizationId: orgId, slug },
    });
    console.log(`Event "${event.name}" → /e/${slug} (org ${orgId})`);
  }

  console.log("Phase 5 data migration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
