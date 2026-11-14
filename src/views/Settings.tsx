import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CloudOff,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Share,
  Sparkles,
  Upload,
} from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Spinner } from "../components/Brand";
import { testConnection } from "../lib/ai";
import { clearAllData } from "../lib/db";
import { downloadBackup, importBackup } from "../lib/backup";
import { describeAIError } from "../lib/gemini";
import { IS_IOS, IS_STANDALONE } from "../lib/device";
import { MODEL_OPTIONS, modelName } from "../lib/models";
import { formatBytes } from "../lib/util";
import { Wordmark } from "../components/Brand";
import { useSettings } from "../state/settings";
import { useToast } from "../state/toast";

export function Settings({ navigate }: { navigate: (path: string) => void }) {
  const { settings, update } = useSettings();
  const { show } = useToast();
  const [name, setName] = useState(settings.name);
  const [key, setKey] = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [modelChoice, setModelChoice] = useState(
    MODEL_OPTIONS.some((option) => option.id === settings.model)
      ? settings.model
      : "custom",
  );
  const [customModel, setCustomModel] = useState(
    MODEL_OPTIONS.some((option) => option.id === settings.model)
      ? ""
      : settings.model,
  );
  const [testState, setTestState] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");
  const [storage, setStorage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.storage
      ?.estimate()
      .then((estimate) => {
        if (!cancelled && estimate.usage !== undefined) {
          setStorage(formatBytes(estimate.usage));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const hasKey = settings.apiKey.length > 0;
  const keyChanged = key.trim() !== settings.apiKey;
  const showKeyActions = key.trim().length > 0 || hasKey;
  const selectedModelNote =
    modelChoice === "custom"
      ? "Enter the exact model ID from your Gemini account."
      : MODEL_OPTIONS.find((option) => option.id === modelChoice)?.note ??
        "Choose the model you want to use.";
  const demo = settings.demo || !hasKey;

  const saveName = () => {
    const clean = name.trim().slice(0, 60);
    if (clean !== settings.name) update({ name: clean });
  };

  const saveKey = (event?: FormEvent) => {
    event?.preventDefault();
    const clean = key.trim();
    update({ apiKey: clean, demo: clean ? false : true });
    setTestState("idle");
    setTestMessage("");
    show(clean ? "Gemini key saved." : "Key removed. Preview mode is on.");
  };

  const testKey = async () => {
    const candidate = key.trim() || settings.apiKey;
    if (!candidate) {
      show("Add a Gemini key first.", "error");
      return;
    }
    const model =
      modelChoice === "custom"
        ? customModel.trim() || settings.model
        : modelChoice;
    if (!model) {
      show("Choose a model first.", "error");
      return;
    }
    setTestState("testing");
    setTestMessage("");
    try {
      await testConnection(candidate, model);
      setTestState("ok");
      setTestMessage(`Connected to ${modelName(model)}.`);
    } catch (caught) {
      setTestState("error");
      setTestMessage(describeAIError(caught));
    }
  };

  const pickModel = (value: string) => {
    setModelChoice(value);
    setTestState("idle");
    setTestMessage("");
    if (value === "custom" && !customModel.trim()) {
      setCustomModel(settings.model);
    }
    if (value !== "custom") {
      update({ model: value });
    }
  };

  const saveCustomModel = () => {
    const clean = customModel.trim();
    if (clean) {
      update({ model: clean });
      setTestState("idle");
      setTestMessage("");
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const size = await downloadBackup();
      show(`Backup saved · ${formatBytes(size)}`, "success");
    } catch {
      show("Couldn’t make the backup.", "error");
    } finally {
      setExporting(false);
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setImporting(true);
    try {
      const summary = await importBackup(pendingImport);
      setPendingImport(null);
      show(
        `Restored ${summary.books} ${summary.books === 1 ? "book" : "books"} and ${summary.lessons} lessons.`,
        "success",
      );
      navigate("/");
    } catch (caught) {
      show(describeAIError(caught), "error");
    } finally {
      setImporting(false);
    }
  };

  const clearEverything = async () => {
    setClearBusy(true);
    try {
      await clearAllData();
      setClearOpen(false);
      show("Books and progress cleared.");
      navigate("/");
    } catch {
      show("Couldn’t clear the data.", "error");
    } finally {
      setClearBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.split("#")[0]);
      show("Link copied.", "success");
    } catch {
      show("Couldn’t copy the link.", "error");
    }
  };

  return (
    <main className="page settings-page">
      <header className="settings-head">
        <div className="library-top">
          <Wordmark size={22} />
        </div>
        <p className="eyebrow">Settings</p>
        <h1 className="display">Make it yours.</h1>
      </header>

      <section className="settings-card">
        <div className="settings-card-head">
          <div>
            <h2>You</h2>
            <p>The name Cove uses when it talks to you.</p>
          </div>
        </div>
        <label className="field">
          <span className="field-label">Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={saveName}
            placeholder="Your name"
            maxLength={60}
          />
        </label>
      </section>

      <section className="settings-card">
        <div className="settings-card-head">
          <div>
            <h2>Gemini</h2>
            <p>
              Cove sends the pages you choose straight from this device to
              Gemini. Page images are sent once per page to find its figures.
              No server in between.
            </p>
          </div>
          <span className={demo ? "status-dot is-demo" : "status-dot is-live"}>
            {demo ? "Preview" : "Live"}
          </span>
        </div>

        <form className="settings-form" onSubmit={saveKey}>
          <label className="field">
            <span className="field-label">
              API key
              {hasKey && <span className="field-optional">saved</span>}
            </span>
            <span className="input-with-action">
              <KeyRound size={16} className="input-icon" aria-hidden="true" />
              <input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder={hasKey ? "••••••••••••••••" : "Paste your Gemini key"}
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
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer noopener"
              >
                Get a key from Google AI Studio
              </a>
              . Stored only in this browser.
            </span>
          </label>

          {showKeyActions && (
            <div className="settings-actions">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!keyChanged}
              >
                {key.trim() ? "Save key" : "Remove key"}
              </button>
              {hasKey && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void testKey()}
                  disabled={testState === "testing"}
                >
                  {testState === "testing" && <Spinner size={14} />}
                  Test connection
                </button>
              )}
            </div>
          )}
          {testMessage && (
            <p
              className={
                testState === "error"
                  ? "test-message is-error"
                  : "test-message is-ok"
              }
            >
              {testMessage}
            </p>
          )}
        </form>

        <label className="field">
          <span className="field-label">Model</span>
          <select
            value={modelChoice}
            onChange={(event) => pickModel(event.target.value)}
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
            <option value="custom">Custom model ID…</option>
          </select>
          {modelChoice === "custom" && (
            <span className="custom-model-row">
              <input
                type="text"
                value={customModel}
                onChange={(event) => setCustomModel(event.target.value)}
                onBlur={saveCustomModel}
                placeholder="e.g. gemini-3.8-flash"
                spellCheck={false}
                autoComplete="off"
                aria-label="Custom model ID"
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={saveCustomModel}
              >
                Use
              </button>
            </span>
          )}
          <span className="field-hint">
            {selectedModelNote} Longer chapters use more tokens.
          </span>
        </label>

        <div className="toggle-row">
          <div>
            <span className="toggle-title">Preview mode</span>
            <span className="toggle-note">
              Canned lessons. No key used. Good for a first look.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.demo}
            aria-label="Preview mode"
            className={`switch ${settings.demo ? "is-on" : ""}`}
            onClick={() => {
              if (!hasKey) {
                show("Add a Gemini key first.", "error");
                return;
              }
              update({ demo: !settings.demo });
            }}
            disabled={!hasKey}
          >
            <span />
          </button>
        </div>

        <div className="privacy-line">
          <Lock size={13} />
          <span>
            The key lives in this browser’s storage. Page text and page images
            go to Gemini when you learn or when Cove looks for figures. Anyone
            who can use this device and browser could read the key, so use one
            made for this app.
          </span>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-head">
          <div>
            <h2>On her iPhone</h2>
            <p>Cove installs from Safari — no App Store, no Apple account.</p>
          </div>
          <Share size={19} className="settings-head-icon" />
        </div>
        {IS_STANDALONE ? (
          <div className="install-done">
            <span className="install-check">✓</span>
            <div>
              <p>Cove is on your Home Screen.</p>
              <span>
                It opens like an app and keeps your books and progress on this
                device.
              </span>
            </div>
          </div>
        ) : (
          <>
            <ol className="install-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Open this page in Safari.</strong>
                  <p>Not Chrome, and not a preview inside another app.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Tap the Share button.</strong>
                  <p>The square with the arrow, in the Safari toolbar.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Add to Home Screen → Add.</strong>
                  <p>Cove gets its own icon and opens full screen.</p>
                </div>
              </li>
            </ol>
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void copyLink()}
              >
                Copy link
              </button>
              {IS_IOS && (
                <span className="field-hint">
                  Keep using Safari for the first install.
                </span>
              )}
            </div>
          </>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card-head">
          <div>
            <h2>Your data</h2>
            <p>
              Everything is on this device. A backup keeps the lessons,
              progress, and saved pictures, but not the original PDFs.
            </p>
          </div>
          <Database size={19} className="settings-head-icon" />
        </div>
        <div className="data-rows">
          <button
            type="button"
            className="data-row"
            onClick={() => void exportData()}
            disabled={exporting}
          >
            <span className="data-icon">
              {exporting ? <Spinner size={16} /> : <Download size={17} />}
            </span>
            <span className="data-copy">
              <strong>Save a backup</strong>
              <span>Books, lessons, page text, review dates, and pictures.</span>
            </span>
            <ArrowRight size={15} className="data-arrow" />
          </button>
          <button
            type="button"
            className="data-row"
            onClick={() => importRef.current?.click()}
          >
            <span className="data-icon">
              <Upload size={17} />
            </span>
            <span className="data-copy">
              <strong>Restore a backup</strong>
              <span>Replaces everything currently in Cove.</span>
            </span>
            <ArrowRight size={15} className="data-arrow" />
          </button>
          <button
            type="button"
            className="data-row is-danger"
            onClick={() => setClearOpen(true)}
          >
            <span className="data-icon">
              <CloudOff size={17} />
            </span>
            <span className="data-copy">
              <strong>Clear all books and progress</strong>
              <span>Your Gemini key stays.</span>
            </span>
            <ArrowRight size={15} className="data-arrow" />
          </button>
        </div>
        {storage && (
          <p className="fineprint">This app is using about {storage} on this device.</p>
        )}
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) setPendingImport(file);
          }}
        />
      </section>

      <section className="settings-card about-card">
        <div className="about-mark">
          <Sparkles size={17} />
        </div>
        <div>
          <h2>About Cove</h2>
          <p>
            A quiet little tutor for one very large textbook. No account, no
            server, no streaks. Built with Gemini.
          </p>
          <p className="fineprint">
            Version 1.0 · Local-first · Your progress is yours.
          </p>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Replace everything?"
        message="Restoring a backup clears the books, lessons, and progress currently on this device. Your Gemini key stays. This cannot be undone."
        confirmLabel="Restore backup"
        busy={importing}
        onCancel={() => setPendingImport(null)}
        onConfirm={() => void confirmImport()}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Clear all books and progress?"
        message="Every book, lesson, check, and review date will be deleted from this device. The original PDFs on your computer are untouched. Your Gemini key stays."
        confirmLabel="Clear everything"
        danger
        busy={clearBusy}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => void clearEverything()}
      />
    </main>
  );
}
