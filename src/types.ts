export const CATEGORIES = [
  'Polity & Governance',
  'Government Schemes',
  'Economy & Banking',
  'Environment & Geography',
  'Important Days',
  'Science & Defence',
  'Reports, Ranks & Awards',
  'Railways & Infrastructure',
  'States & UTs',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Source {
  url: string;
  title: string;
  official: boolean;
}

export interface EnglishWord {
  word: string;
  meaning: string;
  synonyms: string[];
  antonyms: string[];
}

export interface EnglishLesson {
  words: EnglishWord[];
  grammar?: { concept: string; explanation: string };
  expressions: { phrase: string; meaning: string }[];
}

export type Corroboration = 'corroborated' | 'official-only' | 'single-source';

export interface NewsItem {
  id: string;
  date: string; // edition date, YYYY-MM-DD (Asia/Kolkata)
  category: Category;
  state: string | null;
  headline: string;
  bullets: string[];
  examFacts: string[];
  sources: Source[];
  corroboration: Corroboration;
  verification: 'verified' | 'single-pass';
  english: EnglishLesson | null;
  fingerprint: string;
  createdAt: number;
}

export interface Question {
  id: string;
  newsId: string;
  date: string;
  category: Category;
  q: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  sourceUrl: string;
}

export interface Edition {
  date: string;
  fetchedAt: number;
  model: string;
  itemCount: number;
  questionCount: number;
  verified: boolean;
  requestsUsed: number;
  notes?: string;
  searchEntryPoint?: string;
}

export type ExamMode = 'daily' | 'weekly' | 'monthly' | 'wrong';

export interface Attempt {
  id: string;
  mode: ExamMode;
  timed: boolean;
  startedAt: number;
  submittedAt: number;
  questions: Question[];
  answers: (number | null)[];
  correct: number;
  wrong: number;
  unanswered: number;
  total: number;
}

export interface Prefs {
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  theme: 'light' | 'dark' | 'auto';
  state: string;
  model: string;
  autoVerify: boolean;
}

export interface Usage {
  date: string;
  count: number;
  log: { at: number; kind: 'generate' | 'verify'; ok: boolean; note?: string }[];
  keyChecks: number;
}

export const DEFAULT_MODEL = 'gemini-3.5-flash';
export const DAILY_REQUEST_LIMIT = 2;
export const KEY_CHECK_LIMIT = 5;
