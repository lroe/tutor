import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  FileImage,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { BookCover } from "../components/BookCover";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageRangeSheet } from "../components/PageRangeSheet";
import { PageTopBar } from "../components/PageTopBar";
import { ScanPagesSheet } from "../components/ScanPagesSheet";
import { Sheet } from "../components/Sheet";
import { Spinner } from "../components/Brand";
import { StartLessonSheet } from "../components/StartLessonSheet";
import { db, deleteBookDeep, pagesFor } from "../lib/db";
import {
  customChapter,
  latestLessonForChapter,
  openLesson,
  renameBook,
} from "../lib/library";
import { lessonForChapter, lessonStats } from "../lib/progress";
import type { Chapter, LearnerProfile, Lesson } from "../lib/types";
import { cx, pageCountLabel } from "../lib/util";
import { useSettings } from "../state/settings";
import { useToast } from "../state/toast";

export function BookView({
  id,
  navigate,
}: {
  id: string;
  navigate: (path: string) => void;
}) {
  const { settings } = useSettings();
  const { show } = useToast();
  const book = useLiveQuery(() => db.books.get(id), [id]);
  const lessons = useLiveQuery(
    () => db.lessons.where("bookId").equals(id).toArray(),
    [id],
    [] as Lesson[],
  );
  const [checkingChapterId, setCheckingChapterId] = useState<string | null>(
    null,
  );
  const [setupChapter, setSetupChapter] = useState<Chapter | null>(null);
  const [scanState, setScanState] = useState<{
    chapter: Chapter;
    blank: number;
  } | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (book === undefined) {
    return (
      <main className="page book-page">
        <PageTopBar onBack={() => navigate("/")} />
        <div className="loading-block">
          <Spinner size={22} />
          <span>Opening the book…</span>
        </div>
      </main>
    );
  }

  if (book === null) {
    return (
      <main className="page book-page">
        <PageTopBar title="Book" onBack={() => navigate("/")} />
        <div className="empty-state">
          <h1 className="display-sm">This book isn’t here anymore.</h1>
          <p className="body-text">It may have been deleted from the shelf.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/")}>
            Back to the library
          </button>
        </div>
      </main>
    );
  }

  const activeLesson = lessons
    .filter(
      (lesson) => lesson.status === "active" || lesson.status === "planning",
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const scannedCount = book.scannedPages.length;

  const openChapter = async (chapter: Chapter) => {
    if (checkingChapterId) return;
    const existing = await latestLessonForChapter(book.id, chapter.id);
    if (existing) {
      navigate(`/lesson/${existing.id}`);
      return;
    }
    setCheckingChapterId(chapter.id);
    try {
      const pages = await pagesFor(book.id, chapter.startPage, chapter.endPage);
      const blank = pages.filter(
        (page) => page.text.replace(/\s+/g, "").length < 40,
      ).length;
      if (blank > 0) {
        setScanState({ chapter, blank });
      } else {
        setSetupChapter(chapter);
      }
    } catch {
      show("Cove couldn’t open those pages. Try again.", "error");
    } finally {
      setCheckingChapterId(null);
    }
  };

  const start = async (profile: LearnerProfile) => {
    if (!setupChapter) return;
    const chapter = setupChapter;
    setSetupChapter(null);
    try {
      const lesson = await openLesson(book, chapter, profile);
      navigate(`/lesson/${lesson.id}`);
    } catch {
      show("Couldn’t start that lesson. Try again.", "error");
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    setBusy(true);
    try {
      await renameBook(book.id, renameValue);
      setRenameOpen(false);
      show("Book renamed.", "success");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteBookDeep(book.id);
      setDeleteOpen(false);
      show("Book removed from the shelf.");
      navigate("/");
    } finally {
      setBusy(false);
    }
  };

  const chapterIndex = book.chapters.findIndex(
    (chapter) => chapter.id === setupChapter?.id,
  );

  return (
    <main className="page book-page">
      <PageTopBar
        onBack={() => navigate("/")}
        action={
          <button
            type="button"
            className="icon-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Book options"
          >
            <MoreHorizontal size={21} />
          </button>
        }
      />

      <header className="book-head">
        <BookCover book={book} size="lg" />
        <div className="book-head-copy">
          <p className="eyebrow">
            {book.pageCount} {book.pageCount === 1 ? "page" : "pages"} ·{" "}
            {book.chapters.length}{" "}
            {book.chapterSource === "ranges"
              ? book.chapters.length === 1
                ? "section"
                : "sections"
              : book.chapters.length === 1
                ? "chapter"
                : "chapters"}
          </p>
          <h1 className="book-title-lg">{book.title}</h1>
          {book.author && <p className="book-author">{book.author}</p>}
        </div>
      </header>

      {scannedCount > 0 && (
        <div className="scan-note">
          <FileImage size={16} aria-hidden="true" />
          <span>
            {scannedCount} {scannedCount === 1 ? "page is" : "pages are"}{" "}
            image-only. Cove can read them with Gemini when you start a chapter.
          </span>
        </div>
      )}

      {activeLesson && (
        <button
          type="button"
          className="resume-strip"
          onClick={() => navigate(`/lesson/${activeLesson.id}`)}
        >
          <span className="resume-copy">
            <span className="resume-eyebrow">Continue</span>
            <span className="resume-title">{activeLesson.chapterTitle}</span>
          </span>
          <ArrowRight size={18} />
        </button>
      )}

      <section className="chapter-section" aria-labelledby="chapters-heading">
        <div className="section-head">
          <h2 id="chapters-heading" className="section-title">
            {book.chapterSource === "ranges" ? "Sections" : "Chapters"}
          </h2>
          <span className="section-count">{book.chapters.length}</span>
        </div>
        {book.chapterSource === "ranges" && (
          <p className="notes">
            Cove couldn’t find a table of contents, so it made its own
            sections. You can also choose your own pages below.
          </p>
        )}

        <div className="chapter-list">
          {book.chapters.map((chapter, index) => {
            const lesson = lessonForChapter(lessons, chapter.id);
            const stats = lesson ? lessonStats(lesson) : null;
            const checking = checkingChapterId === chapter.id;
            return (
              <button
                key={chapter.id}
                type="button"
                className={cx("chapter-row", lesson && "has-lesson")}
                onClick={() => openChapter(chapter)}
                disabled={Boolean(checkingChapterId)}
              >
                <span className="chapter-index">
                  {index + 1 < 10 ? `0${index + 1}` : index + 1}
                </span>
                <span className="chapter-copy">
                  <span className="chapter-title">{chapter.title}</span>
                  <span className="chapter-pages">
                    {pageCountLabel(chapter.startPage, chapter.endPage)}
                  </span>
                  {stats && stats.total > 0 && (
                    <span className="chapter-progress">
                      <span className="progress-rail progress-rail-sm">
                        <span
                          className="progress-fill is-met"
                          style={{ width: `${stats.percentCovered}%` }}
                        />
                        <span
                          className="progress-fill is-mastered"
                          style={{ width: `${stats.percentMastered}%` }}
                        />
                      </span>
                      <span className="chapter-progress-label">
                        {stats.covered === stats.total ? (
                          <>
                            <Check size={12} />
                            {stats.mastered} of {stats.total} landed
                          </>
                        ) : (
                          <>
                            {stats.covered} of {stats.total} ideas
                          </>
                        )}
                      </span>
                    </span>
                  )}
                </span>
                <span className="chapter-end">
                  {checking ? (
                    <Spinner size={17} />
                  ) : (
                    <ChevronRight size={18} aria-hidden="true" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        className="range-card"
        onClick={() => setRangeOpen(true)}
      >
        <span className="range-card-icon">
          <BookOpen size={19} />
        </span>
        <span className="range-card-copy">
          <span className="range-card-title">Choose your own pages</span>
          <span className="range-card-sub">
            One passage, a set of lecture notes, or the whole book.
          </span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      <p className="privacy-note">
        <Lock size={13} aria-hidden="true" />
        <span>
          This PDF stays on this device. Starting a lesson sends the selected
          pages to Gemini to teach and to find their figures.
        </span>
      </p>

      {setupChapter && (
        <StartLessonSheet
          chapter={setupChapter}
          chapterIndex={chapterIndex >= 0 ? chapterIndex : undefined}
          chapterCount={book.chapters.length}
          onClose={() => setSetupChapter(null)}
          onStart={start}
        />
      )}
      {scanState && (
        <ScanPagesSheet
          book={book}
          chapter={scanState.chapter}
          blankCount={scanState.blank}
          settings={settings}
          onClose={() => setScanState(null)}
          onReady={() => {
            const chapter = scanState.chapter;
            setScanState(null);
            setSetupChapter(chapter);
          }}
        />
      )}
      {rangeOpen && (
        <PageRangeSheet
          pageCount={book.pageCount}
          onClose={() => setRangeOpen(false)}
          onStart={(startPage, endPage) => {
            setRangeOpen(false);
            openChapter(customChapter(startPage, endPage));
          }}
        />
      )}

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="This book"
        footer={
          <button
            type="button"
            className="btn btn-ghost btn-full"
            onClick={() => setMenuOpen(false)}
          >
            Close
          </button>
        }
      >
        <div className="menu-list">
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setRenameValue(book.title);
              setMenuOpen(false);
              setRenameOpen(true);
            }}
          >
            <Pencil size={17} />
            Rename this book
          </button>
          <button
            type="button"
            className="menu-item is-danger"
            onClick={() => {
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          >
            <Trash2 size={17} />
            Remove from the shelf
          </button>
        </div>
        <p className="fineprint">
          Removing a book also removes its lessons and progress from this
          device. This cannot be undone.
        </p>
      </Sheet>

      <Sheet
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename this book"
        footer={
          <div className="button-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRename}
              disabled={busy || !renameValue.trim()}
            >
              Save
            </button>
          </div>
        }
      >
        <label className="field">
          <span className="field-label">Book title</span>
          <input
            type="text"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            maxLength={140}
            autoFocus
          />
        </label>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        title="Remove this book?"
        message={`“${book.title}” and all of its lessons will be deleted from this device. The original PDF on your computer is untouched.`}
        confirmLabel="Remove"
        danger
        busy={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </main>
  );
}
