import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Check, ChevronRight, Circle } from "lucide-react";
import { KeySheet } from "../components/KeySheet";
import { PageSheet } from "../components/PageSheet";
import { Spinner } from "../components/Brand";
import { db } from "../lib/db";
import { customChapter, openLesson } from "../lib/library";
import type { Book, Lesson } from "../lib/types";
import { useSettings } from "../state/settings";

export function Note({
  id,
  autoPages,
  navigate,
}: {
  id: string;
  autoPages: boolean;
  navigate: (path: string) => void;
}) {
  const { settings, update } = useSettings();
  const book = useLiveQuery(() => db.books.get(id), [id]);
  const lessons = useLiveQuery(
    () => db.lessons.where("bookId").equals(id).toArray(),
    [id],
    [] as Lesson[],
  );
  const [pageOpen, setPageOpen] = useState(Boolean(autoPages));
  const [keyOpen, setKeyOpen] = useState(false);
  const [pending, setPending] = useState<{
    book: Book;
    start: number;
    end: number;
  } | null>(null);

  const startLesson = useCallback(
    async (target: Book, startPage: number, endPage: number) => {
      const lesson = await openLesson(target, customChapter(startPage, endPage));
      setPageOpen(false);
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

  const build = (startPage: number, endPage: number) => {
    if (!book) return;
    if (!settings.apiKey.trim()) {
      setPageOpen(false);
      setPending({ book, start: startPage, end: endPage });
      setKeyOpen(true);
      return;
    }
    void startLesson(book, startPage, endPage);
  };

  const saveKey = (key: string) => {
    update({ apiKey: key });
    setKeyOpen(false);
  };

  const closeKey = () => {
    setKeyOpen(false);
    setPending(null);
  };

  if (book === undefined) {
    return (
      <div className="note">
        <header className="chat-bar">
          <button
            type="button"
            className="icon-button"
            onClick={() => navigate("/")}
            aria-label="Back"
          >
            <ArrowLeft size={21} />
          </button>
          <div className="chat-title" />
          <span className="chat-bar-spacer" />
        </header>
        <div className="state-center">
          <Spinner size={22} />
        </div>
      </div>
    );
  }

  if (book === null) {
    return (
      <div className="note">
        <header className="chat-bar">
          <button
            type="button"
            className="icon-button"
            onClick={() => navigate("/")}
            aria-label="Back"
          >
            <ArrowLeft size={21} />
          </button>
          <div className="chat-title">Note</div>
          <span className="chat-bar-spacer" />
        </header>
        <div className="state-center">
          <p>This note isn’t here.</p>
          <button
            type="button"
            className="text-button"
            onClick={() => navigate("/")}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const active = lessons
    .filter(
      (lesson) =>
        lesson.status === "active" ||
        lesson.status === "planning" ||
        lesson.status === "error",
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const learned = lessons.reduce(
    (sum, lesson) =>
      sum + lesson.plan.filter((concept) => concept.covered).length,
    0,
  );
  const ordered = [...lessons].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="note">
      <header className="chat-bar">
        <button
          type="button"
          className="icon-button"
          onClick={() => navigate("/")}
          aria-label="Back"
        >
          <ArrowLeft size={21} />
        </button>
        <div className="chat-title" title={book.title}>
          {book.title}
        </div>
        <span className="chat-bar-spacer" />
      </header>

      <div className="note-scroll">
        <p className="note-eyebrow">Progress</p>
        <p className="note-learned">
          {learned > 0
            ? `${learned} ${learned === 1 ? "idea" : "ideas"} learned`
            : "No ideas yet"}
        </p>

        {active ? (
          <>
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate(`/lesson/${active.id}`)}
            >
              Continue lesson
            </button>
            <button
              type="button"
              className="text-button note-new-pages"
              onClick={() => setPageOpen(true)}
            >
              New pages
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={() => setPageOpen(true)}
          >
            Choose pages
          </button>
        )}

        {ordered.length > 0 && (
          <div className="note-groups">
            {ordered.map((lesson) => {
              const covered = lesson.plan.filter(
                (concept) => concept.covered,
              ).length;
              const total = lesson.plan.length;
              const canOpen = lesson.status !== "done";
              const status =
                lesson.status === "planning"
                  ? "Preparing…"
                  : lesson.status === "error"
                    ? "Try again"
                    : lesson.status === "done"
                      ? "Done"
                      : total > 0
                        ? `${covered} / ${total}`
                        : "In progress";

              const head = (
                <>
                  <span className="lesson-group-range">
                    {lesson.chapterTitle}
                  </span>
                  <span className="lesson-group-status">
                    {status}
                    {canOpen && <ChevronRight size={14} />}
                  </span>
                </>
              );

              return (
                <section className="lesson-group" key={lesson.id}>
                  {canOpen ? (
                    <button
                      type="button"
                      className="lesson-group-head is-action"
                      onClick={() => navigate(`/lesson/${lesson.id}`)}
                    >
                      {head}
                    </button>
                  ) : (
                    <div className="lesson-group-head">{head}</div>
                  )}

                  {lesson.plan.length > 0 ? (
                    <ul className="concept-list">
                      {lesson.plan.map((concept) => (
                        <li
                          key={concept.id}
                          className={
                            concept.covered
                              ? "concept-row is-learned"
                              : "concept-row"
                          }
                        >
                          <span className="concept-mark">
                            {concept.covered ? (
                              <Check size={12} />
                            ) : (
                              <Circle size={12} />
                            )}
                          </span>
                          <span>{concept.title}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="note-empty">
                      {lesson.status === "error"
                        ? "Couldn’t build this lesson. Tap the title to retry."
                        : lesson.status === "planning"
                          ? "Preparing the ideas…"
                          : "No ideas yet."}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {pageOpen && (
        <PageSheet
          book={book}
          onClose={() => setPageOpen(false)}
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
    </div>
  );
}
