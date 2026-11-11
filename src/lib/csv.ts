/**
 * One CSV cell: quoted when needed, and neutralized against spreadsheet formula
 * injection (OWASP). A cell whose first visible character is = + - @ (or their
 * fullwidth forms ＝ ＋ － ＠), even after leading spaces, NBSP, ideographic space
 * or a BOM, or that starts with TAB / CR, is prefixed with a single quote so
 * Excel / Sheets / LibreOffice show it as text. Plain numbers such as -12.5
 * are left alone (they are data, not formulas).
 */
const FORMULA_START = /^[\t\r]|^[\s\u00a0\u2007\u202f\u3000\ufeff]*[=+\-@\uff1d\uff0b\uff0d\uff20]/;
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i;

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (!PLAIN_NUMBER.test(text) && FORMULA_START.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** UTF-8 byte order mark, so Excel opens the file as UTF-8. */
export const CSV_BOM = "\uFEFF";
