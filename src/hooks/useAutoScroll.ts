import { useCallback, useEffect, useRef } from "react";

export function useAutoScroll<T extends HTMLElement>(trigger: unknown) {
  const containerRef = useRef<T | null>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const scrollIfSticking = () => {
      if (stickRef.current) element.scrollTop = element.scrollHeight;
    };
    const observer = new ResizeObserver(scrollIfSticking);
    observer.observe(element);
    const child = element.firstElementChild;
    if (child) observer.observe(child);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !stickRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [trigger]);

  const onScroll = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    stickRef.current = distance < 160;
  }, []);

  const jumpToEnd = useCallback(() => {
    stickRef.current = true;
    const element = containerRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, []);

  return { containerRef, onScroll, jumpToEnd };
}
