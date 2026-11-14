import { BookOpen, Leaf, SlidersHorizontal } from "lucide-react";
import type { Route } from "../hooks/useHashRoute";
import { cx } from "../lib/util";

export function BottomNav({
  route,
  navigate,
}: {
  route: Route;
  navigate: (path: string) => void;
}) {
  const tabs = [
    { id: "library", label: "Library", icon: BookOpen, path: "/" },
    { id: "progress", label: "Progress", icon: Leaf, path: "/progress" },
    {
      id: "settings",
      label: "Settings",
      icon: SlidersHorizontal,
      path: "/settings",
    },
  ] as const;

  return (
    <nav className="bottom-nav" aria-label="Main">
      <div className="bottom-nav-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = route.name === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={cx("nav-item", active && "is-active")}
              onClick={() => navigate(tab.path)}
              aria-current={active ? "page" : undefined}
            >
              <span className="nav-icon">
                <Icon size={20} strokeWidth={active ? 2 : 1.7} />
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
