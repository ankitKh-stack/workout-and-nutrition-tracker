// Date, number and input helpers. Written by hand rather than with Intl so the
// output is identical on Android, iOS and web.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses YYYY-MM-DD as a local date (not UTC). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const monthShort = (monthIndex: number) => MONTHS[monthIndex];

/** "28 Oct 2026" */
export function formatDateLong(s: string): string {
  const d = parseLocalDate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "28 Oct" */
export function formatDateShort(s: string): string {
  const d = parseLocalDate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "18:05" from an ISO timestamp, in local time. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 1860 -> "1,860"; keeps up to 2 decimals. */
export function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [whole, frac] = String(Math.abs(rounded)).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${rounded < 0 ? '−' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/** A stored weight for display; empty shows as "—". */
export function formatWeight(w: number | null): string {
  return w === null ? '—' : formatNumber(w);
}

/** "+18%" / "−12%" from an unrounded percentage. */
export function formatPercent(p: number): string {
  const r = Math.round(p);
  return r < 0 ? `−${Math.abs(r)}%` : `+${r}%`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export type ParseResult = { ok: true; value: number | null } | { ok: false; message: string };

/** Reps: whole number 0–999, or empty. */
export function parseReps(text: string): ParseResult {
  const t = text.trim();
  if (t === '') return { ok: true, value: null };
  if (!/^\d{1,3}$/.test(t)) return { ok: false, message: 'Enter a whole number from 0 to 999' };
  return { ok: true, value: Number(t) };
}

/** Weight: 0–9999 with at most 2 decimals, or empty. A comma decimal separator is accepted. */
export function parseWeight(text: string): ParseResult {
  const t = text.trim().replace(',', '.');
  if (t === '') return { ok: true, value: null };
  if (!/^\d{1,4}(\.\d{0,2})?$/.test(t)) return { ok: false, message: 'Enter a number from 0 to 9999' };
  return { ok: true, value: Number(t) };
}
