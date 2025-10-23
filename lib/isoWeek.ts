const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatIsoWeek(year: number, week: number): string {
  const normalizedWeek = Math.max(1, Math.min(53, Math.trunc(week)));
  return `${year}-W${String(normalizedWeek).padStart(2, "0")}`;
}

export function getIsoWeekParts(date: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((target.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
  return { year: target.getUTCFullYear(), week: weekNumber };
}

export function getIsoWeekString(date: Date): string {
  const { year, week } = getIsoWeekParts(date);
  return formatIsoWeek(year, week);
}

export function getIsoWeekStringFromDateString(date: string): string | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return getIsoWeekString(utcDate);
}

export function isoWeekToDate(year: number, week: number): Date {
  const safeWeek = Math.max(1, Math.min(53, Math.trunc(week)));
  const fourthJan = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = fourthJan.getUTCDay() || 7;
  const monday = new Date(fourthJan);
  monday.setUTCDate(fourthJan.getUTCDate() - (dayOfWeek - 1) + (safeWeek - 1) * 7);
  return monday;
}

export function getIsoWeekCalendarDates(year: number, week: number): string[] {
  const start = isoWeekToDate(year, week);
  return Array.from({ length: 7 }, (_, index) => formatIsoDate(addDays(start, index)));
}

export function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(date.getUTCDate() + days);
  return next;
}
