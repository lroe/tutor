# Cove

A very small, ChatGPT-style tutor for your notes.

Upload a PDF or PowerPoint, choose the pages or slides, press **Build lesson**,
and Cove teaches one idea at a time. It asks a quick question, answers your own questions, and places the
actual diagram from the page inline at the point where it belongs. The home
screen lists each note and how many ideas you've learned. Tap a note to see its
full concept list and start another page range.

No account. No onboarding questions. No settings screens full of options. No app
server or database.

---

## What it uses

- **Default:** OpenCode Go → **DeepSeek V4.1 Flash**, through a tiny Cloudflare
  Worker. The Worker holds your Go key, so the key never ships in the app.
- **Optional:** Gemini 3.8 Flash, called directly from the browser. Switch to it
  in Settings and paste a Gemini key.

The phone only stores the Worker URL and your notes. The Go key stays in
Cloudflare.

---

## Deploy the Worker (once)

The Worker is a free proxy. It adds your OpenCode Go key and the CORS header
Safari needs. Full details are in [worker/README.md](worker/README.md).

1. Copy your API key from https://opencode.ai/console. In **Settings →
   Privacy → Regions**, enable **Global** for DeepSeek V4.1 Flash. Without it,
   OpenCode Go can reject DeepSeek requests.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Worker**.
3. Name it `cove-proxy`, deploy, then paste [worker/index.js](worker/index.js)
   into the code editor and deploy again.
4. **Settings → Variables and Secrets**:
   - `OPENCODE_API_KEY` — type **Secret**, value = your Go key.
   - `ALLOWED_ORIGIN` — optional but recommended, e.g.
     `https://your-site.netlify.app,http://localhost:5173`.
5. Copy the Worker URL, e.g. `https://cove-proxy.you.workers.dev`.
6. Open `<worker-url>/health`. You should see `{"ok":true,...}`.

Free plan: 100,000 requests/day, no credit card. A lesson is roughly 10–20
requests.

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

To pre-fill the Worker URL in the build:

```bash
cp .env.example .env.local
# edit .env.local, then:
npm run build
```

Or leave it out and paste the URL in the app's Settings once.

Production build:

```bash
npm run build     # static files in dist/
npm run preview   # serve the build at localhost:4173
```

Three sample notes are in `sample/`:

| File | What it tests |
| --- | --- |
| `tooth-anatomy-sample.pdf` | Text + a diagram. Upload, pages, teaching, pictures. |
| `tooth-anatomy-sample.pptx` | PowerPoint text + embedded image + image-only slide. |
| `Scanned Page Sample.pdf` | Image-only page. Tests the automatic OCR. |

---

## The whole app

1. **Upload a note** with the bar at the bottom. PDF and `.pptx` both work.
2. **Pick pages or slides** — From / To — and tap **Build lesson**.
3. Read the teaching. Type an answer or any question in the message box.
4. Tap **Next** when you're ready for the next idea. On the last idea it says
   **Finish**.
5. You land on the note's **Progress** page.

### Titles

Cove makes a title when you upload:

- PDF: embedded title, then the first page heading, then the file name.
- PowerPoint: the document title, then the first slide title, then the file
  name.

Tap the title on the note’s Progress page to rename it. The pencil is there so
the title is not a hidden feature.

### Learning modes

Every new lesson starts in **ELI5 + textbook** mode. Tap the mode chip above
the message box to switch:

- **ELI5 + textbook** — simple first, then the textbook version and check
  question in the next message. **Default.**
- **ELI5** — everyday words and one concrete analogy.
- **Textbook** — plain language first, then the proper term.
- **Socratic** — one short orientation, then a question that makes you reason.
- **First principles** — build from basic facts, step by step.
- **Clinical** — start with a patient scenario, then the mechanism.
- **Exam** — high-yield distinctions and memory hooks.

In the default mode, the first message explains the idea simply, with the
diagram. The next message gives the same idea in precise textbook language, then
asks the check question. There is no “restated” label and no repeated question.

The mode belongs to that lesson only. A new page range starts fresh.

You can also type a style in chat, for example **“ELI5”**, **“teach like a
textbook”**, or **“shorter”**. Cove remembers the latest style request for the
rest of that lesson, even after you change the mode. There is no persona
setting and nothing is stored across lessons.

### Progress for each note

Tap any note on home. Its Progress page shows:

- **N ideas learned**.
- **Continue lesson** if a lesson is in progress.
- **New pages** — start a different page range for the same note.
- **Hide concepts / Show concepts** — collapse the concept lists when you only
  want the page ranges.
- Every lesson range, newest used first, with every concept listed and checked
  off as you learn it.
- **Delete note** — the trash icon in the header removes the PDF, lessons, and
  progress from this device.

The home note list is the overview, sorted by the note you opened last, with the
latest page range under the title. Starting **New pages** creates another lesson
group on the same page, so a note can have several ranges over time.

The tutor still asks a short check after each idea. You can answer it, ask
something else, or skip it with **Next**. When you get something wrong, it gives
a small correction and a follow-up question.

### Settings

There is one Settings sheet, opened from the gear on home or when you build a
lesson without a provider:

- **Provider:** OpenCode Go (default) or Gemini.
- **Worker URL** for OpenCode Go. Paste the `*.workers.dev` URL from the Worker
  deployment. **Test connection** checks `/health`.
- **Gemini API key** only if you switch to Gemini. It is stored on that device.

Models are fixed: `deepseek-v4.1-flash` for OpenCode Go, `gemini-3.8-flash` for
Gemini. There is no model picker.

---

## Pictures from the note

- PDF page snapshots are rendered locally with **PDF.js**.
- PowerPoint text and embedded images are extracted locally from the `.pptx`
  file. The largest embedded image on each slide becomes that slide’s visual.
- For PDFs, the selected model's vision finds figures/diagrams/tables on the
  page and returns boxes; Cove crops those regions locally and caches them.
- PowerPoint slides do not need a vision call for their embedded images.
- The teaching prompt places a figure token at the exact point where the visual
  belongs. Cove renders the cropped diagram inline there, between the paragraphs.
- Cove shows only real cropped figures. It never substitutes a full page for a
  diagram, so a text-only page cannot appear as a picture.
- The same figure is shown once in a lesson’s teaching messages, not repeated in
  every message. You can still ask **"show that figure"** in chat.
- Page citations are kept out of the prose. They appear once in a small `p. 5`
  footer at the bottom of the message.
- Tap the diagram to view it full screen.
- Scanned/image-only PDF pages and image-only PowerPoint slides are OCR'd
  automatically when you build a lesson.
- Selected text and page/slide images go to the model. The original file stays
  on the device.

DeepSeek V4.1 Flash accepts images. If its figure boxes are less accurate than
Gemini's, switch providers for that note.

---

## Put it on her iPhone

Cove is a **PWA**. This is the free path — no Apple developer account, no
TestFlight, no App Store, no Mac.

1. Deploy the Worker (above).
2. Build:

   ```bash
   VITE_COVE_PROXY_URL=https://cove-proxy.you.workers.dev npm run build
   ```

   Or build without it and paste the Worker URL in Cove's Settings later.

3. Upload the `dist/` folder to a static host with HTTPS:
   - **Netlify Drop** — https://app.netlify.com/drop (drag `dist/`)
   - **Cloudflare Pages** — direct upload
   - **GitHub Pages** — easiest as a root site
   - **Vercel** — static project
4. On her iPhone: open the HTTPS link in **Safari** → **Share → Add to Home
   Screen → Add**.
5. Open Cove from its icon. If the Worker URL wasn't baked in, paste it from the
   gear.

The static host only serves files. The Worker only proxies model calls. There is
no database. The app shell is cached, so stored notes open offline; the model
needs the network.

Use a **root URL** (e.g. `cove.netlify.app`). The manifest and service worker are
configured for `/`. A GitHub Pages project subfolder would need a Vite `base`
and manifest path change.

For a quick look while testing, `npm run dev` prints a LAN URL. iPhone only allows
Add to Home Screen on HTTPS (or localhost), so the hosted link is the real path.

---

## What it costs

- **Cloudflare Worker:** $0 on the free plan (100k requests/day).
- **OpenCode Go:** you already pay $10/month. Cove's usage counts toward the
  included Go allowance. DeepSeek V4.1 Flash is $0.15/$0.60 per million tokens
  off-peak and $0.30/$1.20 peak, with a $100 monthly allowance on Go.
- **Gemini:** free tier is $0. Paid Gemini 3.8 Flash is $0.75/$3.75 per million
  tokens through Dec 31, 2026.
- **Apple:** $0.

For one student, Cove on DeepSeek is likely under $1/month of usage. The Go
subscription is the bigger cost, and you already have it for coding.

---

## Data and limits

- Book text, page/slide snapshots, figures, chats, and progress live in the
  browser (IndexedDB + localStorage).
- No accounts, analytics, tracking, sync, or cloud backup.
- iOS Safari storage is tied to the site. Adding to the Home Screen helps keep
  it; clearing Safari data removes it. Keep the original files in Files/Drive.
- The model can be wrong. The page citations in each message are there so she
  can check the source PDF.
- OCR and figure cropping can make mistakes. Tap a diagram to open it full
  screen. If a page has no real visual, Cove shows no picture rather than a fake
  one.
- Each teaching/chat turn resends the selected chapter text, so longer ranges
  cost more. Page images for OCR/figures are cached after the first time.
- The Worker sees the prompts and page images it forwards. Cloudflare does not
  store them, but it is a proxy you control.
- **OpenCode Go is intended for coding agents.** Cove sends tutoring traffic
  through it. That is fine for personal use, but outside the stated purpose.
  Keep the Worker private, set `ALLOWED_ORIGIN`, and do not publish a shared
  proxy.
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
page in the browser, asks the model where the visual is, and crops it locally.

The default provider is an OpenAI-compatible client pointed at a Cloudflare
Worker. The Worker forwards to OpenCode Go's inference API. Gemini remains a
direct browser provider.

---

## Development

```bash
npm run dev         # Vite dev server, phone frame on desktop
npm run typecheck   # TypeScript
npm run build       # static PWA in dist/
npm run preview     # serve the build
```

Stack: React 19, TypeScript, Vite, Dexie, PDF.js, JSZip, OpenCode Go
(OpenAI-compatible), Gemini REST/SSE, `vite-plugin-pwa`, Cloudflare Workers.

```
src/
  views/Home.tsx        note list, upload, settings
  views/Note.tsx        per-note progress and new page ranges
  views/Lesson.tsx      ChatGPT-style lesson + Next + inline figures
  components/           sheets, image viewer, settings, markdown
  lib/opencode.ts       OpenAI-compatible client through the Worker
  lib/gemini.ts         direct Gemini client
  lib/llm.ts            provider switch
  lib/pptx.ts           PowerPoint text, slide images, and figures
  lib/                  PDFs, plans, checks, OCR, figure crops
worker/
  index.js              Cloudflare Worker proxy
  wrangler.toml         Worker config for CLI deploys
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
- `main` — the minimal ChatGPT-style flow, now defaulting to OpenCode Go
  DeepSeek through a Worker proxy.
