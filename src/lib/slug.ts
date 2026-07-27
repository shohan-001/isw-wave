// URL slug helpers for /e/{slug} routes.

export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2;
}

export function ensureUniqueSlug(base: string, taken: Set<string>): string {
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n}`;
    n++;
  }
  return slug;
}

export function eventPath(slug: string): string {
  return `/e/${slug}`;
}

export function eventDisplayPath(slug: string): string {
  return `/e/${slug}/display`;
}

export function eventJoinPath(slug: string): string {
  return `/e/${slug}`;
}
