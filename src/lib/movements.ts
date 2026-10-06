import type { MovementCompany, MovementsPayload, Meta } from "@/lib/types";

export type SnapFile = {
  meta: {
    collectedAt: string;
    hash: string;
    companies: number;
    sponsorships: number;
    ranked: number;
    publicUsdAll: number;
    publicUsdRanked: number;
  };
  index: {
    slug: string;
    name: string;
    rank: number | null;
    publicUsd: number;
    projects: number;
    ghBeneficiaries: number;
  }[];
};

function toMove(
  slug: string,
  currRow: SnapFile["index"][number] | undefined,
  prevRow: SnapFile["index"][number] | undefined,
): MovementCompany {
  const publicUsd = currRow?.publicUsd ?? prevRow?.publicUsd ?? 0;
  const previousPublicUsd = prevRow ? prevRow.publicUsd : null;
  const rank = currRow?.rank ?? null;
  const previousRank = prevRow?.rank ?? null;
  const deltaRank = rank != null && previousRank != null ? previousRank - rank : null;
  return {
    slug,
    name: currRow?.name ?? prevRow?.name ?? slug,
    rank,
    previousRank,
    publicUsd,
    previousPublicUsd,
    deltaUsd: previousPublicUsd == null ? publicUsd : publicUsd - previousPublicUsd,
    deltaRank,
  };
}

/** Diff two catalog snapshot indexes. Never reads weekly scraper JSON. */
export function buildMovementsFromSnaps(
  prev: SnapFile,
  curr: SnapFile,
  meta: Meta,
): MovementsPayload {
  const prevBy = new Map(prev.index.map((r) => [r.slug, r]));
  const currBy = new Map(curr.index.map((r) => [r.slug, r]));

  const climbers: MovementCompany[] = [];
  const fallers: MovementCompany[] = [];
  for (const [slug, row] of currBy) {
    const before = prevBy.get(slug);
    if (!before) continue;
    const delta = row.publicUsd - before.publicUsd;
    if (delta >= 1) climbers.push(toMove(slug, row, before));
    else if (delta <= -1) fallers.push(toMove(slug, row, before));
  }
  climbers.sort((a, b) => b.deltaUsd - a.deltaUsd || (a.rank ?? 9999) - (b.rank ?? 9999));
  fallers.sort((a, b) => a.deltaUsd - b.deltaUsd || (a.rank ?? 9999) - (b.rank ?? 9999));

  const prevTop = new Set([...prevBy.values()].filter((r) => r.rank != null).map((r) => r.slug));
  const currTop = new Set([...currBy.values()].filter((r) => r.rank != null).map((r) => r.slug));

  const newTop200 = [...currTop]
    .filter((slug) => !prevTop.has(slug))
    .map((slug) => toMove(slug, currBy.get(slug), prevBy.get(slug)))
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));

  const leftTop200 = [...prevTop]
    .filter((slug) => !currTop.has(slug))
    .map((slug) => toMove(slug, currBy.get(slug), prevBy.get(slug)))
    .sort((a, b) => (a.previousRank ?? 9999) - (b.previousRank ?? 9999));

  const newCompanies = [...currBy.keys()]
    .filter((slug) => !prevBy.has(slug))
    .map((slug) => toMove(slug, currBy.get(slug), undefined))
    .sort((a, b) => b.publicUsd - a.publicUsd);

  const leftCompanies = [...prevBy.keys()]
    .filter((slug) => !currBy.has(slug))
    .map((slug) => toMove(slug, undefined, prevBy.get(slug)))
    .sort((a, b) => (b.previousPublicUsd ?? 0) - (a.previousPublicUsd ?? 0));

  const unchangedLeaders = [...currBy.values()]
    .filter((r) => r.rank != null && r.rank <= 10)
    .map((r) => {
      const before = prevBy.get(r.slug);
      if (!before || before.rank !== r.rank) return null;
      return toMove(r.slug, r, before);
    })
    .filter((x): x is MovementCompany => x != null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

  const deltaUsd = Math.round((curr.meta.publicUsdAll - prev.meta.publicUsdAll) * 100) / 100;
  const deltaCompanies = curr.meta.companies - prev.meta.companies;

  return {
    meta,
    from: {
      collectedAt: prev.meta.collectedAt,
      hash: prev.meta.hash,
      companies: prev.meta.companies,
      publicUsdAll: prev.meta.publicUsdAll,
    },
    to: {
      collectedAt: curr.meta.collectedAt,
      hash: curr.meta.hash,
      companies: curr.meta.companies,
      publicUsdAll: curr.meta.publicUsdAll,
    },
    summary: {
      deltaUsd,
      deltaCompanies,
      climbers: climbers.length,
      fallers: fallers.length,
      newTop200: newTop200.length,
      leftTop200: leftTop200.length,
      newCompanies: newCompanies.length,
      leftCompanies: leftCompanies.length,
      unchangedLeaders: unchangedLeaders.length,
    },
    climbers,
    fallers,
    newTop200,
    leftTop200,
    newCompanies,
    leftCompanies,
    unchangedLeaders,
    note:
      `Public dollars moved ${deltaUsd >= 0 ? "+" : ""}${deltaUsd} USD between ` +
      `${prev.meta.collectedAt} (hash ${prev.meta.hash.slice(0, 12)}) and ` +
      `${curr.meta.collectedAt} (hash ${curr.meta.hash.slice(0, 12)}). ` +
      `Companies ${prev.meta.companies} → ${curr.meta.companies}. ` +
      `Built from publishable dumps — not from weekly scraper JSON.`,
  };
}
