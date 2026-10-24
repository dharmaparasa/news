import { useRef, useState } from 'react';
import { DAILY_REQUEST_LIMIT, DEFAULT_MODEL } from '../types';
import { testKey } from '../lib/gemini';
import { getKey, getLastOk, isKeyRemembered, removeKey, reserveKeyCheck, setKey } from '../lib/storage';
import { exportAll, importAll, wipeAll } from '../lib/backup';
import { prettyTime } from '../lib/dates';
import { useData } from './store';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];

export function Settings() {
  const { prefs, setPrefs, usage, busy, refresh, online, editions, reload, setNotice, notice } = useData();
  const [key, setKeyText] = useState(getKey());
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(isKeyRemembered());
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const last = getLastOk();
  const left = Math.max(0, DAILY_REQUEST_LIMIT - usage.count);

  const save = () => {
    setKey(key, remember);
    setStatus(key.trim() ? 'Key saved on this device.' : 'Key removed.');
  };
  const test = async () => {
    if (!key.trim()) return setStatus('Enter a key first.');
    if (!reserveKeyCheck()) return setStatus('Key test limit reached for today (5).');
    setTesting(true);
    setStatus('Testing…');
    try {
      const name = await testKey(key.trim(), prefs.model);
      setStatus(`Connected. Model available: ${name}.`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setTesting(false);
    }
  };
  const remove = () => {
    removeKey();
    setKeyText('');
    setStatus('Key removed from this device.');
  };
  const download = async () => {
    const blob = new Blob([await exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `current-affairs-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = async (f?: File) => {
    if (!f) return;
    try {
      const n = await importAll(await f.text());
      await reload();
      setNotice({ kind: 'ok', text: `Restored ${n} records.` });
    } catch (e) {
      setNotice({ kind: 'err', text: (e as Error).message });
    }
  };

  return (
    <section>
      <h2 className="page-h">Settings</h2>
      {notice && <div className={'notice ' + notice.kind} role="status">{notice.text}</div>}

      <div className="card">
        <h3>Your Google API key</h3>
        <p className="muted small">
          Create a free key in Google AI Studio. The key is sent only to Google’s Gemini API from this browser. It is never sent to any other server, analytics or logs.
          A key typed into a web page is not fully secret even when stored locally: anyone with access to this browser profile could read it. Use a key with no billing attached, and delete it from Google if the device is lost.
        </p>
        <label className="field">API key
          <input type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKeyText(e.target.value)} placeholder="Paste your key" />
        </label>
        <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Show key</label>
        <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember on this device (otherwise it is forgotten when the tab session ends)</label>
        <div className="row">
          <button className="btn" onClick={save}>Save key</button>
          <button className="btn ghost" onClick={test} disabled={testing || !online}>Test connection</button>
          <button className="btn ghost" onClick={remove}>Remove key</button>
        </div>
        {status && <p role="status" className="small">{status}</p>}
        <p className="muted small">The connection test reads model information only. It does not search or generate, and does not use the daily news requests.</p>
      </div>

      <div className="card">
        <h3>Daily requests</h3>
        <p><strong>{usage.count} of {DAILY_REQUEST_LIMIT}</strong> news requests used today (India time). Failed attempts and manual refreshes count.</p>
        <p className="muted small">
          Last successful update: {last ? prettyTime(last) : 'none yet'}. Saved editions: {editions.length}. The counter lives in this browser, so clearing browser data resets it.
          The app refreshes only when opened on a new day or when you press the button; it cannot fetch while closed.
        </p>
        <label className="check"><input type="checkbox" checked={prefs.autoVerify} onChange={(e) => setPrefs({ autoVerify: e.target.checked })} />Use the second request to fact-check each new edition (recommended)</label>
        <label className="field">Model
          <input value={prefs.model} onChange={(e) => setPrefs({ model: e.target.value.trim() })} spellCheck={false} />
        </label>
        <p className="muted small">Default is {DEFAULT_MODEL}. If a test says the model was not found, enter a current Gemini Flash model that supports Google Search grounding.</p>
        <button className="btn" disabled={busy || !online || left < 1} onClick={() => refresh(true)}>{busy ? 'Collecting…' : 'Refresh now'}</button>
        {left < 1 && <p className="muted small">No requests left today.</p>}
      </div>

      <div className="card">
        <h3>Display</h3>
        <label className="field">Text size
          <select value={prefs.fontSize} onChange={(e) => setPrefs({ fontSize: e.target.value as typeof prefs.fontSize })}>
            <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option><option value="xl">Extra large</option>
          </select>
        </label>
        <label className="field">Theme
          <select value={prefs.theme} onChange={(e) => setPrefs({ theme: e.target.value as typeof prefs.theme })}>
            <option value="light">Light</option><option value="dark">Dark</option><option value="auto">Match device</option>
          </select>
        </label>
        <label className="field">My state (for the state filter)
          <select value={prefs.state} onChange={(e) => setPrefs({ state: e.target.value })}>
            <option value="">Not set</option>
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="card">
        <h3>Your saved data</h3>
        <p className="muted small">News, questions, bookmarks and exam history live in this browser only. Clearing site data or uninstalling the app can erase them, so export a backup now and then. The backup never contains your API key.</p>
        <div className="row">
          <button className="btn" onClick={download}>Export backup</button>
          <button className="btn ghost" onClick={() => file.current?.click()}>Restore backup</button>
          <button className="btn danger" onClick={async () => { if (confirm('Delete all saved news, bookmarks and exam history from this device?')) { await wipeAll(); await reload(); setNotice({ kind: 'ok', text: 'All saved data deleted.' }); } }}>Delete saved data</button>
        </div>
        <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    </section>
  );
}
