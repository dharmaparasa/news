import { AllNews } from './AllNews';
import { ExamRoute } from './Exam';
import { Archive, Bookmarks, Categories } from './Lists';
import { Home } from './Home';
import { href, useLoc } from './NewsCard';
import { Paper } from './Paper';
import { Settings } from './Settings';
import { Provider, useData } from './store';

const NAV: [string, string, string][] = [
  ['/home', 'Home', '⌂'],
  ['/paper', 'Paper', '▤'],
  ['/news', 'All News', '☰'],
  ['/exam', 'Exam', '✎'],
  ['/bookmarks', 'Saved', '★'],
];

function Shell() {
  const loc = useLoc();
  const { online, busy, notice, setNotice, ready } = useData();
  const root = '/' + (loc.path.split('/')[1] || 'home');
  let screen;
  switch (root) {
    case '/paper': screen = <Paper key={loc.q.toString() + ready} loc={loc} />; break;
    case '/news': screen = <AllNews key={loc.q.toString()} loc={loc} />; break;
    case '/exam': screen = <ExamRoute loc={loc} />; break;
    case '/categories': screen = <Categories />; break;
    case '/bookmarks': screen = <Bookmarks />; break;
    case '/archive': screen = <Archive />; break;
    case '/settings': screen = <Settings />; break;
    default: screen = <Home />;
  }
  return (
    <div className="app">
      <header className="top">
        <a href={href('/home')} className="brand">Exam Daily</a>
        <a href={href('/settings')} className="gear" aria-label="Settings">⚙</a>
      </header>
      {!online && <div className="notice info" role="status">You are offline. Saved news, bookmarks and exams still work.</div>}
      {busy && <div className="notice info" role="status">Collecting today’s news…</div>}
      {notice && root !== '/settings' && !busy && (
        <div className={'notice ' + notice.kind} role="status">
          {notice.text} <button className="link" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}
      <main id="main">{screen}</main>
      <nav className="tabs" aria-label="Main">
        {NAV.map(([p, label, icon]) => (
          <a key={p} href={href(p)} className={root === p ? 'on' : ''} aria-current={root === p ? 'page' : undefined}>
            <span aria-hidden="true">{icon}</span>{label}
          </a>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Provider>
      <Shell />
    </Provider>
  );
}
