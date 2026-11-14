import { useCallback, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowRight,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react";
import { BookCover } from "../components/BookCover";
import { Wordmark } from "../components/Brand";
import { AddBookSheet } from "../components/AddBookSheet";
import { db } from "../lib/db";
import { isDemoMode } from "../lib/ai";
import { bookSummary, lessonStats } from "../lib/progress";
import type { Book, Lesson } from "../lib/types";
import { timeGreeting } from "../lib/util";
import { useSettings } from "../state/settings";
import { useToast } from "../state/toast";

export function Library({ navigate }: { navigate: (path: string) => void }) {
  const { settings } = useSettings();
  const { show } = useToast();
  const books = useLiveQuery(
    () => db.books.orderBy("lastOpenedAt").reverse().toArray(),
    [],
    [] as Book[],
  );
  const lessons = useLiveQuery(() => db.lessons.toArray(), [], [] as Lesson[]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const demo = isDemoMode(settings);

  const continueLesson = useMemo(() => {
    return lessons
      .filter(
        (lesson) => lesson.status === "active" || lesson.status === "planning",
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }, [lessons]);

  const continueBook = continueLesson
    ? books.find((book) => book.id === continueLesson.bookId)
    : undefined;

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      show("That isn’t a PDF. Choose a PDF textbook.", "error");
      return;
    }
    setPendingFile(file);
  };

  const onBookAdded = useCallback(
    (book: Book) => {
      setPendingFile(null);
      navigate(`/book/${book.id}`);
    },
    [navigate],
  );

  return (
    <main className="page library">
      <header className="library-head">
        <div className="library-top">
          <Wordmark size={23} />
          <button
            type="button"
            className="avatar-button"
            onClick={() => navigate("/settings")}
            aria-label="Settings"
          >
            {settings.name ? settings.name.charAt(0).toUpperCase() : "•"}
          </button>
        </div>
        <p className="eyebrow">
          {timeGreeting()}
          {settings.name ? `, ${settings.name}` : ""}
        </p>
        <h1 className="display">What would you like to understand?</h1>
        <p className="lede">
          Pick a chapter. We’ll take it slowly, one idea at a time.
        </p>
      </header>

      {demo && (
        <button
          type="button"
          className="demo-banner"
          onClick={() => navigate("/settings")}
        >
          <span className="demo-icon">
            <Sparkles size={15} />
          </span>
          <span>
            {settings.apiKey
              ? "Preview mode is on. Turn it off to use Gemini."
              : "Preview mode — lessons are canned until you add a Gemini key."}
          </span>
          <ArrowRight size={15} />
        </button>
      )}

      {continueLesson && continueBook && (
        <ContinueCard
          lesson={continueLesson}
          book={continueBook}
          onOpen={() => navigate(`/lesson/${continueLesson.id}`)}
        />
      )}

      <section className="shelf-section" aria-labelledby="shelf-heading">
        <div className="section-head">
          <h2 id="shelf-heading" className="section-title">
            Your shelf
          </h2>
          {books.length > 0 && (
            <span className="section-count">
              {books.length} {books.length === 1 ? "book" : "books"}
            </span>
          )}
        </div>

        {books.length === 0 ? (
          <div className="empty-shelf">
            <button
              type="button"
              className="add-book-card add-book-card-large"
              onClick={() => fileRef.current?.click()}
            >
              <span className="add-book-icon">
                <Plus size={22} />
              </span>
              <span className="add-book-title">Your shelf is waiting.</span>
              <span className="add-book-copy">
                Add a PDF textbook. It stays on this device.
              </span>
            </button>
            <ol className="how-steps">
              <li>
                <span>01</span>
                Bring a chapter
              </li>
              <li>
                <span>02</span>
                Set your pace
              </li>
              <li>
                <span>03</span>
                Learn by talking
              </li>
            </ol>
          </div>
        ) : (
          <div className="book-list">
            {books.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                lessons={lessons.filter((lesson) => lesson.bookId === book.id)}
                onOpen={() => navigate(`/book/${book.id}`)}
              />
            ))}
            <button
              type="button"
              className="add-book-card"
              onClick={() => fileRef.current?.click()}
            >
              <span className="add-book-icon">
                <Plus size={18} />
              </span>
              <span className="add-book-inline">
                <span className="add-book-title">Add a textbook</span>
                <span className="add-book-copy">PDF · stays on this device</span>
              </span>
            </button>
          </div>
        )}
      </section>

      <p className="library-foot">
        A quiet little app for one very large book.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        onChange={onFile}
      />
      {pendingFile && (
        <AddBookSheet
          file={pendingFile}
          onClose={() => setPendingFile(null)}
          onDone={onBookAdded}
        />
      )}
    </main>
  );
}

function BookRow({
  book,
  lessons,
  onOpen,
}: {
  book: Book;
  lessons: Lesson[];
  onOpen: () => void;
}) {
  const summary = bookSummary(book.chapters.length, lessons);
  const hasProgress = summary.total > 0;

  return (
    <button type="button" className="book-row" onClick={onOpen}>
      <BookCover book={book} size="md" />
      <span className="book-copy">
        <span className="book-title">{book.title}</span>
        <span className="book-meta">
          {book.author ? `${book.author} · ` : ""}
          {book.pageCount} pages
        </span>
        {hasProgress ? (
          <span className="book-progress">
            <span className="progress-rail">
              <span
                className="progress-fill is-met"
                style={{ width: `${summary.percentCovered}%` }}
              />
              <span
                className="progress-fill is-mastered"
                style={{ width: `${summary.percentMastered}%` }}
              />
            </span>
            <span className="book-progress-label">
              <span>
                {summary.covered} of {summary.total} ideas
              </span>
              <span>{summary.mastered} landed</span>
            </span>
          </span>
        ) : (
          <span className="book-meta is-quiet">Ready when you are</span>
        )}
      </span>
      <ChevronRight size={19} className="row-chevron" aria-hidden="true" />
    </button>
  );
}

function ContinueCard({
  lesson,
  book,
  onOpen,
}: {
  lesson: Lesson;
  book: Book;
  onOpen: () => void;
}) {
  const stats = lessonStats(lesson);
  const planning = lesson.plan.length === 0;

  return (
    <button type="button" className="continue-card" onClick={onOpen}>
      <div className="continue-top">
        <span className="continue-eyebrow">
          {planning ? "Getting ready" : "Pick up where you left off"}
        </span>
        <span className="continue-arrow" aria-hidden="true">
          <ArrowRight size={17} />
        </span>
      </div>
      <span className="continue-title">{lesson.chapterTitle}</span>
      <span className="continue-meta">
        {book.title} · idea {Math.min(lesson.currentIndex + 1, Math.max(stats.total, 1))}
        {stats.total > 0 ? ` of ${stats.total}` : ""}
      </span>
      {stats.total > 0 && (
        <span className="continue-progress">
          <span className="progress-rail is-on-dark">
            <span
              className="progress-fill is-met"
              style={{ width: `${stats.percentCovered}%` }}
            />
            <span
              className="progress-fill is-mastered"
              style={{ width: `${stats.percentMastered}%` }}
            />
          </span>
        </span>
      )}
    </button>
  );
}
