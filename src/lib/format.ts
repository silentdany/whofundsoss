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

export function platformShort(plateformes: string): string {
  if (!plateformes) return "—";
  return plateformes
    .split("|")
    .map((p) => {
      const t = p.trim();
      if (/github/i.test(t)) return "GH";
      if (/open collective/i.test(t)) return "OC";
      if (/pledge/i.test(t)) return "Pledge";
      return t;
    })
    .filter(Boolean)
    .join(" · ");
}
