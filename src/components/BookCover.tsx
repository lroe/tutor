import type { Book } from "../lib/types";
import { cx, hashString } from "../lib/util";

export function BookCover({
  book,
  size = "md",
}: {
  book: Pick<Book, "id" | "title" | "author" | "cover">;
  size?: "sm" | "md" | "lg";
}) {
  const tone = hashString(book.id) % 4;
  const initials = book.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className={cx("book-cover", `cover-${size}`, `tone-${tone}`)}>
      {book.cover ? (
        <img src={book.cover} alt="" loading="lazy" />
      ) : (
        <div className="cover-fallback">
          <span className="cover-initials">{initials || "C"}</span>
          <span className="cover-author">{book.author ?? "Textbook"}</span>
        </div>
      )}
      <span className="cover-spine" aria-hidden="true" />
      <span className="cover-shine" aria-hidden="true" />
    </div>
  );
}
