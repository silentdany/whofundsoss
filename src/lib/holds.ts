/**
 * Weekly holds (data/holds/weekly-holds.csv), shared by the site and the public
 * API so a held company is hidden in both. A hold is active while
 * today < review_on. A malformed or blank review_on fails closed (stays held).
 * Pure module for node:test.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** slug -> review_on ("" = no end). */
export function parseHolds(csvText: string): Map<string, string> {
  const lines = csvText.replace(/^\ufeff/, "").split(/\r?\n/).filter((l) => l.trim());
  const header = parseCsvLine(lines.shift() ?? "").map((h) => h.trim());
  const i = header.indexOf("slug");
  const j = header.indexOf("review_on");
  const out = new Map<string, string>();
  for (const l of lines) {
    const cells = parseCsvLine(l);
    const slug = (cells[i] ?? "").trim().toLowerCase();
    if (!slug) continue;
    const review = (cells[j] ?? "").trim();
    out.set(slug, DATE_RE.test(review) ? review : "");
  }
  return out;
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isHeld(holds: ReadonlyMap<string, string>, slug: string, today: string): boolean {
  if (!holds.has(slug)) return false;
  const until = holds.get(slug) ?? "";
  return !until || today < until;
}

export function activeHolds(holds: ReadonlyMap<string, string>, today: string): Set<string> {
  return new Set([...holds.keys()].filter((slug) => isHeld(holds, slug, today)));
}

type CatalogShape = {
  index: { slug: string }[];
  details: Record<string, unknown>;
  alliances: { a: string; b: string }[];
  commons: { funders: { slug: string }[]; sponsors: number }[];
  watchlist: { slug: string }[];
};

/** Catalog with every trace of held companies removed. */
export function withoutHeld<T extends CatalogShape>(catalog: T, held: ReadonlySet<string>): T {
  if (held.size === 0) return catalog;
  const details = { ...catalog.details };
  for (const slug of held) delete details[slug];
  return {
    ...catalog,
    index: catalog.index.filter((r) => !held.has(r.slug)),
    details,
    alliances: catalog.alliances.filter((l) => !held.has(l.a) && !held.has(l.b)),
    commons: catalog.commons.map((c) => {
      const funders = c.funders.filter((f) => !held.has(f.slug));
      return { ...c, funders, sponsors: c.sponsors - (c.funders.length - funders.length) };
    }),
    watchlist: catalog.watchlist.filter((w) => !held.has(w.slug)),
  };
}
