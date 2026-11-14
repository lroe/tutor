import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowRight,
  Check,
  Clock3,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { db } from "../lib/db";
import {
  bookSummary,
  dueConcepts,
  upcomingCount,
  weakConcepts,
  weekStrip,
} from "../lib/progress";
import { dueLabel, kindLabel } from "../lib/review";
import type { Book, Lesson } from "../lib/types";
import { cx } from "../lib/util";

export function Progress({ navigate }: { navigate: (path: string) => void }) {
  const lessons = useLiveQuery(() => db.lessons.toArray(), [], [] as Lesson[]);
  const books = useLiveQuery(
    () => db.books.orderBy("lastOpenedAt").reverse().toArray(),
    [],
    [] as Book[],
  );
  const activity = useLiveQuery(() => db.activity.toArray(), [], []);

  const now = Date.now();
  const due = dueConcepts(lessons, now);
  const weak = weakConcepts(lessons);
  const upcoming = upcomingCount(lessons, now);
  const week = weekStrip(activity);
  const weekTotal = week.reduce((sum, day) => sum + day.count, 0);
  const weekMax = Math.max(1, ...week.map((day) => day.count));
  const met = lessons.reduce(
    (sum, lesson) => sum + lesson.plan.filter((idea) => idea.covered).length,
    0,
  );
  const landed = lessons.reduce(
    (sum, lesson) =>
      sum +
      lesson.plan.filter(
        (idea) => idea.covered && idea.mastery === "passed",
      ).length,
    0,
  );
  const chapters = lessons.filter((lesson) =>
    lesson.plan.some((idea) => idea.covered),
  ).length;
  const booksWithProgress = books.filter((book) =>
    lessons.some((lesson) => lesson.bookId === book.id),
  );

  if (lessons.length === 0) {
    return (
      <main className="page progress-page">
        <header className="page-head">
          <p className="eyebrow">Your progress</p>
          <h1 className="display">What’s landing.</h1>
          <p className="lede">
            Not time spent. Ideas you can actually explain.
          </p>
        </header>
        <div className="empty-state progress-empty">
          <span className="empty-mark">
            <Sparkles size={22} />
          </span>
          <h2>Nothing to measure yet.</h2>
          <p className="body-text">
            Finish your first chapter and this page will remember what landed,
            what needs another look, and what’s due for review.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/")}
          >
            Choose a book
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page progress-page">
      <header className="page-head">
        <p className="eyebrow">Your progress</p>
        <h1 className="display">What’s landing.</h1>
        <p className="lede">
          Not time spent. Ideas you can actually explain.
        </p>
      </header>

      <section className="stats-card" aria-label="Learning summary">
        <div className="stat-main">
          <span className="stat-number">{met}</span>
          <span className="stat-label">ideas met</span>
          <span className="stat-sub">
            {chapters} {chapters === 1 ? "chapter" : "chapters"} explored
          </span>
        </div>
        <div className="stat-side">
          <div>
            <strong>{landed}</strong>
            <span>landed</span>
          </div>
          <div>
            <strong>{weak.length + due.length}</strong>
            <span>in review</span>
          </div>
        </div>
      </section>

      <section className="week-card">
        <div className="week-head">
          <h2>This week</h2>
          <span>
            {weekTotal} {weekTotal === 1 ? "idea" : "ideas"}
          </span>
        </div>
        <div className="week-strip">
          {week.map((day) => (
            <div
              key={day.key}
              className={cx("week-day", day.today && "is-today")}
            >
              <span className="week-track">
                <span
                  className={cx("week-bar", day.count > 0 && "is-filled")}
                  style={{
                    height: `${Math.max(
                      day.count > 0 ? 18 : 6,
                      (day.count / weekMax) * 100,
                    )}%`,
                  }}
                />
              </span>
              <span className="week-label">{day.label}</span>
            </div>
          ))}
        </div>
        <p className="fineprint">
          {weekTotal === 0
            ? "A little each day is enough. Open a chapter when you have ten minutes."
            : upcoming > 0
              ? `${upcoming} ${upcoming === 1 ? "review is" : "reviews are"} coming up. You don’t have to chase them.`
              : "Nothing else is due yet. Let the ideas settle."}
        </p>
      </section>

      {due.length > 0 && (
        <section className="review-section" aria-labelledby="due-heading">
          <div className="section-head">
            <h2 id="due-heading" className="section-title">
              Due now
            </h2>
            <span className="section-count">
              <Clock3 size={13} />
              {due.length}
            </span>
          </div>
          <div className="review-list">
            {due.slice(0, 6).map((ref) => (
              <button
                key={`${ref.lesson.id}-${ref.concept.id}`}
                type="button"
                className="review-row"
                onClick={() =>
                  navigate(`/lesson/${ref.lesson.id}?reteach=${ref.index}`)
                }
              >
                <span className={cx("review-kind", `kind-${ref.concept.kind}`)}>
                  {kindLabel(ref.concept.kind)}
                </span>
                <span className="review-copy">
                  <span className="review-title">{ref.concept.title}</span>
                  <span className="review-meta">
                    {ref.lesson.chapterTitle} ·{" "}
                    {dueLabel(ref.concept.reviewAt, now)}
                  </span>
                </span>
                <span className="review-action">
                  Review
                  <ArrowRight size={14} />
                </span>
              </button>
            ))}
          </div>
          {due.length > 6 && (
            <p className="fineprint">
              {due.length - 6} more are waiting. One at a time.
            </p>
          )}
        </section>
      )}

      <section className="review-section" aria-labelledby="weak-heading">
        <div className="section-head">
          <h2 id="weak-heading" className="section-title">
            Worth another look
          </h2>
          <span className="section-count">{weak.length}</span>
        </div>
        {weak.length === 0 ? (
          <div className="all-clear">
            <span className="all-clear-mark">
              <Check size={16} />
            </span>
            <div>
              <p>Nothing slipped.</p>
              <span>
                {upcoming > 0
                  ? "The next reviews are already scheduled."
                  : "New reviews appear when an idea is ready to come back."}
              </span>
            </div>
          </div>
        ) : (
          <div className="review-list">
            {weak.slice(0, 6).map((ref) => (
              <button
                key={`${ref.lesson.id}-${ref.concept.id}`}
                type="button"
                className="review-row"
                onClick={() =>
                  navigate(`/lesson/${ref.lesson.id}?reteach=${ref.index}`)
                }
              >
                <span className={cx("review-kind", `kind-${ref.concept.kind}`)}>
                  {kindLabel(ref.concept.kind)}
                </span>
                <span className="review-copy">
                  <span className="review-title">{ref.concept.title}</span>
                  <span className="review-meta">
                    {ref.lesson.chapterTitle} ·{" "}
                    {ref.concept.mastery === "skipped"
                      ? "check skipped"
                      : "didn’t land yet"}
                  </span>
                </span>
                <span className="review-action">
                  <RotateCcw size={13} />
                  Revisit
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {booksWithProgress.length > 0 && (
        <section className="book-progress-section" aria-labelledby="books-progress">
          <div className="section-head">
            <h2 id="books-progress" className="section-title">
              By book
            </h2>
          </div>
          <div className="progress-books">
            {booksWithProgress.map((book) => {
              const bookLessons = lessons.filter(
                (lesson) => lesson.bookId === book.id,
              );
              const summary = bookSummary(book.chapters.length, bookLessons);
              return (
                <button
                  key={book.id}
                  type="button"
                  className="progress-book-row"
                  onClick={() => navigate(`/book/${book.id}`)}
                >
                  <span className="progress-book-copy">
                    <span className="progress-book-title">{book.title}</span>
                    <span className="book-progress-label">
                      <span>
                        {summary.covered} of {summary.total} ideas
                      </span>
                      <span>{summary.mastered} landed</span>
                    </span>
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
                  </span>
                  <Chevron />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <p className="progress-footnote">
        Cove spaces reviews out — a day, then three, then a week — depending on
        how each idea landed. No streaks, no guilt.
      </p>
    </main>
  );
}

function Chevron() {
  return <ArrowRight size={16} className="row-chevron" aria-hidden="true" />;
}
