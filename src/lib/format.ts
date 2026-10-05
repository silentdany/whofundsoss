export function formatUsd(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `$${Math.round(value)}`;
}

/** Map research FR platform tokens to EN UI labels (array). */
export function platformTokens(plateformes: string): string[] {
  if (!plateformes) return [];
  return plateformes
    .split("|")
    .map((p) => {
      const t = p.trim();
      if (!t) return "";
      if (/github/i.test(t)) return "GH";
      if (/open collective/i.test(t)) return "OC";
      if (/pledge/i.test(t)) return "Pledge";
      if (/programme\s+propre/i.test(t) || /^propre$/i.test(t)) {
        return "Own program";
      }
      return t;
    })
    .filter(Boolean);
}

/** Map research FR platform tokens to EN UI labels. */
export function platformShort(plateformes: string): string {
  const tokens = platformTokens(plateformes);
  return tokens.length ? tokens.join(" · ") : "—";
}

/** Translate FR sector labels from research dumps. */
export function secteurLabel(secteur: string | null | undefined): string {
  if (!secteur) return "";
  const t = secteur.trim();
  if (/^découvert$/i.test(t)) return "Unclassified";
  return t;
}

/**
 * Translate FR project labels from research dumps.
 * e.g. "(agrégé OSS — 160 devs × $4688/dev, rapport 2025)"
 *   → "(OSS aggregate — 160 devs × $4688/dev, 2025 report)"
 */
export function projectLabel(name: string | null | undefined): string {
  if (!name) return "—";
  const trimmed = name.trim();
  const pledge = trimmed.replace(
    /\(agrégé OSS\s*[—–-]\s*(.+?),\s*rapport\s+(\d{4})\)/gi,
    (_m, body: string, year: string) =>
      `(OSS aggregate — ${body}, ${year} report)`
  );
  if (pledge !== trimmed) return pledge;
  return trimmed
    .replace(/\bagrégé\b/gi, "aggregate")
    .replace(/\brapport\b/gi, "report");
}
