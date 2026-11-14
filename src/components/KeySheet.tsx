import { useState } from "react";
import { Sheet } from "./Sheet";

export function KeySheet({
  onClose,
  onSave,
  hasKey,
}: {
  onClose: () => void;
  onSave: (key: string) => void;
  hasKey: boolean;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();

  return (
    <Sheet
      open
      onClose={onClose}
      title="Settings"
      footer={
        <button
          type="button"
          className="primary-button"
          disabled={!trimmed}
          onClick={() => onSave(trimmed)}
        >
          Save
        </button>
      }
    >
      <label className="field">
        <span>Gemini API key</span>
        <input
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && trimmed) onSave(trimmed);
          }}
          placeholder={hasKey ? "Paste a new key" : "Paste your key"}
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
      </label>
    </Sheet>
  );
}
