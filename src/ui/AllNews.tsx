import { useMemo, useState } from 'react';
import { filterNews, type Filters, type RangeKey } from '../lib/filter';
import { prettyDate } from '../lib/dates';
import { CATEGORIES } from '../types';
import { NewsCard, type Loc } from './NewsCard';
import { useData } from './store';

const RANGES: [RangeKey, string][] = [['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All saved']];

export function AllNews({ loc }: { loc: Loc }) {
  const { news, today, prefs } = useData();
  const [f, setF] = useState<Filters>({
    range: loc.q.get('d') ? 'all' : 'all',
    date: loc.q.get('d') ?? '',
    category: loc.q.get('c') ?? '',
    state: '',
    query: '',
  });
  const [limit, setLimit] = useState(40);
  const states = useMemo(() => [...new Set(news.map((n) => n.state).filter((s): s is string => !!s))].sort(), [news]);
  const list = useMemo(() => filterNews(news, f, today), [news, f, today]);
  const set = (p: Partial<Filters>) => {
    setF({ ...f, ...p });
    setLimit(40);
  };
  const shown = list.slice(0, limit);
  let last = '';

  return (
    <section>
      <h2 className="page-h">All News</h2>
      <div className="seg" role="group" aria-label="Date range">
        {RANGES.map(([k, l]) => (
          <button key={k} className={f.range === k && !f.date ? 'on' : ''} onClick={() => set({ range: k, date: '' })}>{l}</button>
        ))}
      </div>
      <div className="filters">
        <input type="search" placeholder="Search saved news" aria-label="Search saved news" value={f.query} onChange={(e) => set({ query: e.target.value })} />
        <input type="date" aria-label="Show one date" value={f.date} max={today} onChange={(e) => set({ date: e.target.value })} />
        <select aria-label="Category" value={f.category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="State" value={f.state} onChange={(e) => set({ state: e.target.value })}>
          <option value="">All states</option>
          {prefs.state && !states.includes(prefs.state) && <option>{prefs.state}</option>}
          {states.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <p className="muted small" aria-live="polite">{list.length} item{list.length === 1 ? '' : 's'} from saved data, newest first. Searching never uses Google.</p>
      {list.length === 0 && <p className="empty">No saved news matches these filters.</p>}
      {shown.map((n) => {
        const head = n.date !== last;
        last = n.date;
        return (
          <div key={n.id}>
            {head && <h3 className={'day' + (n.date === today ? ' today' : '')}>{n.date === today ? 'Today, ' : ''}{prettyDate(n.date)}</h3>}
            <NewsCard item={n} showDate today={today} />
          </div>
        );
      })}
      {list.length > limit && <button className="btn" onClick={() => setLimit(limit + 40)}>Show more</button>}
    </section>
  );
}
