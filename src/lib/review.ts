import type { Concept, ConceptKind, Mastery } from "./types";

export const DAY = 24 * 60 * 60 * 1000;

const INTERVALS: Record<ConceptKind, number[]> = {
  recall: [1, 3, 7, 16, 35, 75],
  concept: [3, 7, 16, 35, 75],
  apply: [3, 7, 21, 45, 90],
};

export function scheduleReview(
  kind: ConceptKind,
  mastery: Mastery,
  reviewCount = 0,
  now = Date.now(),
): number {
  if (mastery !== "passed") return now + DAY;
  const list = INTERVALS[kind] ?? INTERVALS.concept;
  const days = list[Math.min(reviewCount, list.length - 1)];
  return now + days * DAY;
}

export function isDue(concept: Concept, now = Date.now()): boolean {
  return Boolean(
    concept.covered &&
      concept.reviewAt !== undefined &&
      concept.reviewAt <= now,
  );
}

export function isWeak(concept: Concept): boolean {
  return Boolean(concept.covered && concept.mastery !== "passed");
}

export function dueLabel(reviewAt: number | undefined, now = Date.now()): string {
  if (!reviewAt) return "Not scheduled";
  const diff = reviewAt - now;
  if (diff <= 0) return "Due now";
  const days = Math.ceil(diff / DAY);
  if (days <= 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  const weeks = Math.round(days / 7);
  return weeks <= 1 ? "In a week" : `In ${weeks} weeks`;
}

export function kindLabel(kind: ConceptKind): string {
  if (kind === "recall") return "Recall";
  if (kind === "apply") return "Apply";
  return "Concept";
}

export function checkPromptFor(kind: ConceptKind): string {
  if (kind === "recall") return "Quick recall";
  if (kind === "apply") return "Try it";
  return "Teach it back";
}
