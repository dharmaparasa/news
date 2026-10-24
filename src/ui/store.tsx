import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Attempt, Edition, NewsItem, Prefs, Question, Usage } from '../types';
import { istDate } from '../lib/dates';
import { dbDelete, dbGetAll, dbPut, type Bookmark } from '../lib/db';
import { getKey, getUsage, loadPrefs, savePrefs } from '../lib/storage';
import { refreshEdition } from '../lib/pipeline';
import type { Run } from '../lib/exam';

export interface Notice {
  kind: 'ok' | 'err' | 'info';
  text: string;
}

interface Ctx {
  ready: boolean;
  today: string;
  online: boolean;
  news: NewsItem[];
  questions: Question[];
  editions: Edition[];
  attempts: Attempt[];
  bookmarks: Set<string>;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  usage: Usage;
  busy: boolean;
  notice: Notice | null;
  setNotice: (n: Notice | null) => void;
  reload: () => Promise<void>;
  refresh: (manual: boolean) => Promise<void>;
  toggleBookmark: (id: string) => void;
  run: Run | null;
  setRun: (r: Run | null) => void;
}

const C = createContext<Ctx | null>(null);
export const useData = (): Ctx => {
  const c = useContext(C);
  if (!c) throw new Error('store missing');
  return c;
};

export function Provider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(istDate());
  const [online, setOnline] = useState(navigator.onLine);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs());
  const [usage, setUsage] = useState<Usage>(getUsage());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const autoTried = useRef(false);

  const reload = useCallback(async () => {
    try {
      const [n, q, e, a, b] = await Promise.all([
        dbGetAll('news'),
        dbGetAll('questions'),
        dbGetAll('editions'),
        dbGetAll('attempts'),
        dbGetAll('bookmarks'),
      ]);
      setNews(n.sort((x, y) => (x.date === y.date ? y.createdAt - x.createdAt : x.date < y.date ? 1 : -1)));
      setQuestions(q);
      setEditions(e.sort((x, y) => (x.date < y.date ? 1 : -1)));
      setAttempts(a.sort((x, y) => y.submittedAt - x.submittedAt));
      setBookmarks(new Set(b.map((x) => x.newsId)));
    } catch {
      setNotice({ kind: 'err', text: 'Saved data could not be opened. Private browsing may block local storage.' });
    }
    setUsage(getUsage());
    setToday(istDate());
  }, []);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((old) => {
      const next = { ...old, ...p };
      savePrefs(next);
      return next;
    });
  }, []);

  const refresh = useCallback(
    async (manual: boolean) => {
      if (busy) return;
      setBusy(true);
      setNotice({ kind: 'info', text: 'Collecting today’s news. This can take up to a minute.' });
      try {
        const r = await refreshEdition(prefs, manual);
        setNotice({ kind: r.status === 'saved' ? 'ok' : 'info', text: r.message });
      } catch (e) {
        setNotice({ kind: 'err', text: (e as Error).message });
      } finally {
        await reload();
        setBusy(false);
      }
    },
    [busy, prefs, reload],
  );

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks((old) => {
      const next = new Set(old);
      if (next.has(id)) {
        next.delete(id);
        void dbDelete('bookmarks', id);
      } else {
        next.add(id);
        const b: Bookmark = { newsId: id, at: Date.now() };
        void dbPut('bookmarks', b);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void reload().then(() => setReady(true));
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const vis = () => document.visibilityState === 'visible' && setToday(istDate());
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [reload]);

  // First open of a new IST day: fetch once. Never loops; a failed attempt must be retried by hand.
  useEffect(() => {
    if (!ready || autoTried.current) return;
    autoTried.current = true;
    const hasToday = editions.some((e) => e.date === today);
    if (!hasToday && getKey() && getUsage(today).count === 0 && navigator.onLine) void refresh(false);
  }, [ready, editions, today, refresh]);

  // Appearance
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.font = prefs.fontSize;
    const dark = prefs.theme === 'dark' || (prefs.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    el.dataset.theme = dark ? 'dark' : 'light';
  }, [prefs.fontSize, prefs.theme]);

  const value = useMemo<Ctx>(
    () => ({
      ready, today, online, news, questions, editions, attempts, bookmarks, prefs, setPrefs, usage, busy, notice, setNotice,
      reload, refresh, toggleBookmark, run, setRun,
    }),
    [ready, today, online, news, questions, editions, attempts, bookmarks, prefs, setPrefs, usage, busy, notice, reload, refresh, toggleBookmark, run],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}
