# Diet & Exercise Tracker 🥗💪

A tiny, no-frills web app for rating how your diet and exercise went each
day — **Poor**, **Neutral**, or **Good** — with week and month summaries so
you can see trends at a glance.

Works entirely offline once loaded (it's a PWA), and all your data is saved
on the phone itself (`localStorage`). Nothing is sent anywhere — there's no
server, account, or database outside the app.

## Try it locally

Just open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Put it on your Android phone

The easiest option is free static hosting with **GitHub Pages**:

1. Push this repo to GitHub (or use this one).
2. In the repo settings, enable **Pages** → deploy from the branch containing
   these files (root folder).
3. GitHub gives you a URL like `https://yourname.github.io/personal-coding/`.
4. Open that URL on your phone in Chrome, tap the **⋮** menu →
   **"Add to Home screen"**. It'll behave like a real app (full screen icon,
   works offline, your ratings stay saved between visits).

## Using the app

The app has three tabs at the bottom:

- **📅 Log** — Rate today's **Diet** and **Exercise** as Poor / Neutral /
  Good with one tap each. Use the **‹ ›** arrows or the date picker to log a
  different day (forgot yesterday? no problem). Tap a selected rating again
  to clear it, or use **🗑️ Clear This Day** to wipe both ratings for that
  day.
- **🗓️ Week** — See the current week (Monday–Sunday) at a glance, with each
  day's diet and exercise rating, plus a count of Poor/Neutral/Good and an
  average score for the week. Use **‹ ›** to browse other weeks.
- **📆 Month** — A calendar view of the whole month; each day shows two small
  dots (diet, exercise) colored by rating. Tap any day to jump straight to
  the Log tab for that date. Below the calendar are the same Poor/Neutral/Good
  counts and average score, for the whole month.
- **📈 Charts** — Diet and Exercise plotted on the same trend line, over the
  trailing 12 months. Toggle between **Day** (every logged day), **Week avg**,
  and **Month avg** to zoom out; the chart scrolls horizontally and opens on
  the most recent data. Tap (or hover, on desktop) any point for the exact
  date and both ratings, or expand **Show as table** for the full list of
  numbers behind the chart.

Scores are Poor = 1, Neutral = 2, Good = 3 — the "Avg score" in each summary
(and the numbers next to Week/Month averages in Charts) is the average of
that over the days you actually logged.

## Files

- `index.html` / `styles.css` / `app.js` — the app itself.
- `manifest.json` / `sw.js` / `icons/` — makes it installable and offline-capable.
