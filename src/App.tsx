import { useEffect, useRef } from "react";
import { BottomNav } from "./components/BottomNav";
import { useHashRoute } from "./hooks/useHashRoute";
import { cx } from "./lib/util";
import { SettingsProvider, useSettings } from "./state/settings";
import { ToastProvider, ToastViewport } from "./state/toast";
import { BookView } from "./views/BookView";
import { LessonView } from "./views/LessonView";
import { Library } from "./views/Library";
import { Progress } from "./views/Progress";
import { Settings } from "./views/Settings";
import { Welcome } from "./views/Welcome";

function AppFrame() {
  const { settings } = useSettings();
  const { route, navigate } = useHashRoute();
  const screenRef = useRef<HTMLDivElement | null>(null);

  const routeKey =
    route.name === "book" || route.name === "lesson"
      ? `${route.name}:${route.id}`
      : route.name;

  useEffect(() => {
    if (route.name === "lesson") return;
    screenRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [routeKey, route.name]);

  const onboarded = settings.onboarded;
  const immersive = onboarded && route.name === "lesson";
  const showNav =
    onboarded &&
    (route.name === "library" ||
      route.name === "progress" ||
      route.name === "settings");

  let view;
  if (!onboarded) {
    view = <Welcome onDone={() => navigate("/")} />;
  } else if (route.name === "book") {
    view = (
      <BookView key={route.id} id={route.id} navigate={navigate} />
    );
  } else if (route.name === "lesson") {
    view = (
      <LessonView
        key={route.id}
        id={route.id}
        reteach={route.reteach}
        navigate={navigate}
      />
    );
  } else if (route.name === "progress") {
    view = <Progress navigate={navigate} />;
  } else if (route.name === "settings") {
    view = <Settings navigate={navigate} />;
  } else {
    view = <Library navigate={navigate} />;
  }

  return (
    <div className="app-viewport">
      <div className="app-frame">
        <div
          ref={screenRef}
          className={cx(
            "app-screen",
            immersive && "is-immersive",
            showNav && "has-nav",
          )}
        >
          {view}
        </div>
        {showNav && <BottomNav route={route} navigate={navigate} />}
        <div id="app-portal" className="app-portal" />
        <ToastViewport />
      </div>
      <div className="app-context" aria-hidden="true">
        Cove · mobile preview
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <AppFrame />
      </ToastProvider>
    </SettingsProvider>
  );
}
