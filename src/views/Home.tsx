import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Settings as SettingsIcon } from "lucide-react";
import { Wordmark } from "../components/Brand";
import { KeySheet } from "../components/KeySheet";
import { UploadOverlay } from "../components/UploadOverlay";
import { db } from "../lib/db";
import type { Book, Lesson } from "../lib/types";
import { useSettings } from "../state/settings";

export function Home({ navigate }: { navigate: (path: string) => void }) {
  const { settings, update } = useSettings();
  const books = useLiveQuery(
    () => db.books.orderBy("lastOpenedAt").reverse().toArray(),
    [],
    [] as Book[],
  );
  const lessons = useLiveQuery(
    () => db.lessons.toArray(),
    [],
    [] as Lesson[],
  );

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [homeError, setHomeError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const countFor = (bookId: string) =>
    lessons
      .filter((lesson) => lesson.bookId === bookId)
      .reduce(
        (sum, lesson) =>
          sum + lesson.plan.filter((concept) => concept.covered).length,
        0,
      );

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setHomeError("Choose a PDF.");
      return;
    }
    setHomeError("");
    setUploadFile(file);
  };

  return (
    <main className="home">
      <header className="home-bar">
        <Wordmark />
        <button
          type="button"
          className="icon-button"
          onClick={() => setKeyOpen(true)}
          aria-label="Settings"
        >
          <SettingsIcon size={19} />
        </button>
      </header>

      <div className="home-scroll">
        {books.length === 0 ? (
          <div className="home-empty">No notes yet</div>
        ) : (
          <div className="note-list">
            {books.map((book) => {
              const count = countFor(book.id);
              return (
                <button
                  key={book.id}
                  type="button"
                  className="note-row"
                  onClick={() => {
                    setHomeError("");
                    navigate(`/note/${book.id}`);
                  }}
                >
                  <span className="note-title">{book.title}</span>
                  <span className="note-count">
                    {count > 0
                      ? `${count} ${count === 1 ? "idea" : "ideas"} learned`
                      : "No ideas yet"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {homeError && <p className="home-error">{homeError}</p>}

      <button
        type="button"
        className="upload-bar"
        onClick={() => fileRef.current?.click()}
      >
        <Plus size={20} />
        <span>Upload a note</span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        onChange={onFile}
      />

      {uploadFile && (
        <UploadOverlay
          file={uploadFile}
          onClose={() => setUploadFile(null)}
          onDone={(book) => {
            setUploadFile(null);
            navigate(`/note/${book.id}?pages=1`);
          }}
        />
      )}

      {keyOpen && (
        <KeySheet
          hasKey={Boolean(settings.apiKey)}
          onClose={() => setKeyOpen(false)}
          onSave={(key) => {
            update({ apiKey: key });
            setKeyOpen(false);
          }}
        />
      )}
    </main>
  );
}
