/**
 * One CSV cell: quoted, with quotes doubled, and with a leading = + - @ (or tab / carriage
 * return) in text neutralised by a leading apostrophe, so a label such as "=HYPERLINK(...)" that came from
 * a customer, a bank statement or an email opens as text in Excel instead of running as a formula.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Numbers are left alone so a negative amount stays a number.
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
