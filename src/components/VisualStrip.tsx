import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Maximize2 } from "lucide-react";
import { isDemoMode } from "../lib/ai";
import {
  ensureFigures,
  figuresForPages,
  figureKindLabel,
  loadPageImages,
  visualPages,
} from "../lib/visuals";
import type {
  Figure,
  PageImage,
  Settings,
  VisualSelection,
} from "../lib/types";

export function VisualStrip({
  bookId,
  pageNumbers,
  settings,
  onOpen,
}: {
  bookId: string;
  pageNumbers: number[];
  settings: Settings;
  onOpen: (visual: VisualSelection) => void;
}) {
  const pages = useMemo(() => visualPages(pageNumbers), [pageNumbers.join(",")]);
  const pageKey = pages.join(",");
  const [images, setImages] = useState<PageImage[]>([]);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setImages([]);
    setFigures([]);
    setLoading(true);
    setDetecting(false);

    (async () => {
      const loaded = await loadPageImages(bookId, pages);
      if (cancelled) return;
      setImages(loaded);
      const cached = await figuresForPages(bookId, pages);
      if (cancelled) return;
      setFigures(cached);
      setLoading(false);

      if (!loaded.length || isDemoMode(settings)) return;
      setDetecting(true);
      const collected = [...cached];
      for (const image of loaded) {
        if (cancelled) break;
        try {
          const found = await ensureFigures(bookId, image.pageNo, settings);
          for (const figure of found) {
            if (!collected.some((item) => item.id === figure.id)) {
              collected.push(figure);
            }
          }
          if (!cancelled) {
            setFigures(
              [...collected].sort(
                (a, b) => a.pageNo - b.pageNo || a.box[0] - b.box[0],
              ),
            );
          }
        } catch {
          // Page pictures are still useful; figure detection is a bonus.
        }
      }
      if (!cancelled) setDetecting(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, pageKey, settings.apiKey, settings.model, settings.demo]);

  if (!loading && images.length === 0) return null;
  if (!pages.length) return null;

  const pageLabel =
    pages.length === 1
      ? `p. ${pages[0]}`
      : `pp. ${pages[0]}–${pages[pages.length - 1]}`;
  const showPageCards = images;

  return (
    <div className="visuals" aria-label="Pictures from your chapter">
      <div className="visuals-head">
        <span className="visuals-label">
          <ImageIcon size={11} />
          From the chapter
        </span>
        <span>{pageLabel}</span>
      </div>
      <div className="visuals-row">
        {loading &&
          images.length === 0 &&
          [0, 1].map((index) => (
            <span className="visual-skeleton" key={index}>
              <span />
            </span>
          ))}

        {figures.map((figure) => (
          <button
            key={figure.id}
            type="button"
            className="visual-card visual-figure"
            onClick={() =>
              onOpen({
                dataUrl: figure.dataUrl,
                title: `From page ${figure.pageNo}`,
                caption: figure.caption,
                pageNo: figure.pageNo,
                kind: figure.kind,
              })
            }
          >
            <span className="visual-image-wrap">
              <img src={figure.dataUrl} alt={figure.caption} loading="lazy" />
              <span className="visual-kind">
                {figureKindLabel(figure.kind)}
              </span>
              <span className="visual-expand">
                <Maximize2 size={10} />
              </span>
            </span>
            <span className="visual-caption">{figure.caption}</span>
          </button>
        ))}

        {showPageCards.map((image) => (
          <button
            key={image.id}
            type="button"
            className="visual-card visual-page"
            onClick={() =>
              onOpen({
                dataUrl: image.dataUrl,
                title: `Page ${image.pageNo}`,
                pageNo: image.pageNo,
                kind: "page",
              })
            }
          >
            <span className="visual-image-wrap">
              <img
                src={image.dataUrl}
                alt={`Page ${image.pageNo}`}
                loading="lazy"
              />
              <span className="visual-expand">
                <Maximize2 size={10} />
              </span>
            </span>
            <span className="visual-caption is-page">
              Page {image.pageNo}
            </span>
          </button>
        ))}
      </div>

      {detecting && (
        <span className="visuals-status">
          <span className="visuals-pulse" aria-hidden="true" />
          Looking for figures…
        </span>
      )}
    </div>
  );
}
