import { useEffect, useMemo, useState } from 'react';
import type { Attempt, ExamMode, Question } from '../types';
import { buildAttempt, eligibleQuestions, LIMITS, pickQuestions, scoreOf, SECONDS_PER_QUESTION, shuffle, startRun, wrongQuestions } from '../lib/exam';
import { dbPut } from '../lib/db';
import { prettyTime } from '../lib/dates';
import { go, href, type Loc } from './NewsCard';
import { useData } from './store';

const NAMES: Record<ExamMode, string> = { daily: 'Daily Exam', weekly: 'Weekly Exam', monthly: 'Monthly Exam', wrong: 'Wrong Answers Practice' };
const BLURB = {
  daily: 'Today’s saved questions, up to 15.',
  weekly: 'Last 7 days of saved news, up to 25 questions.',
  monthly: 'This calendar month, up to 40 questions.',
} as const;

export function ExamRoute({ loc }: { loc: Loc }) {
  const parts = loc.path.split('/').filter(Boolean); // ['exam', 'run' | 'history' | 'result', id]
  if (parts[1] === 'run') return <Runner />;
  if (parts[1] === 'history') return <History />;
  if (parts[1] === 'result') return <Result id={parts[2]} />;
  return <Hub />;
}

/* ---------------- hub ---------------- */
function Hub() {
  const { questions, news, today, attempts, setRun, run } = useData();
  const [timed, setTimed] = useState(false);
  const wrong = useMemo(() => wrongQuestions(attempts), [attempts]);
  const begin = (mode: ExamMode, qs: Question[]) => {
    setRun(startRun(mode, qs, timed));
    go('/exam/run');
  };
  return (
    <section>
      <h2 className="page-h">Exam</h2>
      <p className="muted">Exams use only questions already saved on this device, so they work offline and never call Google.</p>
      <label className="check">
        <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
        Timed mode ({SECONDS_PER_QUESTION} seconds per question)
      </label>
      {run && (
        <div className="notice info">
          An exam is in progress. <a href={href('/exam/run')}>Resume it</a>
        </div>
      )}
      {(['daily', 'weekly', 'monthly'] as const).map((m) => {
        const avail = eligibleQuestions(m, today, questions, news).length;
        const n = Math.min(avail, LIMITS[m]);
        return (
          <div className="card" key={m}>
            <h3>{NAMES[m]}</h3>
            <p className="muted">{BLURB[m]}</p>
            <p>{avail === 0 ? 'No saved questions in this period yet.' : `${n} question${n === 1 ? '' : 's'} ready (${avail} available).`}</p>
            <button className="btn" disabled={avail === 0} onClick={() => begin(m, pickQuestions(m, today, questions, news))}>
              Start {m} exam
            </button>
          </div>
        );
      })}
      <div className="card">
        <h3>{NAMES.wrong}</h3>
        <p className="muted">Questions whose latest answer was wrong.</p>
        <p>{wrong.length} to practise.</p>
        <button className="btn" disabled={!wrong.length} onClick={() => begin('wrong', shuffle(wrong).slice(0, LIMITS.wrong))}>
          Practise wrong answers
        </button>
      </div>
      <p><a className="btn ghost" href={href('/exam/history')}>Exam history ({attempts.length})</a></p>
    </section>
  );
}

/* ---------------- runner ---------------- */
function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function Runner() {
  const { run, setRun, reload } = useData();
  const [now, setNow] = useState(Date.now());
  const left = run?.endsAt ? Math.max(0, Math.round((run.endsAt - now) / 1000)) : null;

  const submit = async () => {
    if (!run) return;
    const at = buildAttempt(run);
    await dbPut('attempts', at);
    setRun(null);
    await reload();
    go('/exam/result/' + at.id);
  };

  useEffect(() => {
    if (!run?.endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [run?.endsAt]);
  useEffect(() => {
    if (run && left === 0) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  if (!run) return <div className="empty"><p>No exam is running.</p><a className="btn" href={href('/exam')}>Choose an exam</a></div>;

  const upd = (p: Partial<typeof run>) => setRun({ ...run, ...p });
  const choose = (i: number) => {
    const answers = [...run.answers];
    answers[run.idx] = i;
    upd({ answers });
  };
  const total = run.qs.length;

  if (run.phase === 'review') {
    const s = scoreOf(run.qs, run.answers);
    return (
      <section>
        <h2 className="page-h">Review before submitting</h2>
        {left !== null && <p className="timer" role="timer">Time left {fmt(left)}</p>}
        <p>{total - s.unanswered} answered, {s.unanswered} unanswered.</p>
        <div className="qgrid">
          {run.qs.map((_, i) => (
            <button key={i} className={run.answers[i] === null ? 'blank' : 'done'} aria-label={`Question ${i + 1}, ${run.answers[i] === null ? 'unanswered' : 'answered'}`} onClick={() => upd({ idx: i, phase: 'answer' })}>
              {i + 1}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => upd({ phase: 'answer' })}>Back to questions</button>
          <button className="btn" onClick={submit}>Submit exam</button>
        </div>
      </section>
    );
  }

  const q = run.qs[run.idx];
  const chosen = run.answers[run.idx];
  return (
    <section>
      <div className="runbar">
        <strong>Question {run.idx + 1} of {total}</strong>
        {left !== null && <span className="timer" role="timer">{fmt(left)}</span>}
      </div>
      <progress value={run.idx + 1} max={total} aria-label="Progress" />
      <div className="card">
        <span className="tag">{q.category}</span>
        <h3 className="qtext">{q.q}</h3>
        <div role="radiogroup" aria-label="Answer options">
          {q.options.map((o, i) => (
            <button key={i} role="radio" aria-checked={chosen === i} className={'opt' + (chosen === i ? ' sel' : '')} onClick={() => choose(i)}>
              <span className="letter">{'ABCD'[i]}</span>
              {o}
            </button>
          ))}
        </div>
      </div>
      <div className="qgrid">
        {run.qs.map((_, i) => (
          <button key={i} className={(i === run.idx ? 'cur ' : '') + (run.answers[i] === null ? 'blank' : 'done')} aria-label={`Go to question ${i + 1}`} onClick={() => upd({ idx: i })}>
            {i + 1}
          </button>
        ))}
      </div>
      <div className="row">
        <button className="btn ghost" disabled={run.idx === 0} onClick={() => upd({ idx: run.idx - 1 })}>Previous</button>
        {run.idx < total - 1 ? (
          <button className="btn" onClick={() => upd({ idx: run.idx + 1 })}>Next</button>
        ) : (
          <button className="btn" onClick={() => upd({ phase: 'review' })}>Review answers</button>
        )}
      </div>
      <button className="link" onClick={() => upd({ phase: 'review' })}>Review and submit</button>
    </section>
  );
}

/* ---------------- result ---------------- */
function Result({ id }: { id?: string }) {
  const { attempts, setRun } = useData();
  const [onlyWrong, setOnlyWrong] = useState(false);
  const at = attempts.find((a) => a.id === id);
  if (!at) return <div className="empty"><p>That attempt was not found.</p><a className="btn" href={href('/exam/history')}>Exam history</a></div>;
  const redo = (qs: Attempt['questions'], mode: ExamMode) => {
    setRun(startRun(mode, qs, at.timed));
    go('/exam/run');
  };
  const wrongIdx = at.questions.map((_, i) => i).filter((i) => at.answers[i] !== null && at.answers[i] !== at.questions[i].answerIndex);
  const pct = at.total ? Math.round((at.correct / at.total) * 100) : 0;
  return (
    <section>
      <h2 className="page-h">{NAMES[at.mode]} result</h2>
      <div className="score">
        <div className="big">{at.correct}<small> / {at.total}</small></div>
        <p>{pct}% · {at.correct} correct · {at.wrong} incorrect · {at.unanswered} unanswered</p>
        <p className="muted small">{prettyTime(at.submittedAt)}{at.timed ? ', timed' : ''}</p>
      </div>
      <div className="row">
        <button className="btn" onClick={() => redo(at.questions, at.mode)}>Retake</button>
        <button className="btn ghost" disabled={!wrongIdx.length} onClick={() => redo(wrongIdx.map((i) => at.questions[i]), 'wrong')}>Practise incorrect ({wrongIdx.length})</button>
      </div>
      <label className="check"><input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />Show only incorrect and unanswered</label>
      {at.questions.map((q, i) => {
        const a = at.answers[i];
        const ok = a === q.answerIndex;
        if (onlyWrong && ok) return null;
        return (
          <article className={'card ' + (ok ? 'right' : 'bad')} key={q.id + i}>
            <span className="tag">{q.category}</span>
            <h3 className="qtext">{i + 1}. {q.q}</h3>
            {q.options.map((o, j) => (
              <p key={j} className={'ans' + (j === q.answerIndex ? ' correct' : '') + (j === a && !ok ? ' wrongpick' : '')}>
                <span className="letter">{'ABCD'[j]}</span>{o}
                {j === q.answerIndex && ' (correct)'}{j === a && !ok && ' (your answer)'}
              </p>
            ))}
            {a === null && <p className="muted">You skipped this question.</p>}
            <p>{q.explanation}</p>
            <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>
          </article>
        );
      })}
    </section>
  );
}

/* ---------------- history ---------------- */
function History() {
  const { attempts } = useData();
  return (
    <section>
      <h2 className="page-h">Exam history</h2>
      {attempts.length === 0 && <p className="empty">No exams taken yet.</p>}
      {attempts.map((a) => (
        <a className="card row-link" key={a.id} href={href('/exam/result/' + a.id)}>
          <strong>{NAMES[a.mode]}</strong>
          <span>{a.correct} / {a.total}</span>
          <span className="muted small">{prettyTime(a.submittedAt)}</span>
        </a>
      ))}
      <a className="btn ghost" href={href('/exam')}>Back to Exam</a>
    </section>
  );
}
