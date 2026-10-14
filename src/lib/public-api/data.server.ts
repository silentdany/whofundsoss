import { expandSlugs } from "@/lib/slug-aliases";
/**
 * Server wiring for the public API. Everything is bundled at build time from
 * the site snapshot (src/data/catalog.json, data/weekly/*.json, the denylist
 * and the exclusion and hold lists), so each deploy of a weekly snapshot
 * refreshes the API. Responses are then cached by the CDN (see http.ts).
 */
import raw from "@/data/catalog.json";
import publicDenylist from "@/data/public-spam-denylist.json";
import exclusionsCsv from "../../../data/exclusions/raw-exclusions.csv?raw";
import holdsCsv from "../../../data/holds/weekly-holds.csv?raw";
import genericHostsPy from "../../../scripts/weekly/generic_hosts.py?raw";
import { SPAM_DENYLIST, SPAM_DENYLIST_VERSION } from "@/lib/spam-denylist";
import {
  createPublicApi,
  exclusionSlugs,
  holdSlugs,
  parseGenericHosts,
  type CatalogLike,
  type WeeklyFile,
} from "./core";
import { createRateLimiter, servePublicApi } from "./http";
import { isOffCycle, officialWeeksFrom } from "@/lib/weekly-snapshots";
import type { ApiResult } from "./core";

const catalog = raw as unknown as CatalogLike;

const weeklyModules = import.meta.glob<WeeklyFile>("../../../data/weekly/*.json", { import: "default" });
const weeklyLoaders = new Map<string, () => Promise<WeeklyFile>>();
for (const [path, load] of Object.entries(weeklyModules)) {
  const m = path.match(/(\d{4}-\d{2}-\d{2})\.json$/);
  if (m) weeklyLoaders.set(m[1]!, load);
}
export const WEEKS = [...weeklyLoaders.keys()].sort().reverse();

const held = holdSlugs(holdsCsv);

export const api = createPublicApi({
  catalog,
  denylistVersion: SPAM_DENYLIST_VERSION,
  // Old and new slug forms (slug-renames.json) are both filtered.
  spam: expandSlugs(Object.keys(SPAM_DENYLIST)),
  excluded: expandSlugs(exclusionSlugs(exclusionsCsv, catalog.index, parseGenericHosts(genericHostsPy))),
  held,
  publicDenylist,
});

/** A weekly file by date; off-cycle files are never an official week (null). */
export async function loadWeek(week: string | null): Promise<WeeklyFile | null> {
  const load = week ? weeklyLoaders.get(week) : undefined;
  if (!load) return null;
  const file = await load();
  return isOffCycle((file as { offCycle?: unknown }).offCycle) ? null : file;
}

let official: Promise<string[]> | undefined;
/** Official weeks (off-cycle and unreadable files excluded), newest first. */
export function officialWeeks(): Promise<string[]> {
  official ??= officialWeeksFrom(WEEKS, (w) => weeklyLoaders.get(w)!());
  return official;
}

const limiter = createRateLimiter(60, 60_000);
const snapshotTag = `${catalog.meta.collectedAt}.${catalog.meta.hash.slice(0, 8)}.${SPAM_DENYLIST_VERSION}.${WEEKS[0] ?? "none"}`;

export function serve(request: Request, handler: (url: URL) => ApiResult | Promise<ApiResult>) {
  return servePublicApi(request, limiter, snapshotTag, handler, api.error);
}
