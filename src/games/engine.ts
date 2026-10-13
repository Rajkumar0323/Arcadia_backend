/**
 * Game engine: content validation, public (answer-free) payloads and server-side grading.
 * Answers never leave the server before a submission, so scores can't be faked by reading the network tab
 * (Memory Match is the exception: the client must know pairs to play, so it is graded on efficiency).
 */
import { z } from "zod";
import type { GameType } from "@prisma/client";

// ---------- Content schemas (what admins author) ----------
const quizSchema = z.object({
  questions: z
    .array(
      z
        .object({
          prompt: z.string().trim().min(1),
          options: z.array(z.string().trim().min(1)).min(2).max(6),
          answer: z.number().int().min(0),
          explanation: z.string().trim().optional(),
        })
        .refine((q) => q.answer < q.options.length, {
          message: "Correct answer must point to an existing option",
          path: ["answer"],
        }),
    )
    .min(1)
    .max(50),
});

const trueFalseSchema = z.object({
  statements: z
    .array(z.object({ text: z.string().trim().min(1), answer: z.boolean(), explanation: z.string().trim().optional() }))
    .min(1)
    .max(50),
});

const memorySchema = z.object({
  pairs: z
    .array(z.object({ a: z.string().trim().min(1).max(60), b: z.string().trim().min(1).max(60) }))
    .min(2)
    .max(12),
});

const scrambleSchema = z.object({
  words: z
    .array(
      z.object({
        word: z
          .string()
          .trim()
          .min(2)
          .max(16)
          .regex(/^[A-Za-z0-9]+$/, "Use a single word (letters/numbers only)"),
        hint: z.string().trim().default(""),
      }),
    )
    .min(1)
    .max(30),
});

const sequenceSchema = z.object({
  rounds: z
    .array(z.object({ prompt: z.string().trim().min(1), items: z.array(z.string().trim().min(1)).min(2).max(8) }))
    .min(1)
    .max(20),
});

const fillSchema = z.object({
  sentences: z
    .array(
      z.object({
        text: z
          .string()
          .trim()
          .min(1)
          .refine((t) => /_{3,}/.test(t), "Sentence must contain a blank written as ___"),
        answers: z.array(z.string().trim().min(1)).min(1),
        hint: z.string().trim().optional(),
      }),
    )
    .min(1)
    .max(30),
});

export const contentSchemas = {
  QUIZ: quizSchema,
  TRUE_FALSE: trueFalseSchema,
  MEMORY_MATCH: memorySchema,
  WORD_SCRAMBLE: scrambleSchema,
  SEQUENCE: sequenceSchema,
  FILL_BLANK: fillSchema,
} satisfies Record<GameType, z.ZodTypeAny>;

type Contents = { [K in GameType]: z.infer<(typeof contentSchemas)[K]> };

export function validateContent(type: GameType, content: unknown): unknown {
  return (contentSchemas[type] as z.ZodTypeAny).parse(content);
}

// ---------- Helpers ----------
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleNotIdentity<T extends { id: number }>(arr: T[]): T[] {
  let out = shuffle(arr);
  for (let i = 0; i < 10 && arr.length > 1 && out.every((x, idx) => x.id === idx); i++) out = shuffle(arr);
  return out;
}

function scramble(word: string) {
  const letters = word.toUpperCase().split("");
  let s = shuffle(letters).join("");
  for (let i = 0; i < 10 && s === word.toUpperCase() && new Set(letters).size > 1; i++) s = shuffle(letters).join("");
  return s;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// ---------- Public payload (sent to players) ----------
export function publicPayload(type: GameType, raw: unknown) {
  switch (type) {
    case "QUIZ": {
      const c = raw as Contents["QUIZ"];
      return { questions: c.questions.map((q) => ({ prompt: q.prompt, options: q.options })) };
    }
    case "TRUE_FALSE": {
      const c = raw as Contents["TRUE_FALSE"];
      return { statements: c.statements.map((s) => ({ text: s.text })) };
    }
    case "MEMORY_MATCH": {
      const c = raw as Contents["MEMORY_MATCH"];
      const cards = c.pairs.flatMap((p, i) => [
        { pairId: i, text: p.a },
        { pairId: i, text: p.b },
      ]);
      return { pairCount: c.pairs.length, cards: shuffle(cards).map((card, id) => ({ id, ...card })) };
    }
    case "WORD_SCRAMBLE": {
      const c = raw as Contents["WORD_SCRAMBLE"];
      return {
        words: c.words.map((w) => ({ scrambled: scramble(w.word), length: w.word.length, hint: w.hint })),
      };
    }
    case "SEQUENCE": {
      const c = raw as Contents["SEQUENCE"];
      return {
        rounds: c.rounds.map((r) => ({
          prompt: r.prompt,
          items: shuffleNotIdentity(r.items.map((text, id) => ({ id, text }))),
        })),
      };
    }
    case "FILL_BLANK": {
      const c = raw as Contents["FILL_BLANK"];
      return { sentences: c.sentences.map((s) => ({ text: s.text, hint: s.hint ?? null })) };
    }
  }
}

// ---------- Grading ----------
export interface ReviewItem {
  label: string;
  given: string | null;
  answer: string;
  correct: boolean;
  explanation?: string;
}
export interface GradeResult {
  score: number;
  maxScore: number;
  review: ReviewItem[];
}

export function grade(type: GameType, raw: unknown, answers: unknown): GradeResult {
  switch (type) {
    case "QUIZ": {
      const c = raw as Contents["QUIZ"];
      const a = z.array(z.number().int().nullable()).max(c.questions.length).parse(answers ?? []);
      const review = c.questions.map((q, i) => {
        const given = a[i] ?? null;
        return {
          label: q.prompt,
          given: given === null ? null : (q.options[given] ?? null),
          answer: q.options[q.answer],
          correct: given === q.answer,
          explanation: q.explanation,
        };
      });
      return { score: review.filter((r) => r.correct).length, maxScore: c.questions.length, review };
    }
    case "TRUE_FALSE": {
      const c = raw as Contents["TRUE_FALSE"];
      const a = z.array(z.boolean().nullable()).max(c.statements.length).parse(answers ?? []);
      const label = (b: boolean) => (b ? "True" : "False");
      const review = c.statements.map((s, i) => {
        const given = a[i] ?? null;
        return {
          label: s.text,
          given: given === null ? null : label(given),
          answer: label(s.answer),
          correct: given === s.answer,
          explanation: s.explanation,
        };
      });
      return { score: review.filter((r) => r.correct).length, maxScore: c.statements.length, review };
    }
    case "MEMORY_MATCH": {
      const c = raw as Contents["MEMORY_MATCH"];
      const n = c.pairs.length;
      const a = z
        .object({ moves: z.number().int().min(0).max(10000), matched: z.number().int().min(0) })
        .parse(answers ?? { moves: 0, matched: 0 });
      const matched = Math.min(a.matched, n);
      const efficiency = Math.min(1, (n * 1.5) / Math.max(a.moves, n));
      const score = Math.round(matched * efficiency * 100) / 100;
      return {
        score,
        maxScore: n,
        review: [
          {
            label: "Pairs matched",
            given: `${matched}/${n} in ${a.moves} moves`,
            answer: `${n} pairs in ≤ ${Math.ceil(n * 1.5)} moves for full marks`,
            correct: matched === n,
          },
          ...c.pairs.map((p) => ({ label: p.a, given: null, answer: p.b, correct: matched === n })),
        ],
      };
    }
    case "WORD_SCRAMBLE": {
      const c = raw as Contents["WORD_SCRAMBLE"];
      const a = z.array(z.string().max(40).nullable()).max(c.words.length).parse(answers ?? []);
      const review = c.words.map((w, i) => {
        const given = a[i] ?? null;
        return {
          label: w.hint || `Word ${i + 1}`,
          given: given ? given.toUpperCase() : null,
          answer: w.word.toUpperCase(),
          correct: norm(given).replace(/\s/g, "") === norm(w.word),
        };
      });
      return { score: review.filter((r) => r.correct).length, maxScore: c.words.length, review };
    }
    case "SEQUENCE": {
      const c = raw as Contents["SEQUENCE"];
      const a = z.array(z.array(z.number().int()).max(8)).max(c.rounds.length).parse(answers ?? []);
      let score = 0;
      let maxScore = 0;
      const review = c.rounds.map((r, ri) => {
        const order = a[ri] ?? [];
        const correctPositions = r.items.filter((_, i) => order[i] === i).length;
        score += correctPositions;
        maxScore += r.items.length;
        return {
          label: r.prompt,
          given: order.length ? order.map((id) => r.items[id] ?? "?").join(" → ") : null,
          answer: r.items.join(" → "),
          correct: correctPositions === r.items.length,
        };
      });
      return { score, maxScore, review };
    }
    case "FILL_BLANK": {
      const c = raw as Contents["FILL_BLANK"];
      const a = z.array(z.string().max(200).nullable()).max(c.sentences.length).parse(answers ?? []);
      const review = c.sentences.map((s, i) => {
        const given = a[i] ?? null;
        return {
          label: s.text,
          given: given?.trim() || null,
          answer: s.answers[0],
          correct: s.answers.some((ans) => norm(ans) === norm(given)),
        };
      });
      return { score: review.filter((r) => r.correct).length, maxScore: c.sentences.length, review };
    }
  }
}
