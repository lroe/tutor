# Cove

A very small, ChatGPT-style tutor for your notes.

Upload a PDF, choose the pages, press **Build lesson**, and Cove teaches one idea
at a time. It asks a quick question, answers your own questions, and places the
actual diagram from the page inline at the point where it belongs. The home
screen lists each note and how many ideas you've learned. Tap a note to see its
full concept list and start another page range.

No account. No onboarding questions. No settings screens full of options. No
backend.

---

## Run it on Ubuntu

Requirements: Node.js 20.19+ (tested with Node 22), npm.

```bash
cd /home/jeevankumar/Videos/tutor
npm install
npm run dev
```

Open **http://localhost:5173**.

On a wide screen Cove renders inside a phone-sized frame so you see the real
mobile layout. On a phone it goes edge to edge.

Production build:

```bash
npm run build     # static files in dist/
npm run preview   # serve the build at localhost:4173
```

Two sample notes are in `sample/`:

| File | What it tests |
| --- | --- |
| `tooth-anatomy-sample.pdf` | Text + a diagram. Upload, pages, teaching, pictures. |
| `Scanned Page Sample.pdf` | Image-only page. Tests the automatic OCR. |

---

## The whole app

1. **Upload a note** with the bar at the bottom.
2. **Pick pages** — From / To — and tap **Build lesson**.
3. Read the teaching. Type an answer or any question in the message box.
4. Tap **Next** when you're ready for the next idea. On the last idea it says
   **Finish**.
5. You land on the note's **Progress** page.

### Progress for each note

Tap any note on home. Its Progress page shows:

- **N ideas learned**.
- **Continue lesson** if a lesson is in progress.
- **New pages** — start a different page range for the same note.
- Every lesson range, with every concept listed and checked off as you learn it.

The home note list is the overview. The note page is the detailed progress.
Starting **New pages** creates another lesson group on the same page, so a note
can have several ranges over time.

The tutor still asks a short check after each idea. You can answer it, ask
something else, or skip it with **Next**. When you get something wrong, it gives
a small correction and a follow-up question.

### The only setting

The first time you build a lesson the app asks for a **Gemini API key**. Paste
it once. It is stored on that device only and is sent straight to Google.

You can change it later from the small gear on the home screen. That is the
entire Settings.

Model: `gemini-3.8-flash` by default. No model picker.

> The key is not in this repo or the build. It cannot be, because the app is
> public static files and has no backend. Each device enters its own key.
> If a key has been shared in a chat or screenshot, rotate it when you're done.

---

## Pictures from the note

- Page snapshots are rendered locally with **PDF.js**.
- Gemini vision finds figures/diagrams/tables on the page and returns boxes;
  Cove crops those regions locally and caches them.
- The teaching prompt places a figure token at the exact point where the visual
  belongs. Cove renders the cropped diagram inline there, between the paragraphs.
- If a crop isn't ready, the page snapshot is shown as a fallback. If the model
  doesn't place a token, a detected figure is shown between the explanation and
  the check.
- Tap the diagram to view it full screen.
- Scanned/image-only pages are OCR'd automatically when you build a lesson.
- Selected page text and page images go to Gemini. The PDF itself stays on the
  device.

---

## Put it on her iPhone

Cove is a **PWA**. This is the free path — no Apple developer account, no
TestFlight, no App Store, no Mac.

```bash
npm run build
```

Upload the `dist/` folder to a static host with HTTPS:

- **Netlify Drop** — https://app.netlify.com/drop (drag `dist/`)
- **Cloudflare Pages** — direct upload
- **GitHub Pages** — easiest as a root site
- **Vercel** — static project

Then on her iPhone:

1. Open the HTTPS link in **Safari**.
2. **Share → Add to Home Screen → Add**.
3. Open Cove from its icon.
4. Paste the Gemini key from the gear (once).

The static host only serves files. There is no server, database, or API to run.
The app shell is cached, so stored notes open offline; Gemini needs the network.

Use a **root URL** (e.g. `cove.netlify.app`). The manifest and service worker are
configured for `/`. A GitHub Pages project subfolder would need a Vite `base`
and manifest path change.

For a quick look while testing, `npm run dev` prints a LAN URL. iPhone only allows
Add to Home Screen on HTTPS (or localhost), so the hosted link is the real path.

---

## Data and limits

- Book text, page snapshots, figures, chats, and progress live in the browser
  (IndexedDB + localStorage).
- No accounts, analytics, tracking, sync, or cloud backup.
- iOS Safari storage is tied to the site. Adding to the Home Screen helps keep
  it; clearing Safari data removes it. Keep the original PDFs in Files/Drive.
- Gemini can be wrong. The page citations and page snapshots are there so she
  can check the source.
- OCR and figure cropping can make mistakes. A full page snapshot is always
  available.
- Each teaching/chat turn resends the selected chapter text, so longer ranges
  cost more. Page images for OCR/figures are cached after the first time.
- This is a study aid, not clinical advice.

---

## Design notes

The teaching loop borrows ideas from
[DeepTutor](https://github.com/HKUDS/DeepTutor) (Apache-2.0): typed knowledge
points, short teach-back checks, error-aware follow-ups, and source-grounded
citations. It is an independent, much smaller React app.

PDFs are parsed and rendered with **PDF.js**. For figures, the heavy open-source
document pipelines (**MinerU**, **Docling**, **Marker**, **PyMuPDF**) all need a
Python/server-side process. To keep Cove a no-backend iPhone app, it renders the
page in the browser, asks Gemini where the visual is, and crops it locally.

---

## Development

```bash
npm run dev         # Vite dev server, phone frame on desktop
npm run typecheck   # TypeScript
npm run build       # static PWA in dist/
npm run preview     # serve the build
```

Stack: React 19, TypeScript, Vite, Dexie, PDF.js, Gemini REST/SSE,
`vite-plugin-pwa`.

```
src/
  views/Home.tsx        note list, upload, pages, key
  views/Lesson.tsx      ChatGPT-style lesson + Next + pictures
  components/           sheets, image viewer, visual thumbnails, markdown
  lib/                  PDFs, Gemini, plans, checks, OCR, figure crops
scripts/make-sample-pdf.py
```

The sample PDFs are synthetic. The diagram is drawn for this project; none of
it is clinical advice.

To regenerate the sample (optional):

```bash
python3 -m venv /tmp/cove-venv
/tmp/cove-venv/bin/pip install reportlab pillow
/tmp/cove-venv/bin/python scripts/make-sample-pdf.py
```

### Version history

- `backup-full-ui` — the earlier, feature-rich version with onboarding, setup
  questions, progress/review pages, and backups.
- `main` — the minimal ChatGPT-style flow above.
