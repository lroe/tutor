import type { Concept, Lesson } from "./types";
import { isDue, isWeak } from "./review";

export interface LessonStats {
  total: number;
  covered: number;
  mastered: number;
  weak: number;
  due: number;
  percentCovered: number;
  percentMastered: number;
}

export interface ConceptRef {
  lesson: Lesson;
  concept: Concept;
  index: number;
}

export function lessonStats(lesson: Lesson, now = Date.now()): LessonStats {
  const total = lesson.plan.length;
  const covered = lesson.plan.filter((concept) => concept.covered).length;
  const mastered = lesson.plan.filter(
    (concept) => concept.covered && concept.mastery === "passed",
  ).length;
  const weak = lesson.plan.filter(isWeak).length;
  const due = lesson.plan.filter(
    (concept) => isDue(concept, now) && concept.mastery === "passed",
  ).length;
  return {
    total,
    covered,
    mastered,
    weak,
    due,
    percentCovered: total ? Math.round((covered / total) * 100) : 0,
    percentMastered: total ? Math.round((mastered / total) * 100) : 0,
  };
}

export function lessonForChapter(
  lessons: Lesson[],
  chapterId: string,
): Lesson | undefined {
  return lessons
    .filter((lesson) => lesson.chapterId === chapterId)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export interface BookSummary {
  startedChapters: number;
  total: number;
  covered: number;
  mastered: number;
  percentCovered: number;
  percentMastered: number;
}

export function bookSummary(_bookChapters: number, lessons: Lesson[]): BookSummary {
  const started = new Set(
    lessons
      .filter((lesson) => lesson.plan.some((concept) => concept.covered))
      .map((lesson) => lesson.chapterId),
  );
  let total = 0;
  let covered = 0;
  let mastered = 0;
  for (const lesson of lessons) {
    const stats = lessonStats(lesson);
    total += stats.total;
    covered += stats.covered;
    mastered += stats.mastered;
  }
  return {
    startedChapters: started.size,
    total,
    covered,
    mastered,
    percentCovered: total ? Math.round((covered / total) * 100) : 0,
    percentMastered: total ? Math.round((mastered / total) * 100) : 0,
  };
}

export function allConcepts(lessons: Lesson[]): ConceptRef[] {
  const refs: ConceptRef[] = [];
  for (const lesson of lessons) {
    lesson.plan.forEach((concept, index) => {
      refs.push({ lesson, concept, index });
    });
  }
  return refs;
}

export function dueConcepts(lessons: Lesson[], now = Date.now()): ConceptRef[] {
  return allConcepts(lessons)
    .filter(
      ({ concept }) =>
        concept.covered &&
        concept.mastery === "passed" &&
        isDue(concept, now),
    )
    .sort((a, b) => (a.concept.reviewAt ?? 0) - (b.concept.reviewAt ?? 0));
}

export function weakConcepts(lessons: Lesson[]): ConceptRef[] {
  return allConcepts(lessons).filter(({ concept }) => isWeak(concept));
}

export function upcomingCount(lessons: Lesson[], now = Date.now()): number {
  return allConcepts(lessons).filter(
    ({ concept }) =>
      concept.covered &&
      concept.mastery === "passed" &&
      concept.reviewAt !== undefined &&
      concept.reviewAt > now,
  ).length;
}

export interface WeekDay {
  key: string;
  label: string;
  count: number;
  today: boolean;
}

export function weekStrip(activity: Array<{ date: string; concepts: number }>): WeekDay[] {
  const counts = new Map(activity.map((entry) => [entry.date, entry.concepts]));
  const days: WeekDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
      2,
      "0",
    )}-${`${date.getDate()}`.padStart(2, "0")}`;
    days.push({
      key,
      label: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      count: counts.get(key) ?? 0,
      today: offset === 0,
    });
  }
  return days;
}
