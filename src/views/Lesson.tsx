import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, ArrowUp, ChevronRight } from "lucide-react";
import { Markdown } from "../components/Markdown";
import { Spinner, TypingDots } from "../components/Brand";
import { ImageViewer } from "../components/ImageViewer";
import { VisualStrip } from "../components/VisualStrip";
import { db, pagesFor } from "../lib/db";
import {
  answerQuestion,
  evaluateAnswer,
  makePlan,
  messagesToTurns,
  parseTeach,
  teachConcept,
  visibleTeach,
} from "../lib/ai";
import { describeAIError } from "../lib/gemini";
import { readScannedPages } from "../lib/ocr";
import type {
  Concept,
  Evaluation,
  Mastery,
  Message,
  PageText,
  Verdict,
} from "../lib/types";
import { isAbort, uid } from "../lib/util";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { useSettings } from "../state/settings";

type Busy = "planning" | "teaching" | "chat" | "grading" | null;

interface LiveState {
  mode: "teach" | "chat";
  text: string;
  index: number;
}

interface OcrProgress {
  done: number;
  total: number;
}

export function Lesson({
  id,
  navigate,
}: {
  id: string;
  navigate: (path: string) => void;
}) {
  const { settings } = useSettings();
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
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [image, setImage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const planStartedRef = useRef<string | null>(null);
  const teachStartedRef = useRef<string | null>(null);
  const advancingRef = useRef(false);
  const mountedRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeIndex = lesson?.currentIndex ?? 0;
  const activeConcept = lesson?.plan[activeIndex];
  const activeCheck =
    activeConcept?.check && !activeConcept.check.answered
      ? activeConcept.check
      : null;
  const isDone = lesson?.status === "done";
  const currentTeach = messages.some(
    (message) =>
      message.kind === "teach" && message.conceptIndex === activeIndex,
  );
  const latestTeachId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.kind === "teach" && message.conceptIndex === activeIndex) {
        return message.id;
      }
    }
    return undefined;
  }, [messages, activeIndex]);

  const scrollTrigger = `${messages.length}:${live?.text.length ?? 0}:${
    busy ?? ""
  }:${activeCheck?.question ?? ""}:${isDone ? "done" : ""}`;
  const { containerRef, onScroll, jumpToEnd } =
    useAutoScroll<HTMLDivElement>(scrollTrigger);

  useEffect(() => {
    if (messages.length) jumpToEnd();
  }, [messages.length, jumpToEnd]);

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
    if (!lesson || !pages) return;
    if (lesson.plan.length > 0 || lesson.status !== "planning") return;
    if (planStartedRef.current === lesson.id) return;

    const blankCount = pages.filter(
      (page) => page.text.replace(/\s+/g, "").length < 40,
    ).length;
    const textChars = pages.reduce((sum, page) => sum + page.text.length, 0);
    const needsOcr =
      pages.length > 0 &&
      (textChars < 200 || blankCount >= Math.ceil(pages.length * 0.6));

    if (needsOcr && !book) return;
    if (needsOcr && !settings.apiKey.trim()) {
      setPlanError("Add your Gemini API key in Settings first.");
      void db.lessons.update(lesson.id, { status: "error" });
      return;
    }

    planStartedRef.current = lesson.id;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("planning");
    setPlanError("");
    setOcrProgress(null);

    (async () => {
      try {
        let workingPages = pages;
        if (needsOcr && book) {
          setOcrProgress({ done: 0, total: blankCount });
          await readScannedPages({
            book,
            startPage: lesson.startPage,
            endPage: lesson.endPage,
            settings,
            signal: controller.signal,
            onProgress: (progress) => {
              if (!mountedRef.current) return;
              setOcrProgress({
                done: progress.done,
                total: progress.total,
              });
            },
          });
          if (controller.signal.aborted) return;
          workingPages = await pagesFor(
            book.id,
            lesson.startPage,
            lesson.endPage,
          );
          if (!mountedRef.current) return;
          setPages(workingPages);
          setOcrProgress(null);
        }

        const plan = await makePlan({
          settings,
          bookTitle: lesson.bookTitle,
          chapterTitle: lesson.chapterTitle,
          startPage: lesson.startPage,
          endPage: lesson.endPage,
          pages: workingPages,
        });
        if (controller.signal.aborted || !mountedRef.current) return;
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
        setPlanError(describeAIError(caught));
        await db.lessons.update(lesson.id, { status: "error" });
      } finally {
        if (mountedRef.current && !controller.signal.aborted) {
          setBusy(null);
          setOcrProgress(null);
        }
      }
    })();
  }, [lesson, pages, book, settings]);

  const startTeach = useCallback(
    async (index: number) => {
      if (!lesson || !pages || !lesson.plan[index]) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setTeachError("");
      setSendError(null);
      setBusy("teaching");
      setLive({ mode: "teach", text: "", index });
      jumpToEnd();
      const concept = lesson.plan[index];

      try {
        const raw = await teachConcept({
          settings,
          chapterTitle: lesson.chapterTitle,
          pages,
          plan: lesson.plan,
          index,
          history: messagesToTurns(messages),
          onDelta: (delta) => {
            if (!mountedRef.current) return;
            setLive((current) =>
              current ? { ...current, text: current.text + delta } : current,
            );
          },
          signal: controller.signal,
        });
        if (controller.signal.aborted || !mountedRef.current) return;

        const { explanation, check } = parseTeach(raw, concept.title);
        const messageId = await db.messages.add({
          lessonId: lesson.id,
          role: "tutor",
          kind: "teach",
          content: `${explanation}\n\n${check}`,
          conceptIndex: index,
          checkQuestion: check,
          createdAt: Date.now(),
        });
        const latest = await db.lessons.get(lesson.id);
        if (latest) {
          const nextPlan = latest.plan.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  check: {
                    question: check,
                    messageId,
                    answered: false,
                    attempts: 0,
                  },
                }
              : item,
          );
          await db.lessons.update(lesson.id, {
            plan: nextPlan,
            status: "active",
            updatedAt: Date.now(),
          });
        }
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
    if (lesson.status !== "active") return;
    if (busy !== null) return;
    const index = lesson.currentIndex;
    const concept = lesson.plan[index];
    if (!concept || concept.covered) return;
    const key = `${lesson.id}:${index}`;
    if (teachStartedRef.current === key) return;
    if (
      messages.some(
        (message) => message.kind === "teach" && message.conceptIndex === index,
      )
    ) {
      return;
    }
    teachStartedRef.current = key;
    void startTeach(index);
  }, [lesson, pages, messages, busy, startTeach]);

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
    const attempt =
      (previousCheck?.attempts ?? 0) + (isQuestion ? 0 : 1);
    const nextQuestion = evaluation.followUp ?? previousQuestion;
    const answered = isQuestion
      ? false
      : Boolean(evaluation.mastered || !evaluation.followUp);
    const mastery: Mastery | undefined = isQuestion
      ? concept.mastery
      : evaluation.mastered
        ? "passed"
        : !evaluation.followUp
          ? "shaky"
          : concept.mastery;

    const nextPlan = latest.plan.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            mastery,
            check: {
              question: nextQuestion,
              messageId: previousCheck?.messageId ?? 0,
              answered,
              verdict: isQuestion
                ? previousCheck?.verdict
                : (evaluation.verdict as Exclude<Verdict, "question">),
              mastered: isQuestion
                ? previousCheck?.mastered
                : evaluation.mastered,
              attempts: attempt,
              followUp: evaluation.followUp,
            },
          }
        : item,
    );
    await db.lessons.update(lesson.id, {
      plan: nextPlan,
      updatedAt: Date.now(),
    });
    await db.messages.add({
      lessonId: lesson.id,
      role: "tutor",
      kind: isQuestion ? "chat" : "feedback",
      content: `${evaluation.reply}${
        evaluation.followUp ? `\n\n${evaluation.followUp}` : ""
      }`,
      conceptIndex: index,
      createdAt: Date.now() + 1,
    });
  };

  const send = async (override?: string, alreadySaved = false) => {
    if (!lesson || !pages || busy) return;
    const text = (override ?? composer).trim();
    if (!text) return;
    if (!settings.apiKey.trim()) {
      setSendError({
        message: "Add your Gemini API key in Settings first.",
        text,
      });
      return;
    }
    const index = activeIndex;
    const concept = lesson.plan[index];
    if (!concept) return;

    setSendError(null);
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
      const index = lesson.currentIndex;
      const concept = lesson.plan[index];
      if (!concept) return;
      const check = concept.check;
      const mastery: Mastery = check?.mastered
        ? "passed"
        : check && check.attempts > 0
          ? "shaky"
          : "skipped";
      const nextPlan = lesson.plan.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              covered: true,
              coveredAt: Date.now(),
              mastery,
            }
          : item,
      );
      const nextIndex = index + 1;
      const done = nextIndex >= lesson.plan.length;
      await db.lessons.update(lesson.id, {
        plan: nextPlan,
        currentIndex: nextIndex,
        status: done ? "done" : "active",
        updatedAt: Date.now(),
      });
      if (done) {
        navigate("/");
        return;
      }
      teachStartedRef.current = `${lesson.id}:${nextIndex}`;
      void startTeach(nextIndex);
    } finally {
      advancingRef.current = false;
    }
  };

  const retryPlan = async () => {
    planStartedRef.current = null;
    setPlanError("");
    await db.lessons.update(id, { status: "planning" });
  };

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(120, element.scrollHeight)}px`;
  }, [composer]);

  const title = book?.title ?? lesson?.bookTitle ?? "";

  if (lesson === undefined) {
    return (
      <div className="lesson">
        <ChatBar title="" onBack={() => navigate("/")} />
        <div className="state-center">
          <Spinner size={22} />
        </div>
      </div>
    );
  }

  if (lesson === null) {
    return (
      <div className="lesson">
        <ChatBar title="" onBack={() => navigate("/")} />
        <div className="state-center">
          <p>This lesson isn’t here.</p>
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

  if (planError && lesson.plan.length === 0) {
    return (
      <div className="lesson">
        <ChatBar title={title} onBack={() => navigate("/")} />
        <div className="state-center">
          <p>{planError}</p>
          <button type="button" className="text-button" onClick={retryPlan}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (lesson.plan.length === 0 || pages === null) {
    return (
      <div className="lesson">
        <ChatBar title={title} onBack={() => navigate("/")} />
        <div className="state-center">
          <Spinner size={22} />
          <p>
            {ocrProgress
              ? ocrProgress.total > 0
                ? `Reading pages… ${ocrProgress.done} / ${ocrProgress.total}`
                : "Reading pages…"
              : "Building lesson…"}
          </p>
        </div>
      </div>
    );
  }

  const isLast = activeIndex >= lesson.plan.length - 1;
  const showNext =
    !isDone && Boolean(currentTeach) && busy === null && !teachError;

  return (
    <div className="lesson">
      <ChatBar title={title} onBack={() => navigate("/")} />

      <div className="chat-scroll" ref={containerRef} onScroll={onScroll}>
        <div className="chat-inner">
          {messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              concept={
                message.conceptIndex !== undefined
                  ? lesson.plan[message.conceptIndex]
                  : undefined
              }
              isActiveTeach={message.id === latestTeachId}
              bookId={lesson.bookId}
              settings={settings}
              onOpenImage={setImage}
            />
          ))}

          {live && (
            <div className="assistant">
              {live.text ? (
                <Markdown>
                  {live.mode === "teach"
                    ? visibleTeach(live.text)
                    : live.text}
                </Markdown>
              ) : (
                <TypingDots />
              )}
            </div>
          )}

          {busy === "grading" && (
            <div className="assistant">
              <TypingDots />
            </div>
          )}

          {sendError && (
            <div className="chat-error">
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

          {teachError && (
            <div className="chat-error">
              <span>{teachError}</span>
              <button
                type="button"
                className="text-button"
                onClick={() => void startTeach(activeIndex)}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      {!isDone && (
        <footer className="chat-foot">
          {showNext && (
            <div className="next-row">
              <button
                type="button"
                className="next-chip"
                onClick={() => void advance()}
              >
                {isLast ? "Finish" : "Next"}
                <ChevronRight size={15} />
              </button>
            </div>
          )}
          <div className="composer">
            <textarea
              ref={textareaRef}
              rows={1}
              value={composer}
              placeholder="Message"
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              disabled={busy !== null}
              enterKeyHint="send"
              aria-label="Message Cove"
            />
            <button
              type="button"
              className="send-button"
              onClick={() => void send()}
              disabled={busy !== null || !composer.trim()}
              aria-label="Send"
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </footer>
      )}

      {image && (
        <ImageViewer src={image} onClose={() => setImage(null)} />
      )}
    </div>
  );
}

function ChatBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="chat-bar">
      <button
        type="button"
        className="icon-button"
        onClick={onBack}
        aria-label="Back"
      >
        <ArrowLeft size={21} />
      </button>
      <div className="chat-title" title={title}>
        {title}
      </div>
      <span className="chat-bar-spacer" aria-hidden="true" />
    </header>
  );
}

function MessageRow({
  message,
  concept,
  isActiveTeach,
  bookId,
  settings,
  onOpenImage,
}: {
  message: Message;
  concept?: Concept;
  isActiveTeach: boolean;
  bookId: string;
  settings: { apiKey: string; model: string };
  onOpenImage: (src: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="user-row">
        <div className="user-bubble">{message.content}</div>
      </div>
    );
  }

  const showCheck =
    Boolean(message.checkQuestion) &&
    !message.content.includes(message.checkQuestion ?? "");

  return (
    <div className="assistant">
      <Markdown>{message.content}</Markdown>
      {showCheck && <p className="assistant-check">{message.checkQuestion}</p>}
      {isActiveTeach && concept && (
        <VisualStrip
          bookId={bookId}
          pageNumbers={concept.pages}
          settings={settings}
          onOpen={onOpenImage}
        />
      )}
    </div>
  );
}
