import type { Attempt, Edition, NewsItem, Question } from '../types';

const NAME = 'exam-current-affairs';
const VERSION = 1;

export interface Bookmark {
  newsId: string;
  at: number;
}

interface Stores {
  editions: Edition;
  news: NewsItem;
  questions: Question;
  bookmarks: Bookmark;
  attempts: Attempt;
}
export type StoreName = keyof Stores;
const KEYS: Record<StoreName, string> = {
  editions: 'date',
  news: 'id',
  questions: 'id',
  bookmarks: 'newsId',
  attempts: 'id',
};
export const STORE_NAMES = Object.keys(KEYS) as StoreName[];

let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORE_NAMES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: KEYS[s] });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
    });
  }
  return dbp;
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const r = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve((r ? (r as IDBRequest).result : undefined) as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const dbGetAll = <S extends StoreName>(s: S) => run<Stores[S][]>(s, 'readonly', (o) => o.getAll());
export const dbPut = <S extends StoreName>(s: S, v: Stores[S]) => run<void>(s, 'readwrite', (o) => void o.put(v));
export const dbPutMany = <S extends StoreName>(s: S, vs: Stores[S][]) =>
  run<void>(s, 'readwrite', (o) => {
    vs.forEach((v) => o.put(v));
  });
export const dbDelete = (s: StoreName, key: string) => run<void>(s, 'readwrite', (o) => void o.delete(key));
export const dbClear = (s: StoreName) => run<void>(s, 'readwrite', (o) => void o.clear());
