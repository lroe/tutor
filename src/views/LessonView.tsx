import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ListTree,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Markdown } from "../components/Markdown";
import { PlanSheet } from "../components/PlanSheet";
import { SourceSheet } from "../components/SourceSheet";
import { Spinner, ToothMark, TypingDots } from "../components/Brand";
import { VisualSheet } from "../components/VisualSheet";
import { VisualStrip } from "../components/VisualStrip";
import { db, bumpActivity, pagesFor } from "../lib/db";
import {
  answerQuestion,
  evaluateAnswer,
  isDemoMode,
  makePlan,
  messagesToTurns,
  parseTeach,
  teachConcept,
  visibleTeach,
} from "../lib/ai";
import { describeAIError } from "../lib/gemini";
import {
  checkPromptFor,
  kindLabel,
  scheduleReview,
} from "../lib/review";
import type {
  Concept,
  Evaluation,
  Lesson,
  Message,
  PageText,
  Settings,
  Verdict,
  VisualSelection,
} from "../lib/types";
import { cx, isAbort, readingTime, uid } from "../lib/util";
import { latestLessonForChapter, openLesson } from "../lib/library";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { useSettings } from "../state/settings";
import { useToast } from "../state/toast";

type Busy = "planning" | "teaching" | "chat" | "grading" | null;

interface LiveState {
  mode: "teach" | "chat";
  text: string;
  index: number;
}

export function LessonView({
  id,
  reteach,
  navigate,
}: {
  id: string;
  reteach?: number;
  navigate: (path: string) => void;
}) {
  const { settings } = useSettings();
  const { show } = useToast();
  const lesson = useLiveQuery(() => db.lessons.get(id), [id]);
  const messages = useLiveQuery(
    () => db.messages.where("lessonId").equals(id).sortBy("id"),
    [id],
    [] as Message[],
  );
  const book = useLiveQuery(
    () => (lesson ? db.books.get(lesson.bookId) : undefined),
    [lesson?.bookId],
  );

  const [pages, setPages] = useState<PageText[] | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [planError, setPlanError] = useState("");
  const [teachError, setTeachError] = useState("");
  const [sendError, setSendError] = useState<{
    message: string;
    text: string;
  } | null>(null);
  const [composer, setComposer] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [sourcePage, setSourcePage] = useState<number | null>(null);
  const [visual, setVisual] = useState<VisualSelection | null>(null);
  const [reviewingConcept, setReviewingConcept] = useState<number | null>(null);
  const [nextBusy, setNextBusy] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const planStartedRef = useRef<string | null>(null);
  const teachStartedRef = useRef<string | null>(null);
  const reteachHandledRef = useRef<number | null>(null);
  const advancingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mountedRef = useRef(true);

  const activeIndex = reviewingConcept ?? lesson?.currentIndex ?? 0;
  const activeConcept = lesson?.plan[activeIndex];
  const activeCheck =
    activeConcept?.check && !activeConcept.check.answered
      ? activeConcept.check
      : null;
  const demo = isDemoMode(settings);
  const isDone = lesson?.status === "done" && reviewingConcept === null;
  const currentTeach = messages.some(
    (message) =>
      message.kind === "teach" && message.conceptIndex === activeIndex,
  );

  const latestTeachId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (
        message.kind === "teach" &&
        message.conceptIndex === activeIndex
      ) {
        return message.id;
      }
    }
    return undefined;
  }, [messages, activeIndex]);

  const coveredCount = useMemo(
    () => lesson?.plan.filter((concept) => concept.covered).length ?? 0,
    [lesson?.plan],
  );
  const masteredCount = useMemo(
    () =>
      lesson?.plan.filter(
        (concept) => concept.covered && concept.mastery === "passed",
      ).length ?? 0,
    [lesson?.plan],
  );

  const scrollTrigger = `${messages.length}:${live?.text.length ?? 0}:${
    busy ?? ""
  }:${activeCheck?.question ?? ""}:${isDone ? "done" : ""}`;
  const { containerRef, onScroll, jumpToEnd } =
    useAutoScroll<HTMLDivElement>(scrollTrigger);

  useEffect(() => {
    if (live?.text) jumpToEnd();
  }, [live?.text, jumpToEnd]);

  useEffect(() => {
    if (messages.length) jumpToEnd();
  }, [messages.length, jumpToEnd]);

  useEffect(() => {
    if (activeCheck?.messageId) jumpToEnd();
  }, [activeCheck?.messageId, jumpToEnd]);

  useEffect(() => {
    if (isDone) jumpToEnd();
  }, [isDone, jumpToEnd]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;
    setPages(null);
    pagesFor(lesson.bookId, lesson.startPage, lesson.endPage)
      .then((result) => {
        if (!cancelled) setPages(result);
      })
      .catch(() => {
        if (!cancelled) setPages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson?.bookId, lesson?.startPage, lesson?.endPage]);

  useEffect(() => {
    if (!lesson || !pages || lesson.plan.length > 0) return;
    if (lesson.status !== "planning") return;
    if (planStartedRef.current === lesson.id) return;
    planStartedRef.current = lesson.id;

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("planning");
    setPlanError("");

    (async () => {
      try {
        const plan = await makePlan({
          settings,
          bookTitle: lesson.bookTitle,
          chapterTitle: lesson.chapterTitle,
          startPage: lesson.startPage,
          endPage: lesson.endPage,
          pages,
          learner: lesson.learner,
        });
        if (controller.signal.aborted) return;
        const concepts: Concept[] = plan.map((item) => ({
          ...item,
          id: uid(),
          covered: false,
        }));
        await db.lessons.update(lesson.id, {
          plan: concepts,
          status: "active",
          updatedAt: Date.now(),
        });
      } catch (caught) {
        if (!mountedRef.current || controller.signal.aborted) return;
        const message = describeAIError(caught);
        setPlanError(message);
        await db.lessons.update(lesson.id, { status: "error" });
      } finally {
        if (mountedRef.current && !controller.signal.aborted) {
          setBusy(null);
        }
      }
    })();
  }, [lesson, pages, settings]);

  const startTeach = useCallback(
    async (
      index: number,
      options: { reteach?: boolean; review?: boolean } = {},
    ) => {
      if (!lesson || !pages || !lesson.plan[index]) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setTeachError("");
      setSendError(null);
      setBusy("teaching");
      setLive({ mode: "teach", text: "", index });
      jumpToEnd();

      try {
        const covered = lesson.plan.filter((concept) => concept.covered).length;
        const passed = lesson.plan.filter(
          (concept) => concept.covered && concept.mastery === "passed",
        ).length;
        const raw = await teachConcept({
          settings,
          chapterTitle: lesson.chapterTitle,
          startPage: lesson.startPage,
          endPage: lesson.endPage,
          pages,
          plan: lesson.plan,
          index,
          history: messagesToTurns(messages),
          learner: lesson.learner,
          pacing:
            covered > 0
              ? `${covered} of ${lesson.plan.length} ideas met, ${passed} checks landed`
              : "",
          reteach: options.reteach,
          onDelta: (delta) => {
            if (!mountedRef.current) return;
            setLive((current) =>
              current ? { ...current, text: current.text + delta } : current,
            );
          },
          signal: controller.signal,
        });
        if (controller.signal.aborted || !mountedRef.current) return;

        const { explanation, check } = parseTeach(
          raw,
          lesson.plan[index].title,
        );
        const messageId = await db.messages.add({
          lessonId: lesson.id,
          role: "tutor",
          kind: "teach",
          content: explanation,
          conceptIndex: index,
          checkQuestion: check,
          createdAt: Date.now(),
        });
        const latest = await db.lessons.get(lesson.id);
        if (!latest) return;
        const nextPlan = latest.plan.map((concept, conceptIndex) => {
          if (conceptIndex !== index) return concept;
          return {
            ...concept,
            check: {
              question: check,
              messageId,
              answered: false,
              attempts: 0,
            },
          };
        });
        await db.lessons.update(lesson.id, {
          plan: nextPlan,
          updatedAt: Date.now(),
          ...(options.review ? {} : { status: "active" as const }),
        });
        setLive(null);
      } catch (caught) {
        if (!mountedRef.current || isAbort(caught)) return;
        setLive(null);
        setTeachError(describeAIError(caught));
      } finally {
        if (mountedRef.current && !controller.signal.aborted) {
          setBusy(null);
        }
      }
    },
    [lesson, pages, messages, settings, jumpToEnd],
  );

  useEffect(() => {
    if (!lesson || !pages || lesson.plan.length === 0) return;
    if (reteach === undefined) return;
    if (reteachHandledRef.current === reteach) return;
    if (reteach >= lesson.plan.length) return;
    reteachHandledRef.current = reteach;
    setReviewingConcept(reteach);
    teachStartedRef.current = `${lesson.id}:${reteach}:review`;
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#/lesson/${lesson.id}`,
      );
    }
    void startTeach(reteach, { reteach: true, review: true });
  }, [lesson, pages, reteach, startTeach]);

  useEffect(() => {
    if (!lesson || !pages || lesson.plan.length === 0) return;
    if (reteach !== undefined || reviewingConcept !== null) return;
    if (busy !== null) return;
    if (lesson.status !== "active") return;
    const index = lesson.currentIndex;
    const concept = lesson.plan[index];
    if (!concept || concept.covered) return;
    const key = `${lesson.id}:${index}`;
    if (teachStartedRef.current === key) return;
    if (
      messages.some(
        (message) => message.kind === "teach" && message.conceptIndex === index,
      )
    )
      return;
    teachStartedRef.current = key;
    void startTeach(index);
  }, [
    lesson,
    pages,
    messages,
    busy,
    reteach,
    reviewingConcept,
    startTeach,
  ]);

  const retryPlan = async () => {
    planStartedRef.current = null;
    setPlanError("");
    await db.lessons.update(id, { status: "planning" });
  };

  const applyEvaluation = async (
    evaluation: Evaluation,
    index: number,
    previousQuestion: string,
  ) => {
    if (!lesson) return;
    const latest = await db.lessons.get(lesson.id);
    if (!latest) return;
    const concept = latest.plan[index];
    if (!concept) return;
    const previousCheck = concept.check;
    const isQuestion = evaluation.verdict === "question";
    const attempt = (previousCheck?.attempts ?? 0) + (isQuestion ? 0 : 1);
    const now = Date.now();

    let mastery = concept.mastery;
    let reviewAt = concept.reviewAt;
    let reviewCount = concept.reviewCount ?? 0;
    if (!isQuestion) {
      if (evaluation.mastered) {
        mastery = "passed";
        if (reviewingConcept !== null) reviewCount += 1;
        reviewAt = scheduleReview(concept.kind, "passed", reviewCount, now);
      } else if (!evaluation.followUp) {
        mastery = "shaky";
        reviewAt = scheduleReview(concept.kind, "shaky", reviewCount, now);
      }
    }

    const nextQuestion = evaluation.followUp ?? previousQuestion;
    const nextPlan = latest.plan.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return {
        ...item,
        mastery,
        reviewAt,
        reviewCount,
        check: {
          question: nextQuestion,
          messageId: previousCheck?.messageId ?? 0,
          answered: isQuestion
            ? false
            : Boolean(evaluation.mastered || !evaluation.followUp),
          verdict: isQuestion
            ? previousCheck?.verdict
            : (evaluation.verdict as Exclude<Verdict, "question">),
          mastered: isQuestion
            ? previousCheck?.mastered
            : evaluation.mastered,
          attempts: attempt,
          followUp: evaluation.followUp,
        },
      };
    });
    await db.lessons.update(lesson.id, {
      plan: nextPlan,
      updatedAt: now,
    });
    if (previousCheck?.messageId) {
      const messageUpdate: Partial<Message> = {};
      if (!isQuestion) messageUpdate.checkVerdict = evaluation.verdict;
      if (Object.keys(messageUpdate).length > 0) {
        await db.messages.update(previousCheck.messageId, messageUpdate);
      }
    }
    await db.messages.add({
      lessonId: lesson.id,
      role: "tutor",
      kind: isQuestion ? "chat" : "feedback",
      content: evaluation.reply,
      conceptIndex: index,
      verdict: evaluation.verdict,
      createdAt: now + 1,
    });
    if (!isQuestion && evaluation.mastered) {
      await bumpActivity(0, 1);
    }
  };

  const send = async (override?: string, alreadySaved = false) => {
    if (!lesson || !pages || busy) return;
    const text = (override ?? composer).trim();
    if (!text) return;
    if (lesson.status === "done" && reviewingConcept === null) return;
    const index = activeIndex;
    const concept = lesson.plan[index];
    if (!concept) return;

    if (!alreadySaved) {
      setComposer("");
      await db.messages.add({
        lessonId: lesson.id,
        role: "user",
        kind: "chat",
        content: text,
        conceptIndex: index,
        createdAt: Date.now(),
      });
    }
    jumpToEnd();
    setSendError(null);

    const pending =
      concept.check && !concept.check.answered ? concept.check : null;

    if (pending) {
      setBusy("grading");
      try {
        const evaluation = await evaluateAnswer({
          settings,
          chapterTitle: lesson.chapterTitle,
          pages,
          plan: lesson.plan,
          index,
          check: pending.question,
          message: text,
          attempt: pending.attempts + 1,
          reviewMode: reviewingConcept !== null,
        });
        if (!mountedRef.current) return;
        await applyEvaluation(evaluation, index, pending.question);
      } catch (caught) {
        if (!mountedRef.current || isAbort(caught)) return;
        setSendError({ message: describeAIError(caught), text });
      } finally {
        if (mountedRef.current) setBusy(null);
      }
      return;
    }

    setBusy("chat");
    const controller = new AbortController();
    abortRef.current = controller;
    setLive({ mode: "chat", text: "", index });
    try {
      const studentMessage: Message = {
        lessonId: lesson.id,
        role: "user",
        kind: "chat",
        content: text,
        conceptIndex: index,
        createdAt: Date.now(),
      };
      const answer = await answerQuestion({
        settings,
        chapterTitle: lesson.chapterTitle,
        startPage: lesson.startPage,
        endPage: lesson.endPage,
        pages,
        plan: lesson.plan,
        index,
        history: messagesToTurns([...messages, studentMessage]),
        question: text,
        onDelta: (delta) => {
          if (!mountedRef.current) return;
          setLive((current) =>
            current ? { ...current, text: current.text + delta } : current,
          );
        },
        signal: controller.signal,
      });
      if (controller.signal.aborted || !mountedRef.current) return;
      await db.messages.add({
        lessonId: lesson.id,
        role: "tutor",
        kind: "chat",
        content: answer,
        conceptIndex: index,
        createdAt: Date.now() + 1,
      });
      setLive(null);
    } catch (caught) {
      if (!mountedRef.current || isAbort(caught)) return;
      setLive(null);
      setSendError({ message: describeAIError(caught), text });
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const advance = async () => {
    if (!lesson || !pages || busy || advancingRef.current) return;
    advancingRef.current = true;
    try {
      if (reviewingConcept !== null) {        const concept = lesson.plan[reviewingConcept];
        if (concept?.check && !concept.check.answered) {
          const now = Date.now();
          const nextPlan = lesson.plan.map((item, index) =>
            index === reviewingConcept
              ? {
                  ...item,
                  mastery: "shaky" as const,
                  reviewAt: scheduleReview(item.kind, "shaky", item.reviewCount ?? 0, now),
                }
              : item,
          );
          await db.lessons.update(lesson.id, {
            plan: nextPlan,
            updatedAt: now,
          });
        }
        navigate("/progress");
        return;
      }

      const currentIndex = lesson.currentIndex;
      const concept = lesson.plan[currentIndex];
      if (!concept) return;
      const check = concept.check;
      const mastery = check?.mastered
        ? ("passed" as const)
        : check && check.attempts > 0
          ? ("shaky" as const)
          : ("skipped" as const);
      const now = Date.now();
      const nextPlan = lesson.plan.map((item, index) =>
        index === currentIndex
          ? {
              ...item,
              covered: true,
              coveredAt: now,
              mastery,
              reviewAt: scheduleReview(
                item.kind,
                mastery,
                item.reviewCount ?? 0,
                now,
              ),
            }
          : item,
      );
      const nextIndex = currentIndex + 1;
      const done = nextIndex >= lesson.plan.length;
      await db.lessons.update(lesson.id, {
        plan: nextPlan,
        currentIndex: nextIndex,
        status: done ? "done" : "active",
        updatedAt: now,
      });
      await bumpActivity(1, 0);

      if (done) {
        jumpToEnd();
      } else {
        teachStartedRef.current = `${lesson.id}:${nextIndex}`;
        void startTeach(nextIndex);
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const startReview = (index: number) => {
    if (!lesson || busy) return;
    setReviewingConcept(index);
    setTeachError("");
    setSendError(null);
    teachStartedRef.current = `${lesson.id}:${index}:review:${Date.now()}`;
    jumpToEnd();
    void startTeach(index, { reteach: true, review: true });
  };

  const goNextChapter = async () => {
    if (!lesson || !book || nextBusy) return;
    setNextBusy(true);
    try {
      const chapterIndex = book.chapters.findIndex(
        (chapter) => chapter.id === lesson.chapterId,
      );
      const nextChapter = book.chapters[chapterIndex + 1];
      if (!nextChapter) {
        navigate(`/book/${book.id}`);
        return;
      }
      const existing = await latestLessonForChapter(book.id, nextChapter.id);
      if (existing) {
        navigate(`/lesson/${existing.id}`);
        return;
      }
      const chapterPages = await pagesFor(
        book.id,
        nextChapter.startPage,
        nextChapter.endPage,
      );
      const blank = chapterPages.filter(
        (page) => page.text.replace(/\s+/g, "").length < 40,
      ).length;
      if (blank > 0) {
        show(
          "The next chapter has image-only pages. Open it from the book to read them first.",
        );
        navigate(`/book/${book.id}`);
        return;
      }
      const nextLesson = await openLesson(
        book,
        nextChapter,
        lesson.learner,
      );
      navigate(`/lesson/${nextLesson.id}`);
    } catch {
      show("Couldn’t open the next chapter.", "error");
    } finally {
      setNextBusy(false);
    }
  };

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(120, element.scrollHeight)}px`;
  }, [composer]);

  const placeholder = busy
    ? busy === "grading"
      ? "Cove is reading your answer…"
      : busy === "teaching"
        ? "Cove is teaching…"
        : "Cove is answering…"
    : activeCheck
      ? "Answer, or ask a question…"
      : "Ask anything…";

  if (lesson === undefined) {
    return (
      <div className="lesson-state">
        <Spinner size={24} />
        <p className="body-text">Opening your lesson…</p>
      </div>
    );
  }

  if (lesson === null) {
    return (
      <div className="lesson-state">
        <h1 className="display-sm">This lesson isn’t here.</h1>
        <p className="body-text">It may have been deleted.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate("/")}
        >
          Back to the library
        </button>
      </div>
    );
  }

  const back = () => {
    if (reviewingConcept !== null) navigate("/progress");
    else navigate(`/book/${lesson.bookId}`);
  };

  if (lesson.status === "planning" || pages === null) {
    return (
      <div className="lesson-state planning-state">
        <header className="state-top">
          <button
            type="button"
            className="icon-button"
            onClick={back}
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
        </header>
        <div className="state-mark">
          <ToothMark size={30} />
        </div>
        <p className="eyebrow">A guided chapter</p>
        <h1 className="display-sm">{lesson.chapterTitle}</h1>
        <p className="body-text">
          {pages === null
            ? "Opening the pages…"
            : demo
              ? "Sketching a path through the chapter."
              : "Reading the chapter and choosing the ideas worth your time."}
        </p>
        {pages !== null && (
          <div className="state-progress">
            <span />
          </div>
        )}
        <p className="fineprint">
          {demo
            ? "Preview mode uses a canned lesson plan."
            : "A few seconds. Gemini is reading only the pages you picked."}
        </p>
      </div>
    );
  }

  if (lesson.status === "error" && lesson.plan.length === 0) {
    return (
      <div className="lesson-state">
        <header className="state-top">
          <button
            type="button"
            className="icon-button"
            onClick={back}
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
        </header>
        <p className="eyebrow">A small snag</p>
        <h1 className="display-sm">I couldn’t make a lesson from this.</h1>
        <p className="body-text">{planError || "The pages didn’t come through."}</p>
        <div className="state-actions">
          <button type="button" className="btn btn-primary" onClick={retryPlan}>
            Try again
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate("/settings")}
          >
            Check settings
          </button>
          <button type="button" className="text-button" onClick={back}>
            Back to the book
          </button>
        </div>
      </div>
    );
  }

  const isReview = reviewingConcept !== null;
  const isLast = lesson.currentIndex >= lesson.plan.length - 1;
  const activeKind = activeConcept?.kind ?? "concept";
  const passedCount = lesson.plan.filter(
    (concept) => concept.mastery === "passed",
  ).length;
  const weak = lesson.plan
    .map((concept, index) => ({ concept, index }))
    .filter(
      ({ concept }) =>
        concept.covered && concept.mastery !== "passed",
    );
  const canAct = currentTeach || isReview;
  const showFooter =
    !isDone &&
    lesson.plan.length > 0 &&
    activeConcept !== undefined &&
    (canAct || busy === "teaching");
  const progressPercent = lesson.plan.length
    ? Math.round((coveredCount / lesson.plan.length) * 100)
    : 0;
  const displayIndex = Math.min(activeIndex, lesson.plan.length - 1);

  return (
    <div className="lesson">
      <header className="lesson-head">
        <button
          type="button"
          className="icon-button"
          onClick={back}
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="lesson-head-copy">
          <div className="lesson-kicker">
            {isReview ? "Reviewing" : "A guided chapter"}
          </div>
          <div className="lesson-title" title={lesson.chapterTitle}>
            {lesson.chapterTitle}
          </div>
        </div>
        <button
          type="button"
          className="plan-button"
          onClick={() => setPlanOpen(true)}
          aria-label="Open the lesson plan"
        >
          <ListTree size={15} />
          <span>
            {displayIndex + 1}/{lesson.plan.length}
          </span>
        </button>
      </header>
      <div className="lesson-progress" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <div
        className="chat-scroll"
        ref={containerRef}
        onScroll={onScroll}
      >
        <div className="chat-inner">
          <div className="chat-intro">
            <p className="eyebrow">{isReview ? "A second look" : "The path"}</p>
            <p className="chat-intro-copy">
              {isReview
                ? "Let’s come at this idea from a different angle."
                : "A few ideas, one at a time. Ask me anything as we go."}
            </p>
            <p>
              {lesson.plan.length} ideas · {readingTime(lesson.plan.length)}
              {masteredCount > 0 ? ` · ${masteredCount} landed` : ""}
            </p>
          </div>

          {demo && (
            <div className="preview-note">
              <Sparkles size={14} />
              <span>
                Preview lesson — the teaching is canned, not from your book.
              </span>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              lesson={lesson}
              settings={settings}
              activeCheckMessageId={activeCheck?.messageId ?? null}
              activeTeachId={latestTeachId}
              onCitation={setSourcePage}
              onOpenVisual={setVisual}
            />
          ))}

          {live && (
            <div className="message message-tutor">
              <span className="avatar" aria-hidden="true">
                <ToothMark size={15} />
              </span>
              <div className="message-body">
                {live.mode === "teach" && (
                  <div className="message-topline">
                    <span className="concept-label">
                      Idea {live.index + 1} ·{" "}
                      {lesson.plan[live.index]?.title ?? ""}
                    </span>
                    <span
                      className={cx(
                        "kind-chip",
                        `kind-${lesson.plan[live.index]?.kind ?? "concept"}`,
                      )}
                    >
                      {kindLabel(lesson.plan[live.index]?.kind ?? "concept")}
                    </span>
                  </div>
                )}
                <div className="markdown">
                  {live.text ? (
                    live.mode === "teach" ? (
                      <Markdown
                        onCitation={setSourcePage}
                      >
                        {visibleTeach(live.text)}
                      </Markdown>
                    ) : (
                      <Markdown onCitation={setSourcePage}>
                        {live.text}
                      </Markdown>
                    )
                  ) : (
                    <TypingDots />
                  )}
                </div>
              </div>
            </div>
          )}

          {busy === "grading" && (
            <div className="message message-tutor">
              <span className="avatar" aria-hidden="true">
                <ToothMark size={15} />
              </span>
              <div className="message-body">
                <TypingDots />
              </div>
            </div>
          )}

          {activeCheck && !isDone && busy !== "teaching" && (
            <div className="check-panel">
              <div className="check-head">
                <span className="check-label">
                  {checkPromptFor(activeKind)}
                </span>
                {activeCheck.attempts > 0 && (
                  <span className="check-retry">One more try</span>
                )}
              </div>
              <p className="check-question">{activeCheck.question}</p>
              <p className="check-hint">
                Answer below in your own words. Unsure? Ask me a question
                instead.
              </p>
            </div>
          )}

          {sendError && (
            <div className="inline-error">
              <span>{sendError.message}</span>
              <button
                type="button"
                className="text-button"
                onClick={() => void send(sendError.text, true)}
              >
                Try again
              </button>
            </div>
          )}

          {teachError && !live && (
            <div className="inline-error is-strong">
              <span>{teachError}</span>
              <div className="inline-error-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    void startTeach(activeIndex, {
                      reteach: isReview,
                      review: isReview,
                    })
                  }
                >
                  Try again
                </button>
                {!isReview && (
                  <button
                    type="button"
                    className="text-button is-muted"
                    onClick={() => void advance()}
                  >
                    Skip this idea
                  </button>
                )}
              </div>
            </div>
          )}

          {isDone && (
            <CompletionCard
              lesson={lesson}
              passedCount={passedCount}
              weak={weak}
              onReview={startReview}
              onNextChapter={goNextChapter}
              onBack={() => navigate(`/book/${lesson.bookId}`)}
              nextBusy={nextBusy}
              hasNextChapter={
                Boolean(book) &&
                book!.chapters.findIndex(
                  (chapter) => chapter.id === lesson.chapterId,
                ) >= 0 &&
                book!.chapters.findIndex(
                  (chapter) => chapter.id === lesson.chapterId,
                ) <
                  book!.chapters.length - 1
              }
            />
          )}
        </div>
      </div>

      {showFooter && (
        <div className="lesson-foot">
          {busy === "teaching" ? (
            <div className="gate-row">
              <span>Cove is teaching…</span>
            </div>
          ) : activeCheck ? (
            <div className="gate-row">
              <span>
                {activeCheck.attempts > 0
                  ? "Try the smaller question, or"
                  : "Answer the check, or"}
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => void advance()}
                disabled={Boolean(busy)}
              >
                {isLast && !isReview
                  ? "skip & finish chapter"
                  : isReview
                    ? "skip & finish review"
                    : "skip for now"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-full next-button"
              onClick={() => void advance()}
              disabled={Boolean(busy)}
            >
              {isReview
                ? "Finish review"
                : isLast
                  ? "Finish chapter"
                  : "Next idea"}
              <ArrowRight size={17} />
            </button>
          )}

          <div className="composer">
            <textarea
              ref={textareaRef}
              rows={1}
              value={composer}
              placeholder={placeholder}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              disabled={Boolean(busy)}
              enterKeyHint="send"
              aria-label="Message Cove"
            />
            <button
              type="button"
              className="send-button"
              onClick={() => void send()}
              disabled={Boolean(busy) || !composer.trim()}
              aria-label="Send"
            >
              {busy === "chat" || busy === "grading" ? (
                <Spinner size={16} />
              ) : (
                <ArrowUp size={18} />
              )}
            </button>
          </div>
        </div>
      )}

      {reviewingConcept !== null && (
        <span className="visually-hidden">Reviewing an earlier idea</span>
      )}

      <PlanSheet
        open={planOpen}
        lesson={lesson}
        onClose={() => setPlanOpen(false)}
      />
      {sourcePage !== null && (
        <SourceSheet
          bookId={lesson.bookId}
          page={sourcePage}
          bookTitle={lesson.bookTitle}
          onClose={() => setSourcePage(null)}
        />
      )}
      {visual && (
        <VisualSheet visual={visual} onClose={() => setVisual(null)} />
      )}
    </div>
  );
}

function MessageBubble({
  message,
  lesson,
  settings,
  activeCheckMessageId,
  activeTeachId,
  onCitation,
  onOpenVisual,
}: {
  message: Message;
  lesson: Lesson;
  settings: Settings;
  activeCheckMessageId: number | null;
  activeTeachId?: number;
  onCitation: (page: number) => void;
  onOpenVisual: (visual: VisualSelection) => void;
}) {
  const concept =
    message.conceptIndex !== undefined
      ? lesson.plan[message.conceptIndex]
      : undefined;
  const active =
    message.id !== undefined && activeCheckMessageId === message.id;
  const showCheck =
    message.kind === "teach" && message.checkQuestion && !active;
  const showVisuals =
    message.kind === "teach" &&
    message.id !== undefined &&
    message.id === activeTeachId &&
    concept !== undefined;

  if (message.role === "user") {
    return (
      <div className="message message-user">
        <div className="user-bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "message message-tutor",
        message.kind === "feedback" && "is-feedback",
      )}
    >
      <span className="avatar" aria-hidden="true">
        <ToothMark size={15} />
      </span>
      <div className="message-body">
        {message.kind === "teach" && concept && (
          <div className="message-topline">
            <span className="concept-label">
              Idea {(message.conceptIndex ?? 0) + 1} · {concept.title}
            </span>
            <span className={cx("kind-chip", `kind-${concept.kind}`)}>
              {kindLabel(concept.kind)}
            </span>
          </div>
        )}
        <Markdown onCitation={onCitation}>{message.content}</Markdown>
        {showVisuals && concept && (
          <VisualStrip
            bookId={lesson.bookId}
            pageNumbers={concept.pages}
            settings={settings}
            onOpen={onOpenVisual}
          />
        )}
        {message.kind === "feedback" && message.verdict && (
          <div className="verdict-row">
            <VerdictChip verdict={message.verdict} />
          </div>
        )}
        {showCheck && (
          <div
            className={cx(
              "check-history",
              message.checkVerdict === "correct" && "is-passed",
            )}
          >
            <div className="check-history-head">
              <span>{checkPromptFor(concept?.kind ?? "concept")}</span>
              {message.checkVerdict && message.checkVerdict !== "question" && (
                <VerdictChip verdict={message.checkVerdict} />
              )}
            </div>
            <p>{message.checkQuestion}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function VerdictChip({ verdict }: { verdict: Verdict }) {
  if (verdict === "question") return null;
  const label =
    verdict === "correct"
      ? "Landed"
      : verdict === "partial"
        ? "Nearly"
        : "Worth a look";
  return (
    <span className={cx("verdict-chip", `verdict-${verdict}`)}>
      {verdict === "correct" ? (
        <Check size={12} />
      ) : verdict === "incorrect" ? (
        <RotateCcw size={11} />
      ) : null}
      {label}
    </span>
  );
}

function CompletionCard({
  lesson,
  passedCount,
  weak,
  onReview,
  onNextChapter,
  onBack,
  nextBusy,
  hasNextChapter,
}: {
  lesson: Lesson;
  passedCount: number;
  weak: Array<{ concept: Concept; index: number }>;
  onReview: (index: number) => void;
  onNextChapter: () => void;
  onBack: () => void;
  nextBusy: boolean;
  hasNextChapter: boolean;
}) {
  return (
    <section className="completion-card">
      <div className="completion-mark" aria-hidden="true">
        <Check size={22} />
      </div>
      <p className="eyebrow">Chapter finished</p>
      <h2>That’s the chapter.</h2>
      <p className="completion-copy">
        {weak.length > 0
          ? "Some ideas need a second pass. That’s normal — they’re saved in your review list, not lost."
          : "Everything landed on the first pass. Let it settle, and come back when the review comes around."}
      </p>
      <div className="finish-stats">
        <div>
          <strong>{lesson.plan.length}</strong>
          <span>ideas met</span>
        </div>
        <div>
          <strong>{passedCount}</strong>
          <span>landed</span>
        </div>
        <div>
          <strong>{weak.length}</strong>
          <span>to revisit</span>
        </div>
      </div>

      {weak.length > 0 && (
        <div className="weak-list">
          <p className="weak-title">Worth another look</p>
          {weak.slice(0, 4).map(({ concept, index }) => (
            <div className="weak-row" key={concept.id}>
              <div className="weak-copy">
                <span>{concept.title}</span>
                <span className="weak-meta">
                  {kindLabel(concept.kind)} ·{" "}
                  {concept.mastery === "skipped"
                    ? "check skipped"
                    : "check didn’t land"}
                </span>
              </div>
              <button
                type="button"
                className="pill pill-action"
                onClick={() => onReview(index)}
              >
                Review
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="completion-actions">
        {hasNextChapter && (
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={onNextChapter}
            disabled={nextBusy}
          >
            {nextBusy ? <Spinner size={16} /> : null}
            Next chapter
            {!nextBusy && <ArrowRight size={17} />}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-full" onClick={onBack}>
          Back to chapters
        </button>
      </div>
    </section>
  );
}
