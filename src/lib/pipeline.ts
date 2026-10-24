import type { Edition, NewsItem, Prefs, Question } from '../types';
import { addDays, istDate } from './dates';
import { dbGetAll, dbPutMany } from './db';
import { generate, generationPrompt, verificationPrompt, ApiError } from './gemini';
import { getKey, getUsage, markResult, remaining, reserve, setLastOk } from './storage';
import { applyVerdicts, extractJson, sanitize, type Verdict } from './validate';

export interface RefreshResult {
  status: 'cached' | 'saved';
  message: string;
  added: number;
  verified: boolean;
}

/**
 * One batched generation request (+ at most one verification request).
 * - Never runs when today's edition already exists unless `manual` is true.
 * - Every attempt is reserved against the 2-per-IST-day budget before the call, so failures count.
 * - Nothing is written unless at least one validated item survives, so old data is never replaced by an empty result.
 */
export async function refreshEdition(prefs: Prefs, manual: boolean): Promise<RefreshResult> {
  const today = istDate();
  const editions = await dbGetAll('editions');
  if (!manual && editions.some((e) => e.date === today)) {
    return { status: 'cached', message: 'Today’s edition is already saved on this device.', added: 0, verified: false };
  }
  const key = getKey();
  if (!key) throw new Error('Add your Google API key in Settings first.');
  if (remaining(getUsage(today)) < 1) throw new Error('Both of today’s Google requests are used. Try again after midnight IST.');

  /* ---- request 1: find, consolidate and write questions ---- */
  reserve('generate', today);
  let first;
  try {
    first = await generate(key, prefs.model, generationPrompt(today));
  } catch (e) {
    markResult(false, (e as Error).message, today);
    throw e;
  }
  let raw: unknown;
  try {
    if (first.truncated) throw new Error('The answer was cut off before it finished.');
    if (first.grounding.chunkCount === 0) throw new Error('Google returned no search sources, so nothing could be trusted.');
    raw = extractJson(first.text);
  } catch (e) {
    markResult(false, (e as Error).message, today);
    throw new ApiError(`Could not use Google’s answer: ${(e as Error).message}`);
  }

  const since = addDays(today, -30);
  const existing = (await dbGetAll('news')).filter((n) => n.date >= since);
  const res = sanitize(raw, today, first.grounding, existing);
  if (res.items.length === 0) {
    markResult(false, 'no valid items', today);
    throw new Error(
      res.rejected.length
        ? `Google returned ${res.rejected.length} items but none passed the source and quality checks. Your saved news was not changed.`
        : 'Google returned no news items. Your saved news was not changed.',
    );
  }
  markResult(true, undefined, today);

  /* ---- request 2 (optional): independent fact-check ---- */
  let items: NewsItem[] = res.items;
  let questions: Question[] = res.questions;
  let verified = false;
  let note = '';
  if (prefs.autoVerify && remaining(getUsage(today)) >= 1) {
    reserve('verify', today);
    try {
      const refOf = (id: string) => Object.keys(res.refMap).find((r) => res.refMap[r] === id) ?? id;
      const v = await generate(key, prefs.model, verificationPrompt(res.items, res.questions, refOf));
      const parsed = extractJson(v.text);
      const verdicts: Verdict[] = Array.isArray(parsed?.results) ? parsed.results : [];
      if (verdicts.length === 0) throw new Error('empty verification');
      const applied = applyVerdicts(res, verdicts);
      if (applied.items.length === 0) throw new Error('verification rejected every item');
      items = applied.items;
      questions = applied.questions;
      verified = true;
      note = `${applied.verifiedCount} verified, ${applied.dropped} dropped after fact-check.`;
      markResult(true, undefined, today);
    } catch (e) {
      markResult(false, (e as Error).message, today);
      note = 'Fact-check pass failed; items are marked single-pass.';
    }
  } else if (!prefs.autoVerify) {
    note = 'Fact-check pass is switched off; items are marked single-pass.';
  } else {
    note = 'No request left for a fact-check pass; items are marked single-pass.';
  }

  /* ---- save (merge with anything already saved for today) ---- */
  const todaysExisting = (await dbGetAll('news')).filter((n) => n.date === today);
  const allToday = todaysExisting.length + items.length;
  const qAll = (await dbGetAll('questions')).filter((q) => q.date === today).length + questions.length;
  await dbPutMany('news', items);
  await dbPutMany('questions', questions);
  const ed: Edition = {
    date: today,
    fetchedAt: Date.now(),
    model: prefs.model,
    itemCount: allToday,
    questionCount: qAll,
    verified,
    requestsUsed: getUsage(today).count,
    notes: note,
    searchEntryPoint: first.searchEntryPoint,
  };
  await dbPutMany('editions', [ed]);
  setLastOk(ed.fetchedAt);
  return {
    status: 'saved',
    message: `Saved ${items.length} new item${items.length === 1 ? '' : 's'} and ${questions.length} question${questions.length === 1 ? '' : 's'}. ${note}`,
    added: items.length,
    verified,
  };
}
