import { useEffect, useRef, useState } from "react";
import { ScanText, Sparkles } from "lucide-react";
import { Sheet } from "./Sheet";
import { Spinner } from "./Brand";
import { isDemoMode } from "../lib/ai";
import { describeAIError } from "../lib/gemini";
import { readScannedPages } from "../lib/ocr";
import type { Book, Chapter, Settings } from "../lib/types";
import { isAbort } from "../lib/util";

type Phase = "offer" | "working" | "error";

export function ScanPagesSheet({
  book,
  chapter,
  blankCount,
  settings,
  onClose,
  onReady,
}: {
  book: Book;
  chapter: Chapter;
  blankCount: number;
  settings: Settings;
  onClose: () => void;
  onReady: () => void;
}) {
  const demo = isDemoMode(settings);
  const [phase, setPhase] = useState<Phase>("offer");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(blankCount);
  const [error, setError] = useState("");
  const [stopped, setStopped] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    },
    [],
  );

  const start = async () => {
    setPhase("working");
    setStopped(false);
    setError("");
    setDone(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await readScannedPages({
        book,
        startPage: chapter.startPage,
        endPage: chapter.endPage,
        settings,
        signal: controller.signal,
        onProgress: (progress) => {
          if (!mountedRef.current) return;
          setDone(progress.done);
          setTotal(progress.total);
        },
      });
      if (!mountedRef.current) return;
      onReady();
    } catch (caught) {
      if (!mountedRef.current) return;
      if (isAbort(caught) || controller.signal.aborted) {
        setStopped(true);
        setPhase("offer");
        return;
      }
      setError(describeAIError(caught));
      setPhase("error");
    }
  };

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Sheet
      open
      onClose={() => {
        abortRef.current?.abort();
        onClose();
      }}
      title={demo ? "Scanned pages" : blankCount === 1 ? "Make this page readable" : "Make these pages readable"}
      subtitle={`${chapter.title} · ${
        chapter.startPage === chapter.endPage
          ? `page ${chapter.startPage}`
          : `pages ${chapter.startPage}–${chapter.endPage}`
      }`}
      footer={
        phase === "working" ? (
          <button
            type="button"
            className="btn btn-ghost btn-full"
            onClick={() => abortRef.current?.abort()}
          >
            Stop
          </button>
        ) : phase === "error" ? (
          <div className="button-row">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn-primary" onClick={start}>
              Try again
            </button>
          </div>
        ) : demo ? (
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={onReady}
          >
            <Sparkles size={16} />
            Continue in preview
          </button>
        ) : (
          <div className="button-row">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Not now
            </button>
            <button type="button" className="btn btn-primary" onClick={start}>
              <ScanText size={16} />
              Read pages
            </button>
          </div>
        )
      }
    >
      {demo ? (
        <div className="scan-copy">
          <div className="scan-icon">
            <ScanText size={22} />
          </div>
          <p>
            These pages are pictures, not text. Reading them needs Gemini, and
            the preview doesn’t use your book’s words.
          </p>
          <p className="fineprint">
            You can still walk through the lesson flow now. Add a key in
            Settings, then read the pages whenever you’re ready.
          </p>
        </div>
      ) : phase === "offer" ? (
        <div className="scan-copy">
          <div className="scan-icon">
            <ScanText size={22} />
          </div>
          <p>
            <strong>
              {blankCount} {blankCount === 1 ? "page" : "pages"}
            </strong>{" "}
            {blankCount === 1
              ? "in this range is image-only, so Cove can’t read its words yet."
              : "in this range are image-only, so Cove can’t read their words yet."}
          </p>
          <ul className="scan-list">
            <li>Gemini reads each page image, on your key.</li>
            <li>It takes roughly a minute for a chapter.</li>
            <li>The pages are saved here for next time.</li>
          </ul>
          {stopped && done > 0 && (
            <p className="fineprint">
              Stopped after {done} {done === 1 ? "page" : "pages"}. The rest
              are still waiting.
            </p>
          )}
        </div>
      ) : phase === "working" ? (
        <div className="upload-progress">
          <div className="upload-icon">
            <ScanText size={22} />
          </div>
          <div className="upload-copy">
            <div className="upload-filename">Reading page images</div>
            <div className="upload-status">
              Page {done + 1} · {done} of {total} finished
            </div>
          </div>
          <div
            className="progress-rail progress-rail-lg"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="upload-note">
            <Spinner size={15} />
            <span>Keep this open. You can stop and come back later.</span>
          </div>
        </div>
      ) : (
        <div className="upload-error">
          <p>{error}</p>
          <p className="fineprint">
            Pages already read are saved. You can try again, or pick a smaller
            page range.
          </p>
        </div>
      )}
    </Sheet>
  );
}
