import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function PageTopBar({
  title,
  onBack,
  action,
  center = true,
}: {
  title?: string;
  onBack: () => void;
  action?: ReactNode;
  center?: boolean;
}) {
  return (
    <header className="page-topbar">
      <button
        type="button"
        className="icon-button"
        onClick={onBack}
        aria-label="Back"
      >
        <ArrowLeft size={21} />
      </button>
      {title && (
        <div className={center ? "topbar-title is-center" : "topbar-title"}>
          {title}
        </div>
      )}
      <div className="topbar-action">{action}</div>
    </header>
  );
}
