import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Settings as SettingsIcon } from "lucide-react";
import { Wordmark } from "../components/Brand";
import { KeySheet } from "../components/KeySheet";
import { PageSheet } from "../components/PageSheet";
import { UploadOverlay } from "../components/UploadOverlay";
import { db } from "../lib/db";
import { customChapter, openLesson } from "../lib/library";
import type { Book, Lesson } from "../lib/types";
import { useSettings } from "../state/settings";

export function Home({ navigate }: { navigate: (path: string) => void }) {
  const { settings, update } = useSettings();
  const books = useLiveQuery(
    () => db.books.orderBy("lastOpenedAt").reverse().toArray(),
    [],
    [] as Book[],
  );
  const lessons = useLiveQuery(
    () => db.lessons.toArray(),
    [],
    [] as Lesson[],
  );

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pageBook, setPageBook] = useState<Book | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [pending, setPending] = useState<{
    book: Book;
    start: number;
    end: number;
  } | null>(null);
  const [homeError, setHomeError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const countFor = (bookId: string) =>
    lessons
      .filter((lesson) => lesson.bookId === bookId)
      .reduce(
        (sum, lesson) =>
          sum + lesson.plan.filter((concept) => concept.covered).length,
        0,
      );

  const activeLessonFor = (bookId: string) =>
    lessons
      .filter(
        (lesson) =>
          lesson.bookId === bookId &&
          (lesson.status === "active" ||
          lesson.status === "planning" ||
          lesson.status === "error"),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  const startLesson = useCallback(
    async (book: Book, startPage: number, endPage: number) => {
      const lesson = await openLesson(book, customChapter(startPage, endPage));
      setPageBook(null);
      navigate(`/lesson/${lesson.id}`);
    },
    [navigate],
  );

  useEffect(() => {
    if (!pending || !settings.apiKey.trim()) return;
    const queued = pending;
    setPending(null);
    void startLesson(queued.book, queued.start, queued.end);
  }, [pending, settings.apiKey, startLesson]);

  const openNote = (book: Book) => {
    setHomeError("");
    const active = activeLessonFor(book.id);
    if (active) {
      navigate(`/lesson/${active.id}`);
      return;
    }
    setPageBook(book);
  };

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setHomeError("Choose a PDF.");
      return;
    }
    setHomeError("");
    setUploadFile(file);
  };

  const build = (startPage: number, endPage: number) => {
    if (!pageBook) return;
    if (!settings.apiKey.trim()) {
      setPending({ book: pageBook, start: startPage, end: endPage });
      setPageBook(null);
      setKeyOpen(true);
      return;
    }
    void startLesson(pageBook, startPage, endPage);
  };

  const saveKey = (key: string) => {
    update({ apiKey: key });
    setKeyOpen(false);
  };

  const closeKey = () => {
    setKeyOpen(false);
    setPending(null);
  };

  return (
    <main className="home">
      <header className="home-bar">
        <Wordmark />
        <button
          type="button"
          className="icon-button"
          onClick={() => setKeyOpen(true)}
          aria-label="Settings"
        >
          <SettingsIcon size={19} />
        </button>
      </header>

      <div className="home-scroll">
        {books.length === 0 ? (
          <div className="home-empty">No notes yet</div>
        ) : (
          <div className="note-list">
            {books.map((book) => {
              const count = countFor(book.id);
              return (
                <button
                  key={book.id}
                  type="button"
                  className="note-row"
                  onClick={() => openNote(book)}
                >
                  <span className="note-title">{book.title}</span>
                  <span className="note-count">
                    {count > 0
                      ? `${count} ${count === 1 ? "idea" : "ideas"} learned`
                      : "No ideas yet"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {homeError && <p className="home-error">{homeError}</p>}

      <button
        type="button"
        className="upload-bar"
        onClick={() => fileRef.current?.click()}
      >
        <Plus size={20} />
        <span>Upload a note</span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        onChange={onFile}
      />

      {uploadFile && (
        <UploadOverlay
          file={uploadFile}
          onClose={() => setUploadFile(null)}
          onDone={(book) => {
            setUploadFile(null);
            setPageBook(book);
          }}
        />
      )}

      {pageBook && (
        <PageSheet
          book={pageBook}
          onClose={() => setPageBook(null)}
          onBuild={build}
        />
      )}

      {keyOpen && (
        <KeySheet
          hasKey={Boolean(settings.apiKey)}
          onClose={closeKey}
          onSave={saveKey}
        />
      )}
    </main>
  );
}
