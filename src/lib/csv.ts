/**
 * One CSV cell: quoted when needed, and neutralized against spreadsheet formula
 * injection (OWASP): a cell starting with = + - @ TAB or CR is prefixed with
 * a single quote so Excel / Sheets / LibreOffice show it as text.
 */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** UTF-8 byte order mark, so Excel opens the file as UTF-8. */
export const CSV_BOM = "\uFEFF";
