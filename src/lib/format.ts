const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function money(value: number): string {
  const sign = value < 0 ? "−" : "";
  const v = Math.abs(value);
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    const s = m.toFixed(1);
    return `${sign}$${s.endsWith(".0") ? s.slice(0, -2) : s}M`;
  }
  if (v >= 1000) {
    const k = v / 1000;
    const s = k.toFixed(1);
    return `${sign}$${s.endsWith(".0") ? s.slice(0, -2) : s}k`;
  }
  return `${sign}$${Math.round(v).toLocaleString("en-US")}`;
}

/**
 * A company's public total. Every listed company funds something, so zero means
 * the amounts exist but are not published (e.g. private GitHub tiers), never "gives nothing".
 */
export function publicTotal(value: number): string {
  return value > 0 ? money(value) : "Not public";
}

export function collectedLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function scoreLabel(score: number): string {
  return score.toFixed(2);
}

export function hashShort(hash: string): string {
  return hash.slice(0, 12);
}

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-10-05" → "October 2026". */
export function monthYear(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return `${MONTHS_LONG[m - 1]} ${y}`;
}
