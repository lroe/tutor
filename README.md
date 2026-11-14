# Cove

A quiet, local-first AI tutor for one dental student and one very large textbook.

Cove turns a PDF chapter into a guided conversation. It teaches one idea at a time,
asks her to explain it back, gives a smaller follow-up when something doesn't land,
and remembers what she has mastered. The actual pages and figures from her book
appear beside the teaching.

- Upload a PDF textbook.
- Pick a chapter, a page range, or let Cove find the sections.
- Learn with short explanations, page citations, and a **Next idea** button.
- Answer quick checks. They are typed: recall, concept, or apply.
- Ask questions at any time.
- See page snapshots and cropped figures from the book.
- Track mastered, shaky, and skipped ideas, with spaced review dates.
- Works as an installable iPhone app. No Apple developer account, no App Store,
  no backend.

---

## See it on Ubuntu

Requirements: Node.js 20.19+ (built and tested with Node 22), npm.

```bash
cd /home/jeevankumar/Videos/tutor
npm install
npm run dev
```

Open **http://localhost:5173**.

On a wide screen the app renders inside a phone-sized frame, so you see the real
mobile layout while testing. On a phone it goes edge to edge.

Two sample PDFs are in `sample/`:

| File | Use |
| --- | --- |
| `tooth-anatomy-sample.pdf` | Text-based sample with a diagram. Tests chapters, teaching, citations, page snapshots, and figure cropping. |
| `Scanned Page Sample.pdf` | Image-only page. Tests the "Read pages" OCR flow. |

The app starts in **Preview mode**, which uses canned teaching so you can try the
whole flow without a key. Add a Gemini key in **Settings → Gemini** to switch to
live teaching. The pictures still come from the uploaded PDF in preview mode.

### Add the key

1. Open **Settings**.
2. Paste the key under **Gemini → API key**.
3. Save, then **Test connection**.
4. Pick a model. `gemini-3.8-flash` is the default: fast and relatively cheap.

The key is stored in the browser's `localStorage`. It is never bundled into the
app and never sent to a server of ours. It goes straight from the browser to
Google's Gemini API.

> **Never commit a key to the repo.** Each person should enter their own key on
> their own device. If a key has been pasted into a chat, screenshot, or shell
> history, rotate it in Google AI Studio when you are done testing.

---

## Put it on her iPhone

Cove is a **PWA** (installable web app). This is the free path on iPhone:

1. Build the static app:

   ```bash
   npm run build
   ```

   The output is `dist/`. It contains only HTML, CSS, JS, fonts, and icons.

2. Host the `dist/` folder on any static host with HTTPS. There is no server
   code, database, or API to deploy.
   - **Netlify Drop** — drag `dist/` onto https://app.netlify.com/drop
   - **Cloudflare Pages** — direct upload
   - **GitHub Pages** — easiest as a root site (`<username>.github.io`)
   - **Vercel** — static project
3. Open the HTTPS link in **Safari on her iPhone**.
4. Tap **Share → Add to Home Screen → Add**.
5. Open Cove from its new Home Screen icon.

That's it. No Apple developer account, no TestFlight, no seven-day re-signing,
no Mac. It opens full screen and feels like an app.

### Hosting notes

- Use a **root URL** such as `cove.netlify.app`, not a subfolder. The manifest
  scope and service worker are configured for `/`. A GitHub Pages *project*
  site (e.g. `name.github.io/cove/`) would need a Vite `base` and manifest path
  change; a root deploy avoids that.
- The app shell is cached by a service worker. Stored lessons, page text, and
  saved pictures work offline. Gemini calls need the internet.
- iOS storage is tied to Safari and the site origin. Adding to the Home Screen
  helps persistence, but **save a backup regularly** (Settings → Save a backup).
- The API key is per device. Enter it on her phone; do not put it in the code or
  in the hosted files.
- Updates: deploy a new `dist/`; when she closes and reopens the app, the new
  service worker can take over. A reload usually does it.

For a quick LAN look before you meet her, `npm run dev` also prints a network
URL (e.g. `http://192.168.x.x:5173`). Safari can open it over HTTP, but iOS only
allows Add to Home Screen on HTTPS (or localhost), so the real install needs the
hosted link.

---

## What it does

### A guided chapter, not a chat box

- **Plan:** Cove reads the selected pages and builds a short path of 3–12 typed
  ideas. It adapts the count to the time and familiarity chosen in
  "Before we begin".
- **Teach:** one idea at a time, 2–3 short paragraphs, every fact tied to a page
  with a `(p. 12)` citation. Tap the citation to read the exact page text.
- **Check:** a quick question that fits the idea type:
  - **Recall** — a precise fact, term, or list.
  - **Concept** — explain it back in her own words.
  - **Apply** — use it in a small clinical or exam-style situation.
- **Follow-up:** if the answer is partial or wrong, Cove names the gap, corrects
  it, and asks one smaller question that targets that gap. After two attempts
  the idea is marked shaky and saved for review instead of trapping her.
- **Next:** passing the check makes the primary Next button appear. She can still
  skip deliberately; a skipped check goes into the review list.
- **Chat:** questions are answered against the same pages and cited. When a check
  is pending, Cove decides whether her message is an answer or a question and
  responds appropriately.

### What it remembers

- Covered ideas, checks passed, checks skipped, and ideas marked shaky.
- A lightweight spaced-review schedule: weak ideas come back tomorrow; passed
  ideas return after roughly 1–3–7–16–35–75 days depending on type.
- The Progress tab shows due reviews, "worth another look", weekly activity, and
  progress by book.
- Revisiting an idea re-teaches it from a different angle and updates its mastery.

### Pictures from the actual book

This is deliberately not an AI-generated illustration. It is her book:

- PDF pages are rendered locally with **PDF.js** and stored as page snapshots.
- The first time a page is used in a lesson, Gemini vision looks for figures,
  diagrams, photos, charts, and tables. It returns normalized bounding boxes;
  Cove crops those regions **locally** from the rendered page.
- Figures are captioned from the book when possible, cached in IndexedDB, and
  shown inline under the teaching. Tap a card to enlarge it.
- Full-page snapshots are always available, so a missed figure is still visible
  on the page.
- Scanned/image-only PDFs are detected. "Read pages" sends each page image to
  Gemini for OCR once, up to 60 pages per pass.

Page images are sent to Gemini once per page for figure detection (and once per
page for OCR on scanned PDFs). They are cached; revisiting a lesson does not pay
for them again. The original PDF never leaves the device.

---

## Design notes

### Inspired by DeepTutor, not a fork

[DeepTutor](https://github.com/HKUDS/DeepTutor) (HKUDS, Apache-2.0) is a much
larger agent-native learning workspace. Cove borrows the pedagogical ideas that
fit a single-student, phone-sized app:

- typed knowledge points and type-aware evidence of mastery;
- a mastery gate instead of advancing on a timer;
- teach-back/Feynman checks for concepts;
- error diagnosis and a targeted follow-up before moving on;
- spaced review with weak/skipped ideas surfaced rather than hidden;
- source-grounded citations.

It is an independent React app; no DeepTutor code is copied.

### Open-source PDF and figure extraction

- **PDF.js** (Apache-2.0) — used for PDF parsing, text extraction, and page
  rendering.
- **Dexie** (Apache-2.0) — IndexedDB.
- **Gemini vision bounding boxes** — used to find figures in a page image.

The usual open-source heavyweights for figure extraction — **MinerU**,
**Docling**, **Marker**, and **PyMuPDF** — can extract figures and captions, but
they are Python/server-side pipelines. Adding one would mean hosting a backend
and doing document processing somewhere other than her phone. Cove stays
client-only: render the page, ask Gemini where the visual is, crop it locally.
The full page remains the fallback.

Other open-source options considered: Tesseract (OCR; Gemini handles the mixed
text/diagram pages better and is already in the loop), and browser-side layout
models (too heavy for an iPhone PWA).

### No backend

There is no server of ours. The static host only serves files. All storage is in
the browser:

- IndexedDB: books, extracted page text, PDF blobs, lessons, messages, page
  snapshots, figures, activity.
- localStorage: name, Gemini key, model, theme/app settings.

Gemini calls go from the browser directly to
`generativelanguage.googleapis.com` (CORS is enabled by Google). This was tested
with a real key.

---

## Costs and privacy

- The selected chapter text is resent on each teaching/chat turn. Longer ranges
  cost more. The app caps/truncates very long context and recommends smaller
  ranges.
- Figure detection and OCR are one-time per page and cached.
- Gemini pricing and free-tier limits are set by Google. Check the current
  pricing for the model in Settings.
- The PDF is local. Selected page text and page images go to Gemini for the
  requested teaching, grading, OCR, and figure detection.
- No accounts, no analytics, no tracking, no sync.
- This is a study aid, not a clinical decision tool. AI can be wrong; the page
  citations are there so she can check the source.

---

## Development

```bash
npm run dev         # Vite dev server, phone frame on desktop
npm run typecheck   # TypeScript
npm run build       # static production build
npm run preview     # serve the production build
```

### Stack

- React 19 + TypeScript + Vite
- Dexie for IndexedDB
- PDF.js for PDFs
- `react-markdown` for tutor messages
- Gemini REST API (`generateContent` + SSE `streamGenerateContent`)
- `vite-plugin-pwa` for installability and the offline shell

### Structure

```
src/
  components/      shared UI, sheets, visual strip, source viewer
  hooks/           hash routing, chat auto-scroll
  lib/
    ai.ts          prompts, plan/teach/answer/grade/figure detection
    gemini.ts      REST client, SSE streaming, errors
    pdf.ts         PDF extraction, chapter detection, page rendering
    visuals.ts     page snapshots, figure cropping, caching
    db.ts          Dexie schema + helpers
    backup.ts      JSON export/import
    review.ts      spaced-review scheduling
    ocr.ts         scanned-page pipeline
    demo.ts        canned preview lesson
  views/           Welcome, Library, Book, Lesson, Progress, Settings
  state/           settings + toasts
scripts/
  make-sample-pdf.py   regenerates the synthetic sample (reportlab + Pillow)
sample/                ready-to-upload test PDFs
```

The sample PDFs are synthetic. The diagram is drawn for this project. The sample
text is not clinical advice.

To regenerate the sample:

```bash
python3 -m venv /tmp/cove-venv
/tmp/cove-venv/bin/pip install reportlab pillow
/tmp/cove-venv/bin/python scripts/make-sample-pdf.py
```

### Hosting a subpath

The app is set up for root hosting. If you must use a subpath:

- set `base` in `vite.config.ts`;
- set the PWA manifest `scope` and `start_url` to that path;
- set the Workbox `navigateFallback` accordingly;
- rebuild and test the install/offline flow on the actual URL.

Root static hosting is much less work.

---

## Known limits

- Tested on Ubuntu/Chrome at iPhone dimensions, plus a production PWA/offline
  check. Do one real install and pass on her iPhone.
- AI answers and grades can be wrong; the app shows its source pages.
- Figure detection can miss or over-crop a visual. The page snapshot is the
  fallback. OCR can make transcription errors.
- No cross-device sync and no background processing.
- Safari can evict unused site data. Keep backups; don't rely on one browser
  profile forever.
- Very large PDFs are stored locally and can hit browser storage limits; use
  backups and delete books you no longer need.
- Gemini free-tier rate limits may slow a lesson down; the app shows the error
  and keeps the work that has already been saved.

---

Built for one dental student who deserves a calmer way through a very large book.
