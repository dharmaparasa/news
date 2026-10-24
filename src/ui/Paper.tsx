import { useMemo, useRef, useState } from 'react';
import { paginate } from '../lib/paginate';
import { prettyDate } from '../lib/dates';
import { CATEGORIES } from '../types';
import { go, NewsCard, type Loc } from './NewsCard';
import { useData } from './store';

export function Paper({ loc }: { loc: Loc }) {
  const { news, editions, today, ready } = useData();
  const wanted = loc.q.get('d');
  const date = wanted ?? (editions.some((e) => e.date === today) ? today : editions[0]?.date);
  const pages = useMemo(() => paginate(news.filter((n) => n.date === date)), [news, date]);
  const cat = loc.q.get('c');
  const startAt = cat ? Math.max(0, pages.findIndex((p) => p.category === cat)) : Number(loc.q.get('p') ?? 0);
  const [page, setPage] = useState(Math.min(startAt, Math.max(0, pages.length - 1)));
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const touch = useRef<{ x: number; y: number } | null>(null);
  const body = useRef<HTMLDivElement>(null);

  if (!ready) return <p className="empty">Opening your saved edition…</p>;
  if (!date || pages.length === 0)
    return (
      <div className="empty">
        <h2>No edition to read yet</h2>
        <p>Add your Google API key in Settings and refresh to build today’s paper. Saved editions stay available offline.</p>
        <button className="btn" onClick={() => go('/settings')}>Open Settings</button>
      </div>
    );

  const cur = Math.min(page, pages.length - 1);
  const p = pages[cur];
  const turn = (d: 1 | -1) => {
    const n = cur + d;
    if (n < 0 || n >= pages.length) return;
    setDir(d === 1 ? 'next' : 'prev');
    setPage(n);
    body.current?.scrollTo({ top: 0 });
  };
  const fresh = date === today;

  return (
    <section
      className="paper"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
      }}
    >
      <header className="masthead">
        <div>
          <h2>{prettyDate(date)}</h2>
          <span className={'badge ' + (fresh ? 'corroborated' : 'plain')}>{fresh ? 'Today’s edition' : 'Older edition, not today’s'}</span>
        </div>
        <label className="jump">
          <span className="sr">Jump to topic</span>
          <select
            value={p.category}
            onChange={(e) => {
              const i = pages.findIndex((x) => x.category === e.target.value);
              if (i >= 0) {
                setDir(i > cur ? 'next' : 'prev');
                setPage(i);
              }
            }}
          >
            {CATEGORIES.filter((c) => pages.some((x) => x.category === c)).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </header>
      <div className={'sheet turn-' + dir} key={cur} ref={body}>
        <h2 className="page-title">
          {p.category}
          {p.parts > 1 && <span className="muted small"> (part {p.part} of {p.parts})</span>}
        </h2>
        {p.items.map((it) => (
          <NewsCard key={it.id} item={it} />
        ))}
      </div>
      <nav className="pager" aria-label="Newspaper pages">
        <button className="btn ghost" disabled={cur === 0} onClick={() => turn(-1)}>Previous</button>
        <span aria-live="polite">Page {cur + 1} of {pages.length}</span>
        <button className="btn ghost" disabled={cur === pages.length - 1} onClick={() => turn(1)}>Next</button>
      </nav>
    </section>
  );
}
