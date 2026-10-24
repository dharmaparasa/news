import { prettyDate, prettyTime } from '../lib/dates';
import { DAILY_REQUEST_LIMIT } from '../types';
import { getKey } from '../lib/storage';
import { go, href } from './NewsCard';
import { useData } from './store';

export function Home() {
  const { editions, today, busy, refresh, online, usage, questions, ready } = useData();
  const ed = editions.find((e) => e.date === today);
  const last = editions[0];
  const hasKey = !!getKey();
  const left = Math.max(0, DAILY_REQUEST_LIMIT - usage.count);
  return (
    <section>
      <h2 className="page-h">{prettyDate(today)}</h2>
      {!ready ? (
        <p className="empty">Opening saved data…</p>
      ) : ed ? (
        <div className="card lead">
          <h3>Today’s edition is ready</h3>
          <p>{ed.itemCount} items and {questions.filter((q) => q.date === today).length} questions. Updated {prettyTime(ed.fetchedAt)}.</p>
          {ed.notes && <p className="muted small">{ed.notes}</p>}
          <div className="row">
            <button className="btn" onClick={() => go('/paper')}>Read the paper</button>
            <button className="btn ghost" onClick={() => go('/exam')}>Take an exam</button>
          </div>
        </div>
      ) : (
        <div className="card lead">
          <h3>No edition for today yet</h3>
          {last && <p className="muted">Your latest saved edition is from {prettyDate(last.date)}. It is kept for reading, but it is not today’s news.</p>}
          {!hasKey && <p>Add your own Google API key in Settings to build today’s edition.</p>}
          <div className="row">
            {hasKey ? (
              <button className="btn" disabled={busy || !online || left < 1} onClick={() => refresh(false)}>
                {busy ? 'Collecting…' : 'Build today’s edition'}
              </button>
            ) : (
              <button className="btn" onClick={() => go('/settings')}>Open Settings</button>
            )}
            {last && <button className="btn ghost" onClick={() => go('/paper')}>Read latest saved</button>}
          </div>
          {left < 1 && <p className="muted small">Both of today’s Google requests are used. The count resets at midnight IST.</p>}
        </div>
      )}
      <div className="tiles">
        <a className="tile" href={href('/news')}><strong>All News</strong><span>Every saved item, searchable</span></a>
        <a className="tile" href={href('/exam')}><strong>Exam</strong><span>Daily, weekly, monthly</span></a>
        <a className="tile" href={href('/categories')}><strong>Categories</strong><span>Jump to a topic</span></a>
        <a className="tile" href={href('/archive')}><strong>Archive</strong><span>{editions.length} saved editions</span></a>
        <a className="tile" href={href('/bookmarks')}><strong>Bookmarks</strong><span>Facts for revision</span></a>
        <a className="tile" href={href('/settings')}><strong>Settings</strong><span>{usage.count} of {DAILY_REQUEST_LIMIT} requests used today</span></a>
      </div>
      {ed?.searchEntryPoint && (
        <details className="gsug">
          <summary>Google Search suggestions for this edition</summary>
          <iframe title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={ed.searchEntryPoint} />
        </details>
      )}
    </section>
  );
}
