# Exam Daily: Current Affairs (PWA)

A mobile-first, installable web app that turns each day's most exam-relevant news into a compact newspaper, a searchable archive and mock exams for RRB, SSC, banking, UPSC and state exams. It runs entirely in the browser and deploys to GitHub Pages. There is no backend.

Built with React, TypeScript and Vite. News is collected with the Gemini API and Grounding with Google Search, using each user's own API key.

## How it works

1. On the first open of each Asia/Kolkata calendar day the app checks IndexedDB. If today's edition exists it loads it with no API request.
2. Otherwise it sends one batched request that finds, consolidates and writes questions for the day's news, then at most one more request that fact-checks the result.
3. Two Google requests per IST day are the hard limit. The counter is reserved before each call, so failed attempts and manual refreshes count. There are no automatic retries.
4. Every item is validated locally before it is saved: known category, grounded https source links (the source host must appear in Google Search's own results), duplicate detection, English lessons built only from words in the news text, and questions whose correct answer must be stated in the news item. Items the fact-check marks as conflicting or unsupported are dropped.
5. If a request fails or returns nothing valid, nothing is written. Saved news is never replaced by an empty result, and old news is never labelled as today's.

Searching, filtering, reading, bookmarking and all exams use saved local data only and never call Google.

## Run locally

```bash
npm install        # creates package-lock.json: commit it
npm run dev        # http://localhost:5173
npm test           # logic tests (node:test via tsx)
npm run build      # type-check + production build into dist/
npm run preview
```

Requires Node 20.19 or newer (22 recommended).

## Get a Google API key

1. Open Google AI Studio and create a Gemini API key. Use a key with no billing attached if you can.
2. In the app open Settings, paste the key and press **Save key**, then **Test connection**.
3. Tick **Remember on this device** only on a device you trust. Otherwise the key lives in sessionStorage and is forgotten when the tab session ends.

The key is sent only to `generativelanguage.googleapis.com`, in the `x-goog-api-key` header. It is never sent to this app's host, analytics or logs. A key typed into a web page is not fully secret even when stored locally: any script or person with access to the browser profile can read it. Delete the key in Google AI Studio if a device is lost.

The connection test reads model metadata only (no search, no generation), so it does not use the two daily news requests. It is capped at 5 tests per day.

**Model name.** The default is `gemini-3.5-flash`. Model names change over time; if the test says "model not found", enter a current Gemini Flash model that supports Google Search grounding in Settings.

**Google Search suggestions.** Google's terms for grounding require showing search suggestions. The Home screen shows them in a sandboxed frame under today's edition.

## Deploy to GitHub Pages

1. Create a new GitHub repository (for example `exam-current-affairs`) and push this project to the `main` branch:
   ```bash
   git init && git add . && git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. In the repository open **Settings > Pages** and set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs tests, builds with `VITE_BASE=/<repo>/`, and deploys. Check the **Actions** tab; the site appears at `https://<you>.github.io/<repo>/`.

Sub-path details: Vite's `base` is `./` locally and `/<repo>/` in CI. Routing uses the URL hash (`#/paper`), so no server rewrites are needed. The manifest uses relative URLs, the service worker registers relative to the base, and a build step injects the list of built files into `sw.js` so the app shell is cached under the repository path.

## Install on Android

1. Open the deployed URL in Chrome.
2. Open the menu and choose **Install app** (or **Add to Home screen**).
3. Launch it from the home screen. After the first online visit the app shell and all saved news open offline.

## Features

- **Paper:** pages grouped by topic, about 4 to 6 items each, swipe or Previous/Next, page-turn animation (disabled for reduced motion), exam facts highlighted, expandable English lessons.
- **All News:** every saved item in one list; Today, 7 days, 30 days, All saved, date, category, state, keyword search, newest first, bookmarks, source links, historical items clearly marked.
- **Exam:** Daily (up to 15 questions), Weekly (last 7 days, up to 25), Monthly (current month, up to 40). Counts follow the saved questions and are never padded. Timed or untimed, question navigator, review before submit, score breakdown, explanations with source links, retake, wrong-answer practice, history.
- **Home, Categories, Bookmarks, Archive, Settings:** as described in the brief. Settings has export and restore of a JSON backup (it never contains the API key).
- **Offline:** IndexedDB holds editions, news, questions, bookmarks and attempts; preferences live in localStorage.

## Project layout

```
src/lib/      dates (IST), validate, gemini, pipeline, exam, filter, paginate, storage, db, backup
src/ui/       App, Home, Paper, AllNews, Exam, Lists, Settings, NewsCard, store
public/       manifest, sw.js template, icons
tests/        logic tests
```

## Limitations

- A static site cannot keep a key secret, and it cannot fetch news while closed. The app refreshes on the first open of each day or when you press **Refresh now**.
- The request counter and all saved data live in the browser. Clearing site data resets the counter and erases saved news, bookmarks and history. Export a backup regularly.
- With two requests a day, a manual refresh after the automatic fetch and fact-check is not possible until midnight IST. Turn off the fact-check in Settings if you prefer to keep one request spare (items are then marked "not fact-checked a second time").
- Model output can still contain mistakes. Items show whether official and independent sources agree; check the linked source for anything you will rely on.
- A mandatory backend would allow a shared key and scheduled fetching, but it is deliberately not included.
