import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { Sheet } from "./Sheet";
import { Spinner } from "./Brand";
import { addBook } from "../lib/library";
import { describeAIError } from "../lib/gemini";
import type { Book } from "../lib/types";
import { isAbort } from "../lib/util";

type Phase = "working" | "error";

export function AddBookSheet({
  file,
  onClose,
  onDone,
}: {
  file: File;
  onClose: () => void;
  onDone: (book: Book) => void;
}) {
  const [phase, setPhase] = useState<Phase>("working");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    addBook(file, {
      signal: controller.signal,
      onProgress: (count, countTotal) => {
        setDone(count);
        setTotal(countTotal);
      },
    })
      .then((book) => {
        if (controller.signal.aborted) return;
        onDone(book);
      })
      .catch((caught) => {
        if (isAbort(caught) || controller.signal.aborted) return;
        setError(describeAIError(caught));
        setPhase("error");
      });

    return () => {
      controller.abort();
    };
  }, [file, onDone]);

  const percent =
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <Sheet
      open
      onClose={() => {
        abortRef.current?.abort();
        onClose();
      }}
      title={phase === "error" ? "That book wouldn’t open" : "One moment"}
      subtitle={
        phase === "error"
          ? "Nothing was added to your shelf."
          : "Reading your book for the first time"
      }
      footer={
        phase === "error" ? (
          <button
            type="button"
            className="btn btn-ghost btn-full"
            onClick={onClose}
          >
            Close
          </button>
        ) : undefined
      }
    >
      {phase === "working" ? (
        <div className="upload-progress">
          <div className="upload-icon">
            <BookOpen size={24} />
          </div>
          <div className="upload-copy">
            <div className="upload-filename" title={file.name}>
              {file.name}
            </div>
            <div className="upload-status">
              {total > 0
                ? `Page ${done} of ${total}`
                : "Opening the cover…"}
            </div>
          </div>
          {total > 0 && (
            <div
              className="progress-rail progress-rail-lg"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              aria-label="Reading pages"
            >
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
          )}
          <div className="upload-note">
            <Spinner size={15} />
            <span>
              This happens once. The PDF stays on this device — nothing is
              uploaded to a server.
            </span>
          </div>
        </div>
      ) : (
        <div className="upload-error">
          <p>{error || "Cove couldn’t read this PDF."}</p>
          <p className="fineprint">
            Password-protected PDFs need to be unlocked first. If the file is
            very large, try a smaller one.
          </p>
        </div>
      )}
    </Sheet>
  );
}
