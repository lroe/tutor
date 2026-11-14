import { readPageImage, isDemoMode } from "./ai";
import { db, pagesFor } from "./db";
import { renderPageImage, withPdf } from "./pdf";
import type { Book, Settings } from "./types";
import { AIError } from "./gemini";

const MAX_PAGES_PER_PASS = 60;

export interface OcrProgress {
  done: number;
  total: number;
  pageNo: number;
}

export async function readScannedPages(args: {
  book: Book;
  startPage: number;
  endPage: number;
  settings: Settings;
  onProgress: (progress: OcrProgress) => void;
  signal?: AbortSignal;
}): Promise<number> {
  const { book, startPage, endPage, settings, onProgress, signal } = args;
  if (isDemoMode(settings)) {
    throw new AIError(
      "Reading scanned pages needs a Gemini key. Add one in Settings, then try again.",
    );
  }
  const pages = await pagesFor(book.id, startPage, endPage);
  const blank = pages
    .filter((page) => page.text.replace(/\s+/g, "").length < 40)
    .map((page) => page.pageNo)
    .sort((a, b) => a - b);
  if (!blank.length) return 0;
  if (blank.length > MAX_PAGES_PER_PASS) {
    throw new AIError(
      `That's ${blank.length} image-only pages. Select a smaller range (up to ${MAX_PAGES_PER_PASS} pages) and read them in one pass.`,
    );
  }

  const stored = await db.files.get(book.id);
  if (!stored) {
    throw new AIError(
      "The original PDF isn't on this device anymore, so Cove can't re-read these pages. Add the book again to restore it.",
    );
  }

  let done = 0;
  await withPdf(stored.blob, async (document) => {
    for (const pageNo of blank) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const dataUrl = await renderPageImage(document, pageNo, {
        maxWidth: 1500,
        maxHeight: 2100,
        quality: 0.82,
      });
      const text = await readPageImage({
        settings,
        imageDataUrl: dataUrl,
        pageNo,
        signal,
      });
      await db.pages.put({
        id: `${book.id}:${pageNo}`,
        bookId: book.id,
        pageNo,
        text,
        source: "ocr",
      });
      const latest = await db.books.get(book.id);
      if (latest) {
        await db.books.put({
          ...latest,
          scannedPages: latest.scannedPages.filter((page) => page !== pageNo),
        });
      }
      done += 1;
      onProgress({ done, total: blank.length, pageNo });
    }
  });
  return done;
}
