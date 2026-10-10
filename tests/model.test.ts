import { describe, expect, it } from "vitest";
import { bandFor, grade, normAnswer, normCode, slugify, validateSections, type Section } from "@/convex/model";
import { seedData } from "@/convex/seedData";
import { parseLoose } from "@/lib/loose-json";

const sections: Section[] = [
  {
    title: "A",
    questions: [
      { type: "mcq", q: "I don't mind ___", options: ["help", "to help", "helping"], answer: 2 },
      { type: "fill", q: "Target band: ___", answer: ["6.5", "six point five"] },
      { type: "fill", q: "Unanswered ___", answer: ["x"] },
    ],
  },
];

describe("grading", () => {
  it("counts correct, wrong and unanswered", () => {
    expect(grade(sections, { "0-0": 2, "0-1": " Six  Point Five. " })).toEqual({ correct: 2, total: 3, wrong: 0, unanswered: 1 });
    expect(grade(sections, { "0-0": 1, "0-1": "7" })).toEqual({ correct: 0, total: 3, wrong: 2, unanswered: 1 });
  });

  it("normalises answers and codes like the original site", () => {
    expect(normAnswer("“Was built.”")).toBe("was built");
    expect(normAnswer("I’m")).toBe("i'm");
    expect(normCode(" DEMO 2026 ")).toBe("demo2026");
    expect(slugify("Đề luyện thi vào 10 · Đề 01")).toBe("de-luyen-thi-vao-10-de-01");
  });

  it("converts to an approximate IELTS band", () => {
    expect(bandFor("listening", 7, 7)).toBe(9);
    expect(bandFor("reading", 4, 7)).toBe(6); // 4/7 → 23/40
    expect(bandFor(undefined, 4, 7)).toBeNull();
  });

  it("flags broken quiz definitions", () => {
    expect(validateSections(sections)).toEqual([]);
    expect(validateSections([{ title: "x", questions: [{ type: "mcq", q: "", options: ["a"], answer: 3 }] }])).toHaveLength(3);
  });

  it("ships valid starter quizzes", () => {
    for (const q of seedData.quizzes) expect(validateSections(q.sections as Section[]), q.slug).toEqual([]);
  });
});

describe("parseLoose", () => {
  it("reads data.js style object literals without evaluating them", () => {
    const src = `{
      id: "gs8-x", // comment
      title: 'It\\'s "fine"',
      sections: [{ title: "P", questions: [
        { type: "mcq", q: "Speaker A: hi, b: c", options: ["a", "b",], answer: 0 },
      ] }],
    },`;
    expect(parseLoose(src)).toEqual({
      id: "gs8-x",
      title: `It's "fine"`,
      sections: [{ title: "P", questions: [{ type: "mcq", q: "Speaker A: hi, b: c", options: ["a", "b"], answer: 0 }] }],
    });
  });

  it("keeps URLs inside strings intact", () => {
    expect(parseLoose(`{ url: "https://example.com/a" }`)).toEqual({ url: "https://example.com/a" });
  });
});
