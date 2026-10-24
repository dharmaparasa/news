import { CATEGORIES, type NewsItem, type Question } from '../types';
import type { Grounding } from './validate';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiReply {
  text: string;
  grounding: Grounding;
  searchEntryPoint?: string;
  truncated: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

function friendly(status: number, apiMsg: string, model: string): string {
  const m = apiMsg.toLowerCase();
  if (status === 400 && (m.includes('api key') || m.includes('api_key'))) return 'Google rejected this API key. Check that it was copied completely.';
  if (status === 401 || status === 403) return 'The key was not accepted. Make sure the Generative Language API is allowed for it and the key is not restricted to other sites.';
  if (status === 404) return `Model "${model}" was not found. Change the model name in Settings.`;
  if (status === 429) return 'Google reports the free quota or rate limit is used up. Try again later.';
  if (status >= 500) return 'Google’s service had a temporary problem.';
  return apiMsg || `Request failed (${status}).`;
}

async function http(url: string, key: string, init: RequestInit, model: string, timeoutMs = 150000): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(friendly(res.status, body?.error?.message ?? '', model), res.status);
    return body;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError('The request timed out.');
    throw new ApiError('Could not reach Google. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
}

/** Connection test: reads model metadata only, no generation and no search billing. */
export async function testKey(key: string, model: string): Promise<string> {
  const body = await http(`${BASE}/models/${encodeURIComponent(model)}`, key, { method: 'GET' }, model, 20000);
  return body?.displayName || body?.name || model;
}

const HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export async function generate(key: string, model: string, prompt: string): Promise<GeminiReply> {
  const body = await http(
    `${BASE}/models/${encodeURIComponent(model)}:generateContent`,
    key,
    {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 32768 },
      }),
    },
    model,
  );
  const cand = body?.candidates?.[0];
  if (!cand) throw new ApiError(body?.promptFeedback?.blockReason ? 'The request was blocked by Google.' : 'Google returned no answer.');
  const parts: any[] = cand.content?.parts ?? [];
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
  const gm = cand.groundingMetadata;
  const chunks: any[] = gm?.groundingChunks ?? [];
  const domains = new Set<string>();
  for (const c of chunks) {
    const w = c?.web;
    if (!w) continue;
    const cands = [w.domain, w.title];
    try {
      if (w.uri && !String(w.uri).includes('vertexaisearch.cloud.google.com')) cands.push(new URL(w.uri).hostname);
    } catch {
      /* ignore */
    }
    for (const x of cands) {
      if (typeof x === 'string' && HOST_RE.test(x.trim())) domains.add(x.trim().replace(/^www\./, '').toLowerCase());
    }
  }
  return {
    text,
    grounding: { domains, chunkCount: chunks.length },
    searchEntryPoint: gm?.searchEntryPoint?.renderedContent,
    truncated: cand.finishReason === 'MAX_TOKENS',
  };
}

/* ---------------- prompts ---------------- */

export function generationPrompt(date: string): string {
  return `You are an editor of an exam-focused current affairs digest for Indian government exams (RRB, SSC, IBPS/SBI/RBI, UPSC, state PSC and police). Today's date in India is ${date}.

Use Google Search ONCE-over (a single research pass) to find the most exam-relevant news dated ${date} or the previous day, and return 14 to 22 distinct items. Prefer official sources (PIB, ministry and state government sites, RBI, ISRO, DRDO, official notifications) and add independent credible reporting where it exists.

Allowed categories (use these exact strings): ${CATEGORIES.map((c) => `"${c}"`).join(', ')}.
Cover polity and judgments, central/state schemes (ministry, objective, beneficiaries), RBI/banking/economy/Budget, tiger reserves, national parks, Ramsar sites, GI tags, important days and official themes, ISRO/DRDO/science/defence, reports/indices/rankings (publisher and India's rank), appointments and awards, railways and infrastructure, and states/UTs.
Exclude crime, accidents, celebrity or entertainment news, political rhetoric, clickbait and anything with little examination value. Never invent news to fill a category; omit categories with nothing verified.

Rules:
- Each item: a short headline and 2 to 4 factual bullets in concise formal English. State the ministry, state, scheme objective, beneficiaries, theme, publisher or rank where relevant.
- "examFacts": 1 to 4 exact phrases copied from your headline/bullets (names, numbers, places, ranks) that a student must memorise.
- "sources": 1 to 3 working https URLs that you actually found with search (official first, then independent). Never guess a URL.
- "english": only when useful, from the item's OWN wording: up to 2 words with meaning, 1 to 3 synonyms, up to 2 antonyms; optionally one grammar point relevant to SSC/bank exams (e.g. voice, tense, prepositions, subject-verb agreement) and up to 2 formal collocations that appear in the text. Otherwise null.
- "questions": 1 or 2 four-option single-answer MCQs per item, answerable ONLY from the item's own facts. The correct option text must appear in the headline/bullets. Do not put the answer inside the question. Give a one-sentence explanation.

Reply with ONLY one JSON object, no markdown, in this shape:
{"items":[{"ref":"n1","category":"","state":null,"headline":"","bullets":["",""],"examFacts":[""],"sources":[{"url":"https://","title":"publisher name"}],"english":{"words":[{"word":"","meaning":"","synonyms":[""],"antonyms":[""]}],"grammar":{"concept":"","explanation":""},"expressions":[{"phrase":"","meaning":""}]},"questions":[{"q":"","options":["","","",""],"answerIndex":0,"explanation":""}]}]}`;
}

export function verificationPrompt(items: NewsItem[], questions: Question[], refOf: (id: string) => string): string {
  const payload = items.map((i) => ({
    ref: refOf(i.id),
    headline: i.headline,
    bullets: i.bullets,
    sources: i.sources.map((s) => s.url),
    answers: questions.filter((q) => q.newsId === i.id).map((q) => q.options[q.answerIndex]),
  }));
  return `Fact-check the following Indian current-affairs items using Google Search. For each item decide:
- "verified": names, dates, numbers, places, ranks and scheme details are supported by a reliable source, preferably official;
- "conflict": reliable sources disagree on a material fact or the item is wrong;
- "unsupported": you could not find reliable support.
Be strict: when unsure, do not mark "verified".

Items:
${JSON.stringify(payload)}

Reply with ONLY JSON, no markdown: {"results":[{"ref":"n1","verdict":"verified"}]}`;
}
