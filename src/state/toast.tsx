import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Info, TriangleAlert } from "lucide-react";
import { cx } from "../lib/util";

type ToastTone = "default" | "success" | "error";

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
  toast: ToastState | null;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);

  const show = useCallback((message: string, tone: ToastTone = "default") => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ show, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function ToastViewport() {
  const value = useContext(ToastContext);
  if (!value) return null;
  const { toast } = value;
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toast && (
        <div key={toast.id} className={cx("toast", `toast-${toast.tone}`)}>
          <span className="toast-icon" aria-hidden="true">
            {toast.tone === "error" ? (
              <TriangleAlert size={16} />
            ) : toast.tone === "success" ? (
              <Check size={16} />
            ) : (
              <Info size={16} />
            )}
          </span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
