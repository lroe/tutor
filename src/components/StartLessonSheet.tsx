import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Sheet } from "./Sheet";
import { cx } from "../lib/util";
import type {
  Chapter,
  LearnerGoal,
  LearnerLevel,
  LearnerProfile,
  LearnerTime,
} from "../lib/types";

const LEVELS: Array<{ id: LearnerLevel; label: string; hint: string }> = [
  { id: "new", label: "New to me", hint: "Start from the ground up" },
  { id: "some", label: "A little", hint: "I've read some of this" },
  { id: "confident", label: "Confident", hint: "Skip the basics" },
];

const TIMES: Array<{ id: LearnerTime; label: string }> = [
  { id: "short", label: "10 min" },
  { id: "medium", label: "20 min" },
  { id: "open", label: "Open-ended" },
];

const GOALS: Array<{ id: LearnerGoal; label: string }> = [
  { id: "understand", label: "Understand it" },
  { id: "exam", label: "Exam prep" },
  { id: "clinical", label: "Clinical links" },
];

export function StartLessonSheet({
  chapter,
  chapterIndex,
  chapterCount,
  onClose,
  onStart,
}: {
  chapter: Chapter;
  chapterIndex?: number;
  chapterCount?: number;
  onClose: () => void;
  onStart: (profile: LearnerProfile) => void;
}) {
  const [level, setLevel] = useState<LearnerLevel>("some");
  const [time, setTime] = useState<LearnerTime>("medium");
  const [goal, setGoal] = useState<LearnerGoal>("understand");

  return (
    <Sheet
      open
      onClose={onClose}
      title="Before we begin"
      subtitle={`${chapter.title} · ${
        chapter.startPage === chapter.endPage
          ? `page ${chapter.startPage}`
          : `pages ${chapter.startPage}–${chapter.endPage}`
      }`}
      footer={
        <button
          type="button"
          className="btn btn-primary btn-full"
          onClick={() => onStart({ level, time, goal })}
        >
          <Sparkles size={17} />
          Build my lesson
        </button>
      }
    >
      <div className="setup-groups">
        <div className="setup-group">
          <div className="setup-label">How well do you know this?</div>
          <div className="choice-row">
            {LEVELS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cx(
                  "choice",
                  level === option.id && "is-selected",
                )}
                onClick={() => setLevel(option.id)}
                aria-pressed={level === option.id}
              >
                <span className="choice-title">{option.label}</span>
                <span className="choice-hint">{option.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="setup-group">
          <div className="setup-label">How long do you have?</div>
          <div className="choice-row choice-row-compact">
            {TIMES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cx(
                  "choice choice-inline",
                  time === option.id && "is-selected",
                )}
                onClick={() => setTime(option.id)}
                aria-pressed={time === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-group">
          <div className="setup-label">What would help most?</div>
          <div className="choice-row choice-row-compact">
            {GOALS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cx(
                  "choice choice-inline",
                  goal === option.id && "is-selected",
                )}
                onClick={() => setGoal(option.id)}
                aria-pressed={goal === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="fineprint setup-note">
        This shapes how many ideas I pick and what I emphasise.
        {chapterIndex !== undefined && chapterCount !== undefined
          ? ` Chapter ${chapterIndex + 1} of ${chapterCount}.`
          : ""}
      </p>
    </Sheet>
  );
}
