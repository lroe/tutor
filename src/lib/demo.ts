import type { ConceptKind, Evaluation, PlanItem } from "./types";

const DEMO_TITLES: Array<{
  title: string;
  goal: string;
  terms: string[];
  kind: ConceptKind;
}> = [
  {
    title: "Find the spine of the chapter",
    goal: "See the one big idea the rest of the chapter hangs from.",
    terms: ["framing", "structure"],
    kind: "concept",
  },
  {
    title: "Learn the working vocabulary",
    goal: "Own the few terms that make the rest of the pages readable.",
    terms: ["terminology", "definition"],
    kind: "recall",
  },
  {
    title: "See how the parts connect",
    goal: "Follow cause and effect instead of memorising a list.",
    terms: ["mechanism", "relationship"],
    kind: "concept",
  },
  {
    title: "Notice the numbers that matter",
    goal: "Anchor the chapter's numbers to something meaningful.",
    terms: ["proportion", "measurement"],
    kind: "recall",
  },
  {
    title: "Bring it to a patient",
    goal: "Turn the idea into something you could recognise clinically.",
    terms: ["clinical", "example"],
    kind: "apply",
  },
  {
    title: "Separate the look-alikes",
    goal: "Tell the two easily confused ideas apart for good.",
    terms: ["contrast", "distinction"],
    kind: "concept",
  },
];

function splitPages(
  startPage: number,
  endPage: number,
  count: number,
): number[][] {
  const span = Math.max(1, endPage - startPage + 1);
  return DEMO_TITLES.slice(0, count).map((_, index) => {
    const page = Math.min(
      endPage,
      startPage + Math.floor((index * span) / count),
    );
    return [page];
  });
}

export function demoPlan(
  startPage: number,
  endPage: number,
  count = 6,
): PlanItem[] {
  const ranges = splitPages(startPage, endPage, count);
  return DEMO_TITLES.slice(0, count).map((entry, index) => {
    const [page] = ranges[index];
    return {
      title: entry.title,
      goal: entry.goal,
      kind: entry.kind,
      pages: [page],
      keyTerms: entry.terms,
    };
  });
}

const TEACHING = [
  `Let's start with the frame, not the facts.

A dense chapter usually has one spine — a single relationship that the other sections keep returning to. Before you memorise anything, read the headings and the first sentence of each section, then ask yourself: *what is this chapter actually trying to explain?* When you can say that in one sentence, the details have somewhere to sit.

For the next few minutes, hold that question loosely. We'll build the details on top of it, one at a time.

---CHECK---
Without looking back, how would you describe the main job of this chapter in one sentence?`,

  `Now the vocabulary.

Textbook authors are usually kind about this: three or four terms do most of the work. The trick is not to memorise every bold word, but to notice which words the chapter *needs* in order to make its argument. Those are the ones worth defining in your own language.

A useful test: can you use the term in a sentence about a real situation, without quoting the book? If yes, it's yours. If not, it's still just a label.

---CHECK---
Pick one term from this chapter and define it as if you were explaining it to a classmate who missed the lecture.`,

  `Here's where it becomes a story.

Most chapters are not lists. They're chains: this structure makes that movement possible, that movement produces this result, this result is why the next section matters. When you read, look for the word "because" — or the sentence that quietly means it. That's the hinge.

If you can draw the chain as three boxes with arrows, you understand more than someone who highlighted the whole page.

---CHECK---
What is one cause-and-effect link in this chapter that you could draw as an arrow?`,

  `Numbers deserve a home.

A number on its own is forgettable. A number attached to a comparison is not. Ask: compared with what? Per what? At what age, at what stage, in which tooth? The chapter usually gives you the reference point nearby, sometimes in a table you skimmed.

Don't collect numbers. Collect the few that change a decision.

---CHECK---
Which number in this chapter would actually change what you notice in a patient, and why?`,

  `Time to make it clinical.

The clinical example is not decoration. It's a test of whether the idea survived the trip out of the textbook. Take the concept we just covered and walk it through a simple scene: what would you see, what would you ask, what would you expect? You don't need a diagnosis — just a concrete picture.

If the picture is fuzzy, that's useful information. It tells us exactly which part to revisit.

---CHECK---
Describe a small clinical scene where this idea would show up. What would you notice first?`,

  `One last contrast.

The ideas that slip away are usually the ones that resemble another idea. So put them side by side. What's the same? What's the one difference that matters? A good contrast is short enough to remember under pressure.

This is also a good moment to look back at the chapter's summary or tables. If they use a distinction you haven't made yet, that's your next question.

---CHECK---
Which two ideas in this chapter are easiest to mix up, and what is the one difference you'd hold onto?`,
];

export function demoTeach(index: number): string {
  return TEACHING[index % TEACHING.length];
}

export function demoChat(question: string, conceptTitle: string): string {
  const lower = question.toLowerCase();
  if (/again|don'?t (get|understand)|confus/.test(lower)) {
    return `Let me come at it from a different angle.

Think of **${conceptTitle.toLowerCase()}** as a filter rather than a fact to memorise. First ask what problem it solves, then ask what changes when it goes wrong. In the real lesson I'd point you to the exact paragraph and the page's own example; in this preview, try that two-question version and see if the idea gets less slippery.

What part still feels unclear?`;
  }
  if (/example|clinical|patient/.test(lower)) {
    return `A good example should make the idea visible, not just decorate it.

For **${conceptTitle.toLowerCase()}**, build the smallest possible scene: one structure, one consequence, one thing you would notice. Say it out loud in two sentences. If you can do that without the book open, the idea has started to become yours. If not, tell me which step breaks and we'll rebuild it.`;
  }
  if (/exam|test|revise|memoris|memoriz/.test(lower)) {
    return `For revision, don't re-read the same page. Close the book and try to rebuild the idea from three prompts: what it is, why it matters, and what it looks like when it goes wrong.

That's harder than highlighting, and it's exactly why it works. Which of those three feels weakest right now?`;
  }
  return `Good question.

In the full lesson, I'd answer it against the chapter and cite the page. The short version for now: hold **${conceptTitle.toLowerCase()}** next to the idea before it — ask what it changes, and what would be different if it weren't there. That usually turns a definition into something you can actually use.

Want me to take the idea apart again, or keep moving?`;
}

export function demoEvaluate(
  answer: string,
  conceptTitle: string,
  kind: ConceptKind = "concept",
): Evaluation {
  const clean = answer.trim();
  const isQuestion =
    /\?$/.test(clean) &&
    /^(what|why|how|can|does|do|is|are|should|could|would|where|when|which)\b/i.test(
      clean,
    );
  if (isQuestion) {
    return {
      verdict: "question",
      mastered: false,
      reply: demoChat(clean, conceptTitle),
    };
  }
  if (clean.length < 18) {
    return {
      verdict: "partial",
      mastered: false,
      reply: `There's a start there, but it's still thin. Try adding the *why*: what does **${conceptTitle.toLowerCase()}** change, and what would go wrong without it? Two sentences is plenty.`,
      followUp: `Try once more, but make it concrete: what is one thing that would look different without ${conceptTitle.toLowerCase()}?`,
    };
  }
  if (clean.length > 55) {
    return {
      verdict: "correct",
      mastered: true,
      reply: `Yes — that's the shape of it.

You didn't just repeat a definition; you explained what it does. In the real lesson I'd ground that against the page and add one precise clinical detail. For now, keep that explanation — it's a good one to test yourself with tomorrow.`,
    };
  }
  return {
    verdict: "partial",
    mastered: false,
    reply: `You're circling the right idea.

A strong answer would name the thing, say what it does, and give one consequence. You've got the first part. Add the other two and it will hold together.`,
    followUp:
      kind === "recall"
        ? `Give me the specific term or fact you're reaching for — just the name, no explanation yet.`
        : `Now add the consequence: if ${conceptTitle.toLowerCase()} were missing or different, what would you expect to see?`,
  };
}
