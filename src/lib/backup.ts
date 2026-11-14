import { db } from "./db";
import type {
  Activity,
  Book,
  Figure,
  Lesson,
  Message,
  PageImage,
  PageText,
} from "./types";

const APP = "cove";
const VERSION = 1;

export interface BackupData {
  app: typeof APP;
  version: number;
  exportedAt: number;
  books: Book[];
  pages: PageText[];
  pageImages?: PageImage[];
  figures?: Figure[];
  lessons: Lesson[];
  messages: Message[];
  activity: Activity[];
  includesSourcePdfs: false;
}

export async function buildBackup(): Promise<BackupData> {
  const [books, pages, pageImages, figures, lessons, messages, activity] =
    await Promise.all([
      db.books.toArray(),
      db.pages.toArray(),
      db.pageImages.toArray(),
      db.figures.toArray(),
      db.lessons.toArray(),
      db.messages.toArray(),
      db.activity.toArray(),
    ]);
  return {
    app: APP,
    version: VERSION,
    exportedAt: Date.now(),
    books,
    pages,
    pageImages,
    figures,
    lessons,
    messages,
    activity,
    includesSourcePdfs: false,
  };
}

export async function downloadBackup(): Promise<number> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `cove-backup-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob.size;
}

export interface ImportSummary {
  books: number;
  lessons: number;
  messages: number;
}

export async function importBackup(file: File): Promise<ImportSummary> {
  const raw = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't a Cove backup.");
  }
  const backup = parsed as Partial<BackupData>;
  if (
    backup?.app !== APP ||
    backup.version !== VERSION ||
    !Array.isArray(backup.books) ||
    !Array.isArray(backup.pages) ||
    !Array.isArray(backup.lessons) ||
    !Array.isArray(backup.messages)
  ) {
    throw new Error("That file isn't a Cove backup, or it came from a newer version.");
  }

  const books = backup.books.filter(
    (book): book is Book =>
      typeof book?.id === "string" &&
      typeof book.title === "string" &&
      Array.isArray(book.chapters),
  );
  if (!books.length && backup.books.length) {
    throw new Error("The backup's book data looks damaged.");
  }
  const bookIds = new Set(books.map((book) => book.id));
  const lessons = (backup.lessons as Lesson[]).filter(
    (lesson) =>
      typeof lesson?.id === "string" && bookIds.has(lesson.bookId),
  );
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  const messages = (backup.messages as Message[]).filter(
    (message) =>
      typeof message?.lessonId === "string" && lessonIds.has(message.lessonId),
  );
  const pages = (backup.pages as PageText[]).filter(
    (page) => typeof page?.bookId === "string" && bookIds.has(page.bookId),
  );
  const activity = Array.isArray(backup.activity)
    ? (backup.activity as Activity[]).filter(
        (entry) => typeof entry?.date === "string",
      )
    : [];
  const pageImages = Array.isArray(backup.pageImages)
    ? (backup.pageImages as PageImage[]).filter(
        (image) =>
          typeof image?.bookId === "string" &&
          bookIds.has(image.bookId) &&
          typeof image.dataUrl === "string",
      )
    : [];
  const figures = Array.isArray(backup.figures)
    ? (backup.figures as Figure[]).filter(
        (figure) =>
          typeof figure?.bookId === "string" &&
          bookIds.has(figure.bookId) &&
          typeof figure.dataUrl === "string",
      )
    : [];

  await db.transaction(
    "rw",
    [
      db.books,
      db.files,
      db.pages,
      db.pageImages,
      db.figures,
      db.lessons,
      db.messages,
      db.activity,
    ],
    async () => {
      await Promise.all([
        db.books.clear(),
        db.files.clear(),
        db.pages.clear(),
        db.pageImages.clear(),
        db.figures.clear(),
        db.lessons.clear(),
        db.messages.clear(),
        db.activity.clear(),
      ]);
      await db.books.bulkPut(books);
      await db.pages.bulkPut(pages);
      if (pageImages.length) await db.pageImages.bulkPut(pageImages);
      if (figures.length) await db.figures.bulkPut(figures);
      await db.lessons.bulkPut(lessons);
      await db.messages.bulkPut(messages);
      await db.activity.bulkPut(activity);
    },
  );

  return {
    books: books.length,
    lessons: lessons.length,
    messages: messages.length,
  };
}
