import { Sheet } from "./Sheet";
import { figureKindLabel } from "../lib/visuals";
import type { VisualSelection } from "../lib/types";

export function VisualSheet({
  visual,
  onClose,
}: {
  visual: VisualSelection;
  onClose: () => void;
}) {
  const isPage = visual.kind === "page";
  return (
    <Sheet
      open
      onClose={onClose}
      title={isPage ? `Page ${visual.pageNo}` : figureKindLabel(visual.kind)}
      subtitle={
        isPage
          ? "From your book. Pinch or scroll to look closer."
          : `From page ${visual.pageNo} of your book.`
      }
      wide
      footer={
        <button
          type="button"
          className="btn btn-ghost btn-full"
          onClick={onClose}
        >
          Back to the lesson
        </button>
      }
    >
      <div className="visual-viewer">
        <img
          src={visual.dataUrl}
          alt={visual.caption ?? `Page ${visual.pageNo}`}
        />
      </div>
      {visual.caption && (
        <p className="visual-view-caption">{visual.caption}</p>
      )}
      <p className="fineprint">
        This picture comes from your own copy of the book. It stays on this
        device.
      </p>
    </Sheet>
  );
}
