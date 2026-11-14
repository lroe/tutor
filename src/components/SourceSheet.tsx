import { useLiveQuery } from "dexie-react-hooks";
import { BookMarked } from "lucide-react";
import { Sheet } from "./Sheet";
import { db } from "../lib/db";

export function SourceSheet({
  bookId,
  page,
  bookTitle,
  onClose,
}: {
  bookId: string;
  page: number;
  bookTitle: string;
  onClose: () => void;
}) {
  const pageText = useLiveQuery(
    () => db.pages.get(`${bookId}:${page}`),
    [bookId, page],
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Page ${page}`}
      subtitle={bookTitle}
      wide
      footer={
        <button type="button" className="btn btn-ghost btn-full" onClick={onClose}>
          Back to the lesson
        </button>
      }
    >
      <div className="source-meta">
        <BookMarked size={15} />
        <span>From your book. This is what Cove cited.</span>
      </div>
      {pageText?.text?.trim() ? (
        <div className="source-text">{pageText.text}</div>
      ) : (
        <p className="body-text">
          This page is image-only, so there’s no text to show yet. Use{" "}
          <strong>Read with Gemini</strong> from the book page to make it
          readable.
        </p>
      )}
      {pageText?.source === "ocr" && (
        <p className="fineprint">
          Read from the page image by Gemini. Small transcription errors are
          possible.
        </p>
      )}
    </Sheet>
  );
}
