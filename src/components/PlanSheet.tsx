import { Check, Circle, LoaderCircle, RotateCcw } from "lucide-react";
import { Sheet } from "./Sheet";
import { cx } from "../lib/util";
import { kindLabel } from "../lib/review";
import type { Lesson } from "../lib/types";

export function PlanSheet({
  lesson,
  open,
  onClose,
}: {
  lesson: Lesson;
  open: boolean;
  onClose: () => void;
}) {
  const covered = lesson.plan.filter((concept) => concept.covered).length;
  const mastered = lesson.plan.filter(
    (concept) => concept.covered && concept.mastery === "passed",
  ).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="The path"
      subtitle={`${covered} of ${lesson.plan.length} ideas met · ${mastered} landed`}
      footer={
        <button type="button" className="btn btn-ghost btn-full" onClick={onClose}>
          Keep going
        </button>
      }
    >
      <ol className="plan-list">
        {lesson.plan.map((concept, index) => {
          const current =
            index === lesson.currentIndex && lesson.status !== "done";
          const passed = concept.mastery === "passed";
          const weak =
            concept.covered &&
            (concept.mastery === "shaky" || concept.mastery === "skipped");
          return (
            <li
              key={concept.id}
              className={cx(
                "plan-item",
                current && "is-current",
                concept.covered && "is-covered",
              )}
            >
              <span className="plan-status" aria-hidden="true">
                {passed ? (
                  <Check size={16} />
                ) : weak ? (
                  <RotateCcw size={15} />
                ) : current ? (
                  <LoaderCircle size={15} className="soft-spin" />
                ) : (
                  <Circle size={13} />
                )}
              </span>
              <div className="plan-copy">
                <div className="plan-title-row">
                  <span className="plan-title">{concept.title}</span>
                  <span className={cx("kind-chip", `kind-${concept.kind}`)}>
                    {kindLabel(concept.kind)}
                  </span>
                </div>
                {current && <p className="plan-goal">{concept.goal}</p>}
                {weak && (
                  <span className="plan-weak">
                    {concept.mastery === "skipped"
                      ? "Skipped the check"
                      : "Worth another look"}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="fineprint">
        You can jump back into any weak idea from the Progress tab.
      </p>
    </Sheet>
  );
}
