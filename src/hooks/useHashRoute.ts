import { useCallback, useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "lesson"; id: string };

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "");
  const [path] = clean.split("?");
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "lesson" && segments[1]) {
    return { name: "lesson", id: decodeURIComponent(segments[1]) };
  }
  return { name: "home" };
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.hash),
  );

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((path: string) => {
    const target = path.startsWith("/") ? path : `/${path}`;
    if (window.location.hash === `#${target}`) return;
    window.location.hash = target;
  }, []);

  return { route, navigate };
}
