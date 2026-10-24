import { DAILY_REQUEST_LIMIT, DEFAULT_MODEL, KEY_CHECK_LIMIT, type Prefs, type Usage } from '../types';
import { istDate } from './dates';

const PREFS = 'ca.prefs';
const KEY = 'ca.apiKey';
const USAGE = 'ca.usage';

export const DEFAULT_PREFS: Prefs = {
  fontSize: 'md',
  theme: 'light',
  state: '',
  model: DEFAULT_MODEL,
  autoVerify: true,
};

function read<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked */
  }
}

export const loadPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...(read<Partial<Prefs>>(PREFS) ?? {}) });
export const savePrefs = (p: Prefs) => write(PREFS, p);

/* ---- API key: sessionStorage by default, localStorage only if "remember" is ticked ---- */

export function getKey(): string {
  try {
    return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}
export const isKeyRemembered = (): boolean => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
};
export function setKey(key: string, remember: boolean) {
  removeKey();
  const k = key.trim();
  if (!k) return;
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY, k);
  } catch {
    /* ignore */
  }
}
export function removeKey() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ---- Daily request budget (Asia/Kolkata calendar day) ---- */

export function getUsage(today = istDate()): Usage {
  const u = read<Usage>(USAGE);
  if (u && u.date === today) return { ...u, keyChecks: u.keyChecks ?? 0 };
  return { date: today, count: 0, log: [], keyChecks: 0 };
}
export const remaining = (u: Usage): number => Math.max(0, DAILY_REQUEST_LIMIT - u.count);

/** Reserve one of the day's requests BEFORE calling the API, so failed attempts count too. */
export function reserve(kind: 'generate' | 'verify', today = istDate()): Usage | null {
  const u = getUsage(today);
  if (u.count >= DAILY_REQUEST_LIMIT) return null;
  u.count += 1;
  u.log.push({ at: Date.now(), kind, ok: false });
  write(USAGE, u);
  return u;
}
export function markResult(ok: boolean, note?: string, today = istDate()) {
  const u = getUsage(today);
  const last = u.log[u.log.length - 1];
  if (last) {
    last.ok = ok;
    if (note) last.note = note.slice(0, 160);
  }
  write(USAGE, u);
}

/** Key tests read model metadata only (no generation) and are capped separately. */
export function reserveKeyCheck(today = istDate()): boolean {
  const u = getUsage(today);
  if (u.keyChecks >= KEY_CHECK_LIMIT) return false;
  u.keyChecks += 1;
  write(USAGE, u);
  return true;
}

export const LAST_OK = 'ca.lastOk';
export const getLastOk = (): number | null => read<number>(LAST_OK);
export const setLastOk = (t: number) => write(LAST_OK, t);
