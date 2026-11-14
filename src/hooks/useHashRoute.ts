import { useCallback, useEffect, useState } from "react";

export type Route =
  | { name: "library" }
  | { name: "book"; id: string }
  | { name: "lesson"; id: string; reteach?: number }
  | { name: "progress" }
  | { name: "settings" };

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "");
  const [path, queryString] = clean.split("?");
  const segments = path.split("/").filter(Boolean);
  const query = new URLSearchParams(queryString ?? "");
  const first = segments[0];

  if (first === "book" && segments[1]) {
    return { name: "book", id: decodeURIComponent(segments[1]) };
  }
  if (first === "lesson" && segments[1]) {
    const reteachRaw = query.get("reteach");
    const reteach =
      reteachRaw !== null && Number.isFinite(Number(reteachRaw))
        ? Math.max(0, Math.floor(Number(reteachRaw)))
        : undefined;
    return { name: "lesson", id: decodeURIComponent(segments[1]), reteach };
  }
  if (first === "progress") return { name: "progress" };
  if (first === "settings") return { name: "settings" };
  return { name: "library" };
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

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
