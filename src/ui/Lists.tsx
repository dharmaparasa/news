import { CATEGORIES } from '../types';
import { prettyDate, prettyTime } from '../lib/dates';
import { href, NewsCard } from './NewsCard';
import { useData } from './store';

export function Categories() {
  const { news, today, editions } = useData();
  const date = editions.some((e) => e.date === today) ? today : editions[0]?.date;
  const list = news.filter((n) => n.date === date);
  const rows = CATEGORIES.map((c) => ({ c, n: list.filter((i) => i.category === c).length })).filter((r) => r.n > 0);
  return (
    <section>
      <h2 className="page-h">Categories</h2>
      {date && <p className="muted">{date === today ? 'Today’s edition' : `Latest saved edition, ${prettyDate(date)}`}</p>}
      {rows.length === 0 && <p className="empty">No saved news yet. Categories appear once an edition has verified items.</p>}
      {rows.map(({ c, n }) => (
        <a key={c} className="card row-link" href={href(`/paper?d=${date}&c=${encodeURIComponent(c)}`)}>
          <strong>{c}</strong>
          <span>{n} item{n === 1 ? '' : 's'}</span>
        </a>
      ))}
    </section>
  );
}

export function Bookmarks() {
  const { news, bookmarks, today } = useData();
  const list = news.filter((n) => bookmarks.has(n.id));
  return (
    <section>
      <h2 className="page-h">Bookmarks</h2>
      {list.length === 0 && <p className="empty">Tap the star on any news item to keep it here for revision.</p>}
      {list.map((n) => <NewsCard key={n.id} item={n} showDate today={today} />)}
    </section>
  );
}

export function Archive() {
  const { editions, today } = useData();
  return (
    <section>
      <h2 className="page-h">Archive</h2>
      {editions.length === 0 && <p className="empty">Saved editions will be listed here by date.</p>}
      {editions.map((e) => (
        <div className="card" key={e.date}>
          <h3>{prettyDate(e.date)}{e.date === today && ' (today)'}</h3>
          <p className="muted small">
            {e.itemCount} items, {e.questionCount} questions. Saved {prettyTime(e.fetchedAt)}.
            {e.verified ? ' Fact-checked.' : ' Single pass.'}
          </p>
          <div className="row">
            <a className="btn" href={href(`/paper?d=${e.date}`)}>Read paper</a>
            <a className="btn ghost" href={href(`/news?d=${e.date}`)}>List view</a>
          </div>
        </div>
      ))}
    </section>
  );
}
