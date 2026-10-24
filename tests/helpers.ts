import type { NewsItem, Question } from '../src/types';

export function mem(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

export function item(over: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'i1',
    date: '2026-10-24',
    category: 'Environment & Geography',
    state: 'Kerala',
    headline: 'Centre notifies new tiger reserve in Kerala',
    bullets: ['The Ministry of Environment notified the Sahyadri Tiger Reserve in Kerala covering 1,200 sq km.'],
    examFacts: ['Sahyadri Tiger Reserve', '1,200 sq km'],
    sources: [{ url: 'https://pib.gov.in/x', title: 'PIB', official: true }],
    corroboration: 'official-only',
    verification: 'single-pass',
    english: null,
    fingerprint: 'centre kerala new notifies reserve tiger',
    createdAt: 1,
    ...over,
  };
}

export function question(over: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    newsId: 'i1',
    date: '2026-10-24',
    category: 'Environment & Geography',
    q: 'In which state is the newly notified tiger reserve located?',
    options: ['Kerala', 'Goa', 'Assam', 'Bihar'],
    answerIndex: 0,
    explanation: 'The reserve lies in Kerala.',
    sourceUrl: 'https://pib.gov.in/x',
    ...over,
  };
}
