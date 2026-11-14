import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { Wordmark } from "../components/Brand";
import { useSettings } from "../state/settings";

export function Welcome({ onDone }: { onDone: () => void }) {
  const { settings, update } = useSettings();
  const [name, setName] = useState(settings.name);
  const [key, setKey] = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);

  const hasKey = key.trim().length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update({
      name: name.trim().slice(0, 60),
      apiKey: key.trim(),
      demo: !hasKey,
      onboarded: true,
    });
    onDone();
  };

  return (
    <main className="welcome">
      <div className="welcome-glow" aria-hidden="true" />
      <div className="welcome-inner">
        <div className="welcome-mark">
          <Wordmark size={27} />
        </div>

        <header className="welcome-head">
          <p className="eyebrow">Your textbook, one idea at a time</p>
          <h1 className="welcome-title">
            A quiet place
            <br />
            to learn.
          </h1>
          <p className="welcome-lede">
            Upload a chapter. I’ll turn it into a conversation — short
            explanations, real questions, and the figures from your book.
          </p>
        </header>

        <form className="welcome-card" onSubmit={submit}>
          <label className="field">
            <span className="field-label">What should I call you?</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="given-name"
              maxLength={60}
            />
          </label>

          <label className="field">
            <span className="field-label">
              Gemini key
              <span className="field-optional">optional</span>
            </span>
            <span className="input-with-action">
              <KeyRound size={16} className="input-icon" aria-hidden="true" />
              <input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Paste your API key"
                autoComplete="off"
                spellCheck={false}
                aria-label="Gemini API key"
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowKey((value) => !value)}
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
            <span className="field-hint">
              You can add it later in Settings.{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer noopener"
              >
                Get a key
              </a>
            </span>
          </label>

          <button type="submit" className="btn btn-primary btn-full welcome-submit">
            {hasKey ? "Start learning" : "Start in preview"}
            <ArrowRight size={17} />
          </button>

          <p className="welcome-note">
            {hasKey
              ? "The key is saved only in this browser. Your chapters go straight from this device to Gemini."
              : "No key yet? You can walk through a canned lesson preview first."}
          </p>
        </form>

        <div className="welcome-foot">
          <Lock size={14} aria-hidden="true" />
          <span>No account. No server. Everything stays on this device.</span>
        </div>
      </div>
    </main>
  );
}
