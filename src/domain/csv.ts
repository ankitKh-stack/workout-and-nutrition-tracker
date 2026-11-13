// CSV text for the export (SPEC.md 3.10). No imports, so it is unit-tested with plain Node.

/** Rows to CSV (RFC 4180): CRLF line ends; a field with , " or a line break is quoted, with " doubled. */
export function toCsv(rows: (string | number | null)[][]): string {
  const field = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(field).join(',')).join('\r\n');
}
