import {
  CATEGORIES,
  type Category,
  type Corroboration,
  type EnglishLesson,
  type NewsItem,
  type Question,
  type Source,
} from '../types';

/* ---------- text helpers ---------- */

const STOP = new Set(
  'the a an of in on at to for and or by with from as is are was were be been its it this that these those has have had will into over after before about under their his her new says said govt government india indian union state'.split(
    ' ',
  ),
);

/** Lower-case, drop thousands separators and punctuation, keep decimals. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/[^\p{L}\p{N}.\s]/gu, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(s: string): Set<string> {
  return new Set(
    norm(s)
      .split(' ')
      .filter((t) => (t.length > 2 || /\d/.test(t)) && !STOP.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export const itemText = (i: Pick<NewsItem, 'headline' | 'bullets' | 'examFacts'>): string =>
  [i.headline, ...i.bullets, ...i.examFacts].join(' ');

/* ---------- sources ---------- */

export function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

const OFFICIAL_EXACT = new Set([
  'rbi.org.in',
  'pib.gov.in',
  'india.gov.in',
  'un.org',
  'unesco.org',
  'who.int',
  'imf.org',
  'worldbank.org',
  'ramsar.org',
  'unep.org',
]);

export function isOfficialHost(host: string): boolean {
  if (host.endsWith('.gov.in') || host.endsWith('.nic.in') || host === 'gov.in' || host === 'nic.in') return true;
  for (const h of OFFICIAL_EXACT) if (host === h || host.endsWith('.' + h)) return true;
  return false;
}

export interface Grounding {
  /** hostnames the Google Search tool actually returned */
  domains: Set<string>;
  chunkCount: number;
}

export function isGroundedHost(host: string, g: Grounding): boolean {
  if (g.domains.size === 0) return g.chunkCount > 0; // domains not exposed: rely on non-empty grounding
  for (const d of g.domains) {
    if (host === d || host.endsWith('.' + d) || d.endsWith('.' + host)) return true;
  }
  return false;
}

export function cleanSources(raw: unknown, g: Grounding): Source[] {
  if (!Array.isArray(raw)) return [];
  const out: Source[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const url = typeof r?.url === 'string' ? r.url.trim() : '';
    const host = hostOf(url);
    if (!host || seen.has(url) || !isGroundedHost(host, g)) continue;
    seen.add(url);
    const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 90) : host;
    out.push({ url, title, official: isOfficialHost(host) });
    if (out.length === 4) break;
  }
  return out;
}

export function corroborationOf(sources: Source[]): Corroboration {
  const hosts = new Set(sources.map((s) => hostOf(s.url)));
  const official = sources.some((s) => s.official);
  const media = sources.some((s) => !s.official);
  if (official && media) return 'corroborated';
  if (!official && hosts.size >= 2) return 'corroborated';
  if (official) return 'official-only';
  return 'single-source';
}

/* ---------- lessons & questions ---------- */

const strs = (v: unknown, max: number, maxLen = 60): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim().slice(0, maxLen))
        .slice(0, max)
    : [];

export function cleanLesson(raw: any, text: string): EnglishLesson | null {
  if (!raw || typeof raw !== 'object') return null;
  const nt = norm(text);
  const words = (Array.isArray(raw.words) ? raw.words : [])
    .map((w: any) => ({
      word: typeof w?.word === 'string' ? w.word.trim() : '',
      meaning: typeof w?.meaning === 'string' ? w.meaning.trim().slice(0, 160) : '',
      synonyms: strs(w?.synonyms, 4, 30),
      antonyms: strs(w?.antonyms, 3, 30),
    }))
    .filter((w: any) => {
      if (w.word.length < 3 || !w.meaning || w.synonyms.length === 0) return false;
      const stem = norm(w.word).slice(0, Math.max(4, norm(w.word).length - 3));
      return nt.includes(stem); // the word must come from the actual news statement
    })
    .slice(0, 2);
  const expressions = (Array.isArray(raw.expressions) ? raw.expressions : [])
    .map((e: any) => ({
      phrase: typeof e?.phrase === 'string' ? e.phrase.trim() : '',
      meaning: typeof e?.meaning === 'string' ? e.meaning.trim().slice(0, 160) : '',
    }))
    .filter((e: any) => e.phrase && e.meaning && nt.includes(norm(e.phrase)))
    .slice(0, 2);
  const g = raw.grammar;
  const grammar =
    g && typeof g.concept === 'string' && typeof g.explanation === 'string' && g.concept && g.explanation
      ? { concept: g.concept.trim().slice(0, 80), explanation: g.explanation.trim().slice(0, 300) }
      : undefined;
  if (!words.length && !expressions.length && !grammar) return null;
  return { words, expressions, ...(grammar ? { grammar } : {}) };
}

/** Is the correct answer actually stated in the news item? */
export function answerSupported(item: Pick<NewsItem, 'headline' | 'bullets' | 'examFacts'>, answer: string): boolean {
  const text = norm(itemText(item));
  const a = norm(answer);
  if (!a) return false;
  if (text.includes(a)) return true;
  const toks = a.split(' ').filter((t) => t.length > 2 || /\d/.test(t));
  if (!toks.length) return false;
  return toks.every((t) => text.includes(t));
}

export function cleanQuestion(raw: any, item: NewsItem, idx: number): Question | null {
  if (!raw || typeof raw.q !== 'string') return null;
  const q = raw.q.trim();
  const options = Array.isArray(raw.options) ? raw.options.map((o: unknown) => (typeof o === 'string' ? o.trim() : '')) : [];
  const ai = raw.answerIndex;
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  if (q.length < 15 || q.length > 300) return null;
  if (options.length !== 4 || options.some((o: string) => !o || o.length > 120)) return null;
  if (new Set(options.map((o: string) => norm(o))).size !== 4) return null;
  if (!Number.isInteger(ai) || ai < 0 || ai > 3) return null;
  if (explanation.length < 10 || explanation.length > 400) return null;
  const answer = options[ai];
  if (!answerSupported(item, answer)) return null;
  const na = norm(answer);
  if (na.length > 3 && norm(q).includes(na)) return null; // question gives the answer away
  return {
    id: `${item.id}-q${idx}`,
    newsId: item.id,
    date: item.date,
    category: item.category,
    q,
    options,
    answerIndex: ai,
    explanation,
    sourceUrl: item.sources[0].url,
  };
}

/* ---------- items ---------- */

export function fingerprintOf(headline: string, facts: string[]): string {
  return [...tokens(headline + ' ' + facts.join(' '))].sort().join(' ');
}

const SAME_STORY = 0.6;
export function isDuplicate(fp: string, others: { fingerprint: string }[]): boolean {
  const t = new Set(fp.split(' ').filter(Boolean));
  return others.some((o) => jaccard(t, new Set(o.fingerprint.split(' ').filter(Boolean))) >= SAME_STORY);
}

export interface SanitizeResult {
  items: NewsItem[];
  questions: Question[];
  rejected: { ref: string; reason: string }[];
  refMap: Record<string, string>; // model ref -> item id
}

export function sanitize(
  raw: any,
  date: string,
  g: Grounding,
  existing: { fingerprint: string }[],
  now = Date.now(),
): SanitizeResult {
  const out: SanitizeResult = { items: [], questions: [], rejected: [], refMap: {} };
  const list: any[] = Array.isArray(raw?.items) ? raw.items : [];
  const pool: { fingerprint: string }[] = [...existing];
  list.forEach((r, i) => {
    const ref = typeof r?.ref === 'string' ? r.ref : `n${i + 1}`;
    const reject = (reason: string) => out.rejected.push({ ref, reason });
    const category = CATEGORIES.find((c) => c.toLowerCase() === String(r?.category).toLowerCase()) as Category | undefined;
    if (!category) return reject('unknown category');
    const headline = typeof r.headline === 'string' ? r.headline.trim() : '';
    if (headline.length < 10 || headline.length > 220) return reject('bad headline');
    const bullets = strs(r.bullets, 5, 400).filter((b) => b.length >= 8);
    if (!bullets.length) return reject('no bullets');
    const sources = cleanSources(r.sources, g);
    if (!sources.length) return reject('no grounded source');
    const joined = norm([headline, ...bullets].join(' '));
    const examFacts = strs(r.examFacts, 6, 80).filter((f) => joined.includes(norm(f)));
    const fingerprint = fingerprintOf(headline, examFacts);
    if (isDuplicate(fingerprint, pool)) return reject('duplicate');
    const state = typeof r.state === 'string' && r.state.trim() && r.state.trim().length <= 40 ? r.state.trim() : null;
    const item: NewsItem = {
      id: `${date}-${hash(fingerprint || headline)}`,
      date,
      category,
      state,
      headline,
      bullets,
      examFacts,
      sources,
      corroboration: corroborationOf(sources),
      verification: 'single-pass',
      english: null,
      fingerprint,
      createdAt: now,
    };
    item.english = cleanLesson(r.english, itemText(item));
    pool.push(item);
    out.items.push(item);
    out.refMap[ref] = item.id;
    (Array.isArray(r.questions) ? r.questions : []).slice(0, 2).forEach((rq: any, qi: number) => {
      const q = cleanQuestion(rq, item, qi);
      if (q && !out.questions.some((x) => norm(x.q) === norm(q.q))) out.questions.push(q);
    });
  });
  return out;
}

export interface Verdict {
  ref: string;
  verdict: 'verified' | 'conflict' | 'unsupported';
}

/** Drops items (and their questions) the verification pass could not confirm. */
export function applyVerdicts(
  res: SanitizeResult,
  verdicts: Verdict[],
): { items: NewsItem[]; questions: Question[]; dropped: number; verifiedCount: number } {
  const byId = new Map<string, Verdict['verdict']>();
  for (const v of verdicts) {
    const id = res.refMap[v.ref];
    if (id && ['verified', 'conflict', 'unsupported'].includes(v.verdict)) byId.set(id, v.verdict);
  }
  const drop = new Set([...byId].filter(([, v]) => v !== 'verified').map(([id]) => id));
  const items = res.items
    .filter((i) => !drop.has(i.id))
    .map((i) => (byId.get(i.id) === 'verified' ? { ...i, verification: 'verified' as const } : i));
  return {
    items,
    questions: res.questions.filter((q) => !drop.has(q.newsId)),
    dropped: drop.size,
    verifiedCount: items.filter((i) => i.verification === 'verified').length,
  };
}

/** Pull the outermost JSON object out of a model reply (handles ``` fences and chatter). */
export function extractJson(text: string): any {
  const t = text.replace(/```(?:json)?/gi, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('The model reply contained no JSON.');
  return JSON.parse(t.slice(a, b + 1));
}
