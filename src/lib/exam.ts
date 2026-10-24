import type { Attempt, ExamMode, NewsItem, Question } from '../types';
import { inRange, rangeFor, type RangeMode } from './dates';
import { norm } from './validate';

export const LIMITS: Record<ExamMode, number> = { daily: 15, weekly: 25, monthly: 40, wrong: 20 };
export const SECONDS_PER_QUESTION = 60;

export interface Run {
  mode: ExamMode;
  qs: Question[];
  answers: (number | null)[];
  idx: number;
  timed: boolean;
  startedAt: number;
  endsAt: number | null;
  phase: 'answer' | 'review';
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Questions eligible for a mode: date inside the mode's IST range and still linked to a saved news item. */
export function eligibleQuestions(mode: RangeMode, today: string, questions: Question[], news: NewsItem[]): Question[] {
  const range = rangeFor(mode, today);
  const ids = new Set(news.filter((n) => inRange(n.date, range)).map((n) => n.id));
  const seen = new Set<string>();
  return questions.filter((q) => {
    const k = norm(q.q);
    if (!inRange(q.date, range) || !ids.has(q.newsId) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Never pads: returns as many questions as exist, up to the mode's limit. */
export function pickQuestions(
  mode: RangeMode,
  today: string,
  questions: Question[],
  news: NewsItem[],
  rng: () => number = Math.random,
): Question[] {
  return shuffle(eligibleQuestions(mode, today, questions, news), rng).slice(0, LIMITS[mode]);
}

export function startRun(mode: ExamMode, qs: Question[], timed: boolean, now = Date.now()): Run {
  return {
    mode,
    qs,
    answers: qs.map(() => null),
    idx: 0,
    timed,
    startedAt: now,
    endsAt: timed ? now + qs.length * SECONDS_PER_QUESTION * 1000 : null,
    phase: 'answer',
  };
}

export function scoreOf(qs: Question[], answers: (number | null)[]) {
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  qs.forEach((q, i) => {
    const a = answers[i];
    if (a === null || a === undefined) unanswered++;
    else if (a === q.answerIndex) correct++;
    else wrong++;
  });
  return { correct, wrong, unanswered, total: qs.length };
}

export function buildAttempt(run: Run, submittedAt = Date.now()): Attempt {
  return {
    id: `a${submittedAt.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    mode: run.mode,
    timed: run.timed,
    startedAt: run.startedAt,
    submittedAt,
    questions: run.qs,
    answers: run.answers,
    ...scoreOf(run.qs, run.answers),
  };
}

/** Latest outcome per question wins; a question is "wrong" while its most recent answer was wrong. */
export function wrongQuestions(attempts: Attempt[]): Question[] {
  const latest = new Map<string, { q: Question; ok: boolean }>();
  [...attempts]
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .forEach((at) =>
      at.questions.forEach((q, i) => {
        const a = at.answers[i];
        if (a === null || a === undefined) return; // skipped questions are not "wrong"
        latest.set(q.id, { q, ok: a === q.answerIndex });
      }),
    );
  return [...latest.values()].filter((v) => !v.ok).map((v) => v.q);
}
