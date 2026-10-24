import { addDays } from './dates';
import { norm } from './validate';
import type { NewsItem } from '../types';

export type RangeKey = 'today' | '7' | '30' | 'all';

export interface Filters {
  range: RangeKey;
  date: string; // exact date or ''
  category: string;
  state: string;
  query: string;
}

/** Pure, local filtering and newest-first sorting. Never touches the network. */
export function filterNews(all: NewsItem[], f: Filters, today: string): NewsItem[] {
  const from = f.range === 'today' ? today : f.range === '7' ? addDays(today, -6) : f.range === '30' ? addDays(today, -29) : '0000-00-00';
  const q = norm(f.query);
  return all
    .filter((n) => n.date >= from && n.date <= today)
    .filter((n) => !f.date || n.date === f.date)
    .filter((n) => !f.category || n.category === f.category)
    .filter((n) => !f.state || n.state === f.state)
    .filter((n) => !q || norm([n.headline, ...n.bullets, ...n.examFacts, n.state ?? '', n.category].join(' ')).includes(q))
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}
