const IST = 'Asia/Kolkata';
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Asia/Kolkata calendar date as YYYY-MM-DD. */
export const istDate = (d: Date | number = new Date()): string => fmt.format(d);

export function addDays(ds: string, n: number): string {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(a) - t(b)) / 86400000);
}

export type RangeMode = 'daily' | 'weekly' | 'monthly';
export type DateRange = [string, string];

/** Inclusive date range for each exam mode, ending today (IST). */
export function rangeFor(mode: RangeMode, today: string): DateRange {
  if (mode === 'daily') return [today, today];
  if (mode === 'weekly') return [addDays(today, -6), today];
  return [today.slice(0, 8) + '01', today];
}

export const inRange = (d: string, [from, to]: DateRange): boolean => d >= from && d <= to;

export function prettyDate(ds: string, withYear = true): string {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
}

export function prettyTime(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
