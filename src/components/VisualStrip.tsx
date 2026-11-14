import { useEffect, useMemo, useState } from "react";
import { ensureFigures, figuresForPages, loadPageImages, visualPages } from "../lib/visuals";
import type { Figure, PageImage, Settings } from "../lib/types";

export function VisualStrip({
  bookId,
  pageNumbers,
  settings,
  onOpen,
}: {
  bookId: string;
  pageNumbers: number[];
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
          // Page pictures still work without the extra figure crops.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, pageKey, settings.apiKey, settings.model]);

  if (!loading && images.length === 0 && figures.length === 0) return null;

  const items = [
    ...figures.map((figure) => ({
      id: figure.id,
      src: figure.dataUrl,
      pageNo: figure.pageNo,
    })),
    ...images.map((image) => ({
      id: image.id,
      src: image.dataUrl,
      pageNo: image.pageNo,
    })),
  ].slice(0, 6);

  return (
    <div className="message-images">
      {loading && items.length === 0 && (
        <>
          <span className="thumb-skeleton" />
          <span className="thumb-skeleton is-wide" />
        </>
      )}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="thumb"
          onClick={() => onOpen(item.src)}
          aria-label={`Open picture from page ${item.pageNo}`}
        >
          <img src={item.src} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  );
}
