import { db } from "./db";
import { extractPdf } from "./pdf";
import { DEFAULT_MODE } from "./modes";
import type { Book, Chapter, Lesson } from "./types";
import { uid } from "./util";

export async function addBook(
  file: File,
  options: {
    onProgress?: (done: number, total: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<Book> {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("Cove needs a PDF textbook.");
  }
  if (file.size === 0) {
    throw new Error("That file is empty.");
  }

  const id = uid();
  const extracted = await extractPdf(id, file, {
    signal: options.signal,
    onProgress: options.onProgress,
  });
  const now = Date.now();
  const book: Book = {
    id,
    title: extracted.title,
    author: extracted.author,
    fileName: file.name,
    pageCount: extracted.pageCount,
    sizeBytes: file.size,
    cover: extracted.cover,
    createdAt: now,
    lastOpenedAt: now,
    chapters: extracted.chapters,
    chapterSource: extracted.chapterSource,
    scannedPages: extracted.scannedPages,
    extracted: true,
  };

  await db.transaction("rw", [db.books, db.pages, db.files], async () => {
    await db.books.put(book);
    await db.pages.bulkPut(extracted.pages);
    await db.files.put({
      bookId: id,
      blob: file,
      mime: file.type || "application/pdf",
    });
  });
  return book;
}

export async function latestLessonForChapter(
  bookId: string,
  chapterId: string,
): Promise<Lesson | undefined> {
  const lessons = await db.lessons
    .where("bookId")
    .equals(bookId)
    .filter((lesson) => lesson.chapterId === chapterId)
    .toArray();
  lessons.sort((a, b) => b.updatedAt - a.updatedAt);
  return lessons[0];
}

export async function openLesson(
  book: Book,
  chapter: Chapter,
): Promise<Lesson> {
  const existing = await latestLessonForChapter(book.id, chapter.id);
  const now = Date.now();
  await db.books.update(book.id, { lastOpenedAt: now });
  if (existing) return existing;

  const lesson: Lesson = {
    id: uid(),
    bookId: book.id,
    bookTitle: book.title,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    startPage: chapter.startPage,
    endPage: chapter.endPage,
    plan: [],
    currentIndex: 0,
    status: "planning",
    mode: DEFAULT_MODE,
    createdAt: now,
    updatedAt: now,
  };
  await db.lessons.put(lesson);
  return lesson;
}

export function customChapter(startPage: number, endPage: number): Chapter {
  return {
    id: `custom:${startPage}-${endPage}`,
    title:
      startPage === endPage
        ? `Page ${startPage}`
        : `Pages ${startPage}–${endPage}`,
    startPage,
    endPage,
  };
}

export async function activeLessons(): Promise<Lesson[]> {
  const lessons = await db.lessons
    .where("status")
    .anyOf(["active", "planning"])
    .toArray();
  return lessons.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function renameBook(bookId: string, title: string): Promise<void> {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 140);
  if (!clean) return;
  await db.books.update(bookId, { title: clean });
}
