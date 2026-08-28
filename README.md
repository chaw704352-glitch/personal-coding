# Hawk & Eagle Counter 🦅

A tiny, no-frills web app for counting hawks and eagles on long drives. Big
buttons, fun sounds, a milestone fanfare every 10 birds, easy mistake-fixing,
and an optional "save to Google Sheets" button to log each trip.

Works entirely offline once loaded (it's a PWA), so it's fine on backroads
with no signal. All counts are saved on the phone (`localStorage`) so nothing
is lost if you close the browser.

## Try it locally

Just open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Put it on your Android phones

The easiest option is free static hosting with **GitHub Pages**:

1. Push this repo to GitHub (or use this one).
2. In the repo settings, enable **Pages** → deploy from the branch containing
   these files (root folder).
3. GitHub gives you a URL like `https://yourname.github.io/personal-coding/`.
4. Open that URL on each phone in Chrome, tap the **⋮** menu →
   **"Add to Home screen"**. It'll behave like a real app (full screen icon,
   works offline).

## Using the app

- Tap **HAWK!** or **EAGLE!** each time you spot one — it plays a little
  matching call and bumps the counter.
- Every 10 total birds (10, 20, 30, ...) you get a celebration fanfare and
  flash on screen.
- Made a mistake? Use **↩️ Undo Last** to undo the most recent tap (of either
  kind), or the **− 1** button under a specific counter to knock one off that
  type directly.
- **🗑️ Reset Trip** clears both counters and starts a new trip (asks for
  confirmation first).
- The **⋮** menu lets you turn sound on/off and set up spreadsheet saving.

## Bonus: saving counts to a Google Sheet

This uses a free Google Apps Script "Web App" as a lightweight bridge — no
Google Cloud project or OAuth needed.

1. Create (or open) a Google Sheet you want to log to.
2. In the Sheet, go to **Extensions → Apps Script**.
3. Delete any starter code and paste in the contents of
   [`google-apps-script.gs`](./google-apps-script.gs) from this repo.
4. Click **Deploy → New deployment**.
   - Select type: **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone** (this only exposes an endpoint that appends a
     row — it can't read your sheet back).
5. Click **Deploy**, authorize it, and copy the **Web app URL** it gives you
   (ends in `/exec`).
6. In the Hawk & Eagle Counter app, open the **⋮** menu, paste that URL into
   "Save to Google Sheet", tap **Save URL**.
7. Tap **📤 Save Today's Count** any time you want to log the current date
   and counts as a new row in your sheet.

Each phone can point at the same sheet URL, so you and your wife can both log
from your own phones into one shared spreadsheet history of your trips.

## Files

- `index.html` / `styles.css` / `app.js` — the app itself.
- `manifest.json` / `sw.js` / `icons/` — makes it installable and offline-capable.
- `google-apps-script.gs` — paste into Google Apps Script for the Sheets bonus feature.
