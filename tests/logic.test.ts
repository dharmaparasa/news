import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mem, item, question } from './helpers';

(globalThis as any).localStorage = mem();
(globalThis as any).sessionStorage = mem();

import { addDays, istDate, rangeFor, inRange } from '../src/lib/dates';
import { getUsage, remaining, reserve, markResult, setKey, getKey, removeKey, isKeyRemembered, reserveKeyCheck } from '../src/lib/storage';
import { answerSupported, applyVerdicts, cleanLesson, cleanSources, corroborationOf, extractJson, isDuplicate, sanitize, isOfficialHost } from '../src/lib/validate';
import { eligibleQuestions, pickQuestions, scoreOf, startRun, buildAttempt, wrongQuestions } from '../src/lib/exam';
import { filterNews } from '../src/lib/filter';
import { paginate } from '../src/lib/paginate';
import { DAILY_REQUEST_LIMIT } from '../src/types';

const G = { domains: new Set(['pib.gov.in', 'thehindu.com']), chunkCount: 2 };

test('IST date rolls over at 00:00 Asia/Kolkata, not UTC', () => {
  assert.equal(istDate(new Date('2026-10-24T18:29:00Z')), '2026-10-24');
  assert.equal(istDate(new Date('2026-10-24T18:31:00Z')), '2026-10-25');
});

test('exam date ranges: daily, weekly (7 days), monthly (calendar month)', () => {
  const t = '2026-10-24';
  assert.deepEqual(rangeFor('daily', t), [t, t]);
  assert.deepEqual(rangeFor('weekly', t), ['2026-10-18', t]);
  assert.deepEqual(rangeFor('monthly', t), ['2026-10-01', t]);
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.ok(inRange('2026-10-18', rangeFor('weekly', t)));
  assert.ok(!inRange('2026-10-17', rangeFor('weekly', t)));
});

test('request budget: 2 per IST day, failures count, resets next day', () => {
  const d = '2026-10-24';
  assert.equal(getUsage(d).count, 0);
  assert.ok(reserve('generate', d));
  markResult(false, 'boom', d); // failed attempt still counts
  assert.equal(getUsage(d).count, 1);
  assert.ok(reserve('verify', d));
  assert.equal(remaining(getUsage(d)), 0);
  assert.equal(reserve('generate', d), null); // third request refused
  assert.equal(getUsage(d).count, DAILY_REQUEST_LIMIT);
  assert.equal(getUsage('2026-10-25').count, 0);
});

test('key checks are capped separately from news requests', () => {
  const d = '2026-11-01';
  for (let i = 0; i < 5; i++) assert.ok(reserveKeyCheck(d));
  assert.equal(reserveKeyCheck(d), false);
  assert.equal(getUsage(d).count, 0);
});

test('API key: session by default, localStorage only when remembered, removable', () => {
  setKey('abc', false);
  assert.equal(getKey(), 'abc');
  assert.equal(isKeyRemembered(), false);
  setKey('xyz', true);
  assert.equal(isKeyRemembered(), true);
  removeKey();
  assert.equal(getKey(), '');
});

test('sources: must be https and grounded; official vs media corroboration', () => {
  const s = cleanSources(
    [{ url: 'https://pib.gov.in/a' }, { url: 'http://pib.gov.in/b' }, { url: 'https://evil.example/c' }, { url: 'https://www.thehindu.com/d', title: 'The Hindu' }],
    G,
  );
  assert.deepEqual(s.map((x) => x.url), ['https://pib.gov.in/a', 'https://www.thehindu.com/d']);
  assert.equal(corroborationOf(s), 'corroborated');
  assert.equal(corroborationOf([s[0]]), 'official-only');
  assert.ok(isOfficialHost('kerala.gov.in') && isOfficialHost('rbi.org.in') && !isOfficialHost('thehindu.com'));
});

test('answerSupported ties answers to the news text', () => {
  const i = item();
  assert.ok(answerSupported(i, 'Kerala'));
  assert.ok(answerSupported(i, '1200 sq km'));
  assert.ok(!answerSupported(i, 'Assam'));
});

function raw(extra: any = {}) {
  return {
    items: [
      {
        ref: 'n1', category: 'Environment & Geography', state: 'Kerala',
        headline: 'Centre notifies new tiger reserve in Kerala',
        bullets: ['The Ministry of Environment notified the Sahyadri Tiger Reserve in Kerala covering 1,200 sq km.'],
        examFacts: ['Sahyadri Tiger Reserve', 'not in text'],
        sources: [{ url: 'https://pib.gov.in/x', title: 'PIB' }],
        english: { words: [{ word: 'notified', meaning: 'officially announced', synonyms: ['declared'], antonyms: [] }, { word: 'zebra', meaning: 'x', synonyms: ['y'], antonyms: [] }] },
        questions: [
          { q: 'In which state is the newly notified tiger reserve located?', options: ['Kerala', 'Goa', 'Assam', 'Bihar'], answerIndex: 0, explanation: 'The reserve lies in Kerala.' },
          { q: 'Which state hosts the new tiger reserve of the Sahyadri?', options: ['Goa', 'Assam', 'Bihar', 'Punjab'], answerIndex: 0, explanation: 'Goa is claimed wrongly.' },
          { q: 'Bad question with duplicate options here?', options: ['Kerala', 'Kerala', 'Goa', 'Bihar'], answerIndex: 0, explanation: 'Duplicate options present.' },
        ],
        ...extra,
      },
      { ref: 'n2', category: 'Nonsense', headline: 'Celebrity wedding makes headlines today', bullets: ['Not exam relevant at all.'], sources: [{ url: 'https://pib.gov.in/y' }] },
      { ref: 'n3', category: 'Economy & Banking', headline: 'RBI keeps repo rate unchanged at 5.5 percent', bullets: ['The RBI MPC kept the repo rate at 5.5 percent.'], sources: [{ url: 'https://unknown.example/z' }] },
    ],
  };
}

test('sanitize: drops bad category, ungrounded source, unsupported/duplicate questions, foreign words', () => {
  const r = sanitize(raw(), '2026-10-24', G, []);
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.rejected.map((x) => x.reason).sort(), ['no grounded source', 'unknown category']);
  assert.deepEqual(r.items[0].examFacts, ['Sahyadri Tiger Reserve']);
  assert.equal(r.items[0].english?.words.length, 1);
  assert.equal(r.questions.length, 1); // wrong answer & duplicate-option questions removed
  assert.equal(r.questions[0].newsId, r.items[0].id);
});

test('sanitize: deduplicates against saved news and within a batch', () => {
  const first = sanitize(raw(), '2026-10-24', G, []);
  const again = sanitize(raw(), '2026-10-25', G, first.items);
  assert.equal(again.items.length, 0);
  assert.ok(again.rejected.some((x) => x.reason === 'duplicate'));
  assert.ok(isDuplicate(first.items[0].fingerprint, first.items));
});

test('verification: conflicts removed, verified flagged, questions follow items', () => {
  const r = sanitize(raw(), '2026-10-24', G, []);
  const kept = applyVerdicts(r, [{ ref: 'n1', verdict: 'verified' }]);
  assert.equal(kept.items[0].verification, 'verified');
  const dropped = applyVerdicts(r, [{ ref: 'n1', verdict: 'conflict' }]);
  assert.equal(dropped.items.length, 0);
  assert.equal(dropped.questions.length, 0);
});

test('no grounding means nothing can be trusted (all sources rejected)', () => {
  const r = sanitize(raw(), '2026-10-24', { domains: new Set(), chunkCount: 0 }, []);
  assert.equal(r.items.length, 0);
});

test('extractJson handles fences and chatter; bad text throws', () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => extractJson('no json here'));
  assert.equal(cleanLesson({ words: [] }, 'x'), null);
});

test('exams: ranges, no padding, dedupe, scoring, attempt, wrong-answer practice', () => {
  const today = '2026-10-24';
  const news = [
    item({ id: 'a', date: '2026-10-24' }),
    item({ id: 'b', date: '2026-10-20' }),
    item({ id: 'c', date: '2026-10-02' }),
    item({ id: 'd', date: '2026-09-30' }),
  ];
  const qs = [
    question({ id: 'qa', newsId: 'a', date: '2026-10-24', q: 'Question about A that is long enough?' }),
    question({ id: 'qb', newsId: 'b', date: '2026-10-20', q: 'Question about B that is long enough?' }),
    question({ id: 'qc', newsId: 'c', date: '2026-10-02', q: 'Question about C that is long enough?' }),
    question({ id: 'qd', newsId: 'd', date: '2026-09-30', q: 'Question about D that is long enough?' }),
    question({ id: 'qx', newsId: 'gone', date: '2026-10-24', q: 'Orphan question whose news was deleted?' }),
    question({ id: 'qa2', newsId: 'a', date: '2026-10-24', q: 'question about a that is long enough' }),
  ];
  assert.deepEqual(eligibleQuestions('daily', today, qs, news).map((q) => q.id), ['qa']);
  assert.deepEqual(eligibleQuestions('weekly', today, qs, news).map((q) => q.id).sort(), ['qa', 'qb']);
  assert.deepEqual(eligibleQuestions('monthly', today, qs, news).map((q) => q.id).sort(), ['qa', 'qb', 'qc']);
  assert.equal(pickQuestions('monthly', today, qs, news).length, 3); // never padded to a quota

  const run = startRun('weekly', qs.slice(0, 3), false, 1000);
  run.answers = [0, 2, null]; // right, wrong, skipped
  assert.deepEqual(scoreOf(run.qs, run.answers), { correct: 1, wrong: 1, unanswered: 1, total: 3 });
  const at = buildAttempt(run, 2000);
  assert.equal(at.correct, 1);
  assert.deepEqual(wrongQuestions([at]).map((q) => q.id), ['qb']);

  const redo = { ...at, id: 'z', submittedAt: 3000, questions: [qs[1]], answers: [0] as (number | null)[] };
  assert.deepEqual(wrongQuestions([at, redo]), []); // answering it right later clears it
});

test('timed run sets a deadline of 60s per question', () => {
  const r = startRun('daily', [question(), question({ id: 'q2' })], true, 1000);
  assert.equal(r.endsAt, 1000 + 120000);
});

test('All News filters work on saved data only', () => {
  const today = '2026-10-24';
  const all = [
    item({ id: '1', date: today, headline: 'Tiger reserve notified in Kerala' }),
    item({ id: '2', date: '2026-10-20', category: 'Economy & Banking', state: null, headline: 'RBI repo rate unchanged' }),
    item({ id: '3', date: '2026-09-01', headline: 'Old Ramsar site added', state: 'Assam' }),
  ];
  const base = { range: 'all' as const, date: '', category: '', state: '', query: '' };
  assert.deepEqual(filterNews(all, base, today).map((n) => n.id), ['1', '2', '3']); // newest first
  assert.deepEqual(filterNews(all, { ...base, range: 'today' }, today).map((n) => n.id), ['1']);
  assert.deepEqual(filterNews(all, { ...base, range: '7' }, today).map((n) => n.id), ['1', '2']);
  assert.deepEqual(filterNews(all, { ...base, range: '30' }, today).map((n) => n.id), ['1', '2']);
  assert.deepEqual(filterNews(all, { ...base, query: 'repo RATE' }, today).map((n) => n.id), ['2']);
  assert.deepEqual(filterNews(all, { ...base, state: 'Assam' }, today).map((n) => n.id), ['3']);
  assert.deepEqual(filterNews(all, { ...base, date: '2026-10-20' }, today).map((n) => n.id), ['2']);
});

test('paginate: topic pages, ~5 items, no empty pages', () => {
  const items = Array.from({ length: 7 }, (_, i) => item({ id: 'p' + i, headline: 'Short headline number ' + i, bullets: ['Short bullet text here.'] }));
  items.push(item({ id: 'e', category: 'Economy & Banking' }));
  const pages = paginate(items);
  assert.deepEqual(pages.map((p) => p.category), ['Economy & Banking', 'Environment & Geography', 'Environment & Geography']);
  assert.ok(pages.every((p) => p.items.length > 0 && p.items.length <= 6));
});
