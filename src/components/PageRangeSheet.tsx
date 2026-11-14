import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Sheet } from "./Sheet";
import { clamp } from "../lib/util";

export function PageRangeSheet({
  pageCount,
  onClose,
  onStart,
}: {
  pageCount: number;
  onClose: () => void;
  onStart: (startPage: number, endPage: number) => void;
}) {
  const defaultSpan = pageCount > 60 ? 20 : pageCount;
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(Math.min(pageCount, defaultSpan));
  const [touched, setTouched] = useState(false);

  const safeStart = clamp(Math.round(start) || 1, 1, pageCount);
  const safeEnd = clamp(Math.round(end) || 1, 1, pageCount);
  const valid = safeEnd >= safeStart;
  const count = valid ? safeEnd - safeStart + 1 : 0;
  const minutes = Math.max(4, Math.round(count * 0.7));

  const step = (which: "start" | "end", delta: number) => {
    if (which === "start") setStart(clamp(safeStart + delta, 1, safeEnd));
    else setEnd(clamp(safeEnd + delta, safeStart, pageCount));
    setTouched(true);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Choose a passage"
      subtitle={`${pageCount} pages in this book`}
      footer={
        <button
          type="button"
          className="btn btn-primary btn-full"
          disabled={!valid || count === 0}
          onClick={() => onStart(safeStart, safeEnd)}
        >
          Continue
          <ArrowRight size={17} />
        </button>
      }
    >
      <div className="range-row">
        <div className="range-field">
          <label htmlFor="range-start">From page</label>
          <div className="stepper">
            <button
              type="button"
              onClick={() => step("start", -1)}
              aria-label="Previous page"
            >
              −
            </button>
            <input
              id="range-start"
              inputMode="numeric"
              pattern="[0-9]*"
              value={start}
              onChange={(event) => {
                setStart(Number(event.target.value.replace(/\D/g, "")) || 0);
                setTouched(true);
              }}
              onBlur={() => setStart(safeStart)}
            />
            <button
              type="button"
              onClick={() => step("start", 1)}
              aria-label="Next page"
            >
              +
            </button>
          </div>
        </div>
        <span className="range-dash" aria-hidden="true">
          —
        </span>
        <div className="range-field">
          <label htmlFor="range-end">To page</label>
          <div className="stepper">
            <button
              type="button"
              onClick={() => step("end", -1)}
              aria-label="Previous page"
            >
              −
            </button>
            <input
              id="range-end"
              inputMode="numeric"
              pattern="[0-9]*"
              value={end}
              onChange={(event) => {
                setEnd(Number(event.target.value.replace(/\D/g, "")) || 0);
                setTouched(true);
              }}
              onBlur={() => setEnd(safeEnd)}
            />
            <button
              type="button"
              onClick={() => step("end", 1)}
              aria-label="Next page"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className={valid ? "range-summary" : "range-summary is-error"}>
        {valid ? (
          <>
            <strong>{count} pages</strong>
            <span>about {minutes} minutes of learning</span>
          </>
        ) : (
          <span>The last page needs to come after the first.</span>
        )}
      </div>

      <div className="quick-picks">
        <button
          type="button"
          className="pill"
          onClick={() => {
            setStart(1);
            setEnd(Math.min(pageCount, 10));
            setTouched(true);
          }}
        >
          10 pages
        </button>
        <button
          type="button"
          className="pill"
          onClick={() => {
            setStart(1);
            setEnd(Math.min(pageCount, 20));
            setTouched(true);
          }}
        >
          20 pages
        </button>
        {pageCount <= 60 && (
          <button
            type="button"
            className="pill"
            onClick={() => {
              setStart(1);
              setEnd(pageCount);
              setTouched(true);
            }}
          >
            Whole book
          </button>
        )}
      </div>
      {!touched && (
        <p className="fineprint">
          Pick the pages you want to understand. You can come back for another
          passage anytime.
        </p>
      )}
    </Sheet>
  );
}
