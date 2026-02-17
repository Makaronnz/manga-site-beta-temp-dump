// Deterministic utilities for dates/times used in SSR + Client.

export function formatUTC(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss} UTC`;
}

/**
 * Returns relative time like "3 min ago" or "in 2 hours".
 * Kept deterministic if you pass `now`. On client we usually call without `now`.
 */
export function timeAgo(iso?: string | null, _locale: string = "en", now?: Date): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const ref = now ?? new Date();
  const diffMs = d.getTime() - ref.getTime(); // future => positive
  const abs = Math.abs(diffMs);

  const sec = Math.round(abs / 1000);
  const min = Math.round(sec / 60);
  const hour = Math.round(min / 60);
  const day = Math.round(hour / 24);
  const week = Math.round(day / 7);
  const month = Math.round(day / 30);
  const year = Math.round(day / 365);

  const fmt = (n: number, u: string) => (diffMs <= 0 ? `${n} ${u} ago` : `in ${n} ${u}`);

  if (sec < 45) return fmt(sec || 1, "sec");
  if (min < 45) return fmt(min || 1, "min");
  if (hour < 36) return fmt(hour || 1, "hour");
  if (day < 14) return fmt(day || 1, "day");
  if (week < 8) return fmt(week || 1, "week");
  if (month < 18) return fmt(month || 1, "month");
  return fmt(year || 1, "year");
}
