import { Fragment, useEffect, useState, type ReactNode } from 'react';
import type { NewsItem } from '../types';
import { hostOf } from '../lib/validate';
import { prettyDate } from '../lib/dates';
import { useData } from './store';

/* ---------- tiny hash router ---------- */
export interface Loc {
  path: string;
  q: URLSearchParams;
}
const parse = (): Loc => {
  const h = location.hash.replace(/^#/, '') || '/home';
  const [path, qs = ''] = h.split('?');
  return { path, q: new URLSearchParams(qs) };
};
export function useLoc(): Loc {
  const [loc, setLoc] = useState(parse());
  useEffect(() => {
    const f = () => setLoc(parse());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return loc;
}
export const go = (to: string) => {
  location.hash = to;
};
export const href = (to: string) => '#' + to;

/* ---------- highlight exam facts like a student's marker pen ---------- */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function Highlight({ text, facts }: { text: string; facts: string[] }): ReactNode {
  const uniq = [...new Set(facts.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!uniq.length) return text;
  const re = new RegExp(`(${uniq.map(esc).join('|')})`, 'gi');
  const lower = new Set(uniq.map((f) => f.toLowerCase()));
  return text.split(re).map((part, i) =>
    lower.has(part.toLowerCase()) ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>,
  );
}

const LABEL = {
  corroborated: 'Official and independent sources agree',
  'official-only': 'Official source only, no independent corroboration found',
  'single-source': 'Single independent source',
} as const;

export function Lesson({ item }: { item: NewsItem }) {
  const e = item.english;
  if (!e) return null;
  return (
    <div className="lesson">
      <h4>English for exams</h4>
      {e.words.map((w) => (
        <p key={w.word}>
          <b>{w.word}</b>: {w.meaning}
          <br />
          <span className="muted">
            Synonyms: {w.synonyms.join(', ')}
            {w.antonyms.length ? `. Antonyms: ${w.antonyms.join(', ')}` : ''}
          </span>
        </p>
      ))}
      {e.grammar && (
        <p>
          <b>Grammar: {e.grammar.concept}.</b> {e.grammar.explanation}
        </p>
      )}
      {e.expressions.map((x) => (
        <p key={x.phrase}>
          <b>“{x.phrase}”</b>: {x.meaning}
        </p>
      ))}
    </div>
  );
}

export function NewsCard({ item, showDate = false, today }: { item: NewsItem; showDate?: boolean; today?: string }) {
  const { bookmarks, toggleBookmark } = useData();
  const saved = bookmarks.has(item.id);
  const old = today !== undefined && item.date !== today;
  return (
    <article className={'card' + (old ? ' old' : '')}>
      <div className="card-top">
        <span className="tag">{item.state ? `${item.category}: ${item.state}` : item.category}</span>
        {showDate && <span className="muted small">{old ? `Archive, ${prettyDate(item.date, false)}` : 'Today'}</span>}
        <button
          className={'bm' + (saved ? ' on' : '')}
          aria-pressed={saved}
          aria-label={saved ? 'Remove bookmark' : 'Bookmark this fact'}
          onClick={() => toggleBookmark(item.id)}
        >
          {saved ? '★' : '☆'}
        </button>
      </div>
      <h3>{item.headline}</h3>
      <ul>
        {item.bullets.map((b, i) => (
          <li key={i}>
            <Highlight text={b} facts={item.examFacts} />
          </li>
        ))}
      </ul>
      <details>
        <summary>Exam facts{item.english ? ' and English' : ''}</summary>
        {item.examFacts.length > 0 && (
          <ul className="facts">
            {item.examFacts.map((f) => (
              <li key={f}>
                <mark>{f}</mark>
              </li>
            ))}
          </ul>
        )}
        <Lesson item={item} />
      </details>
      <div className="src">
        <span className={'badge ' + item.corroboration}>{LABEL[item.corroboration]}</span>
        {item.verification === 'single-pass' && <span className="badge plain">Not fact-checked a second time</span>}
        <div className="links">
          {item.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={s.official ? 'official' : ''}>
              {s.official ? 'Official: ' : ''}
              {s.title || hostOf(s.url)}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}
