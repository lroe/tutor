import { useEffect, useMemo, useState } from "react";
import { ensureFigures, figuresForPages, loadPageImages, visualPages } from "../lib/visuals";
import type { Figure, PageImage, Settings } from "../lib/types";

export function InlineFigure({
  bookId,
  pageNumbers,
  pageFilter,
  pageFallback = true,
  settings,
  onOpen,
}: {
  bookId: string;
  pageNumbers: number[];
  pageFilter?: number;
  pageFallback?: boolean;
  settings: Settings;
  onOpen: (src: string) => void;
}) {
  const pages = useMemo(
    () => visualPages(pageNumbers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageNumbers.join(",")],
  );
  const pageKey = pages.join(",");
  const [images, setImages] = useState<PageImage[]>([]);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setImages([]);
    setFigures([]);
    setLoading(true);

    (async () => {
      const loaded = await loadPageImages(bookId, pages);
      if (cancelled) return;
      setImages(loaded);
      const cached = await figuresForPages(bookId, pages);
      if (cancelled) return;
      setFigures(cached);
      setLoading(false);

      if (!loaded.length || !settings.apiKey.trim()) return;
      const found = [...cached];
      for (const image of loaded) {
        if (cancelled) break;
        try {
          const pageFigures = await ensureFigures(bookId, image.pageNo, settings);
          for (const figure of pageFigures) {
            if (!found.some((item) => item.id === figure.id)) {
              found.push(figure);
            }
          }
          if (!cancelled) {
            setFigures(
              [...found].sort(
                (a, b) => a.pageNo - b.pageNo || a.box[0] - b.box[0],
              ),
            );
          }
        } catch {
          // The page snapshot is still available.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, pageKey, settings.apiKey, settings.model]);

  if (loading && images.length === 0 && figures.length === 0) {
    return pageFallback ? (
      <span className="inline-figure-skeleton" aria-hidden="true" />
    ) : null;
  }

  const filteredFigures = pageFilter
    ? figures.filter((figure) => figure.pageNo === pageFilter)
    : figures;
  const filteredImages = pageFilter
    ? images.filter((image) => image.pageNo === pageFilter)
    : images;

  const figure = filteredFigures[0] ?? figures[0];
  const image = filteredImages[0] ?? images[0];
  if (!figure && !pageFallback) return null;
  const src = figure?.dataUrl ?? image?.dataUrl;
  if (!src) return null;

  return (
    <button
      type="button"
      className="inline-figure"
      onClick={() => onOpen(src)}
      aria-label="Open the figure from the note"
    >
      <img src={src} alt="" loading="lazy" />
    </button>
  );
}
