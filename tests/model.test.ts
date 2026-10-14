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

describe("shared parsers", () => {
  it("reads pasted class lists", async () => {
    const { parseStudentLines } = await import("@/convex/model");
    expect(parseStudentLines("Nguyễn Văn Bình, 8A2\n\nLê Hoàng Nam\nTrần Mai\t9A1\t0912344821", "7B")).toEqual([
      { name: "Nguyễn Văn Bình", className: "8A2", phone: "" },
      { name: "Lê Hoàng Nam", className: "7B", phone: "" },
      { name: "Trần Mai", className: "9A1", phone: "0912344821" },
    ]);
  });

  it("splits a listening script into speakers", async () => {
    const { parseDialogue } = await import("@/convex/model");
    expect(parseDialogue("Receptionist: Good morning.\nThe phone rings.\nCaller: Hi, it's Daniel.")).toEqual([
      { speaker: "Receptionist", text: "Good morning." },
      { speaker: null, text: "The phone rings." },
      { speaker: "Caller", text: "Hi, it's Daniel." },
    ]);
  });
});

describe("writing & class lists", () => {
  it("counts words and skips essays when auto-grading", async () => {
    const { wordCount, grade } = await import("@/convex/model");
    expect(wordCount("  The chart shows — a clear rise.\n\nIn 2010, 45% ")).toBe(9);
    const sections = [{ title: "W", questions: [{ type: "mcq" as const, q: "x", options: ["a", "b"], answer: 1 }, { type: "essay" as const, q: "Write", minWords: 150 }] }];
    expect(grade(sections, { "0-0": 1, "0-1": "some text" })).toEqual({ correct: 1, total: 1, wrong: 0, unanswered: 0 });
  });

  it("rounds IELTS writing criteria like the official scale", async () => {
    const { writingBand } = await import("@/convex/model");
    expect(writingBand([6, 6, 6, 7])).toBe(6.5); // 6.25 → 6.5
    expect(writingBand([6, 7, 7, 7])).toBe(7); // 6.75 → 7
    expect(writingBand([6, 6, 6, 6.5])).toBe(6); // 6.125 → 6
    expect(writingBand([6, 6])).toBeNull();
  });

  it("builds phone-based codes", async () => {
    const { phoneCode } = await import("@/convex/model");
    expect(phoneCode("Trần Bảo An", "0912 344 821")).toBe("baoan4821");
    expect(phoneCode("Đặng Thị Ngọc Ánh", "+84 98-765-4321")).toBe("ngocanh4321");
    expect(phoneCode("Minh", "12")).toBeNull();
  });

  it("finds name, class and phone columns in an Excel sheet", async () => {
    const { tableToClassList } = await import("@/lib/excel");
    const table = [
      ["DANH SÁCH LỚP 9/14", null, null, null],
      ["STT", "Họ và tên học sinh", "Tên lớp", "Số điện thoại phụ huynh"],
      [1, "Nguyễn Văn Bình", "9/14", "0912344821"],
      [2, "Trần Thị Mai", "", 987654321],
      [null, null, null, null],
      ["Tổng", "2 học sinh", null, null],
    ];
    const list = tableToClassList(table, "Sheet1");
    expect(list.columns).toEqual({ name: "Họ và tên học sinh", className: "Tên lớp", phone: "Số điện thoại phụ huynh", code: null });
    expect(list.rows).toEqual([
      { name: "Nguyễn Văn Bình", className: "9/14", phone: "0912344821", code: "" },
      { name: "Trần Thị Mai", className: "", phone: "987654321", code: "" },
    ]);
  });

  it("joins split Họ / Tên columns", async () => {
    const { tableToClassList } = await import("@/lib/excel");
    const list = tableToClassList([["Họ và tên đệm", "Tên", "Lớp"], ["Lê Hoàng", "Nam", "8A2"]]);
    expect(list.rows).toEqual([{ name: "Lê Hoàng Nam", className: "8A2", phone: "", code: "" }]);
  });

  it("keeps an existing code column and spots phone numbers under any header", async () => {
    const { tableToClassList } = await import("@/lib/excel");
    const list = tableToClassList([
      ["Mã học sinh", "Họ và tên học sinh", "Tên lớp", "Liên hệ PH"],
      ["baoan4821", "Trần Bảo An", "Anh 10", "0912 344 821"],
      ["mai0000", "Trần Thị Mai", "Anh 10", ""],
    ]);
    expect(list.columns).toEqual({ name: "Họ và tên học sinh", className: "Tên lớp", phone: "Liên hệ PH", code: "Mã học sinh" });
    expect(list.rows[1]).toEqual({ name: "Trần Thị Mai", className: "Anh 10", phone: "", code: "mai0000" });
    const guessed = tableToClassList([
      ["Họ và tên", "Lớp", "Ghi chú"],
      ["A B", "9", "0912344821"],
      ["C D", "9", "0987654321"],
    ]);
    expect(guessed.columns.phone).toBe("Ghi chú");
  });

  it("reads the teacher's class list format (title rows, “4 số cuối SĐT PH”)", async () => {
    const { tableToClassList } = await import("@/lib/excel");
    const { phoneCode } = await import("@/convex/model");
    const list = tableToClassList([
      ["DANH SÁCH MÃ CÁ NHÂN — ANH 10 & IELTS", null, null, null, null],
      ["Lớp Thứ 2/4 | 28 học sinh", null, null, null, null],
      [null, null, null, null, null],
      ["STT", "Tên lớp", "Họ và tên học sinh", "4 số cuối SĐT PH", "Trạng thái mã cá nhân"],
      [1, "Anh 10 & IELTS — Thứ 2/4", "Ngô Thử Minh", "4821", null],
      [12, "Anh 10 & IELTS — Thứ 2/4", "Lê Thử Khang", 48, null],
    ]);
    expect(list.columns.phone).toBe("4 số cuối SĐT PH");
    expect(list.rows.map((r) => phoneCode(r.name, r.phone))).toEqual(["thuminh4821", "thukhang0048"]);
  });

  it("makes last-two-words codes whether or not there is a phone", async () => {
    const { lastTwoWords, phoneCode } = await import("@/convex/model");
    expect(lastTwoWords("Trần Bảo An")).toBe("baoan");
    expect(lastTwoWords("Minh")).toBe("minh");
    expect(phoneCode("Trần Bảo An", "")).toBeNull(); // the server then adds 4 random digits
  });

  it("locks a quiz once the best non-reopened score reaches the threshold", async () => {
    const { isMastered } = await import("@/convex/lib");
    const a = (correct: number, total: number, reopened = false) => ({ correct, total, reopened }) as never;
    expect(isMastered([a(7, 10), a(8, 10)], 80)).toBe(true);
    expect(isMastered([a(7, 10)], 80)).toBe(false);
    expect(isMastered([a(9, 10, true)], 80)).toBe(false);
    expect(isMastered([a(10, 10)], 0)).toBe(false);
    expect(isMastered([a(0, 0)], 80)).toBe(false);
  });
});

describe("statistics", () => {
  it("combines Writing tasks the IELTS way (Task 2 counts double)", async () => {
    const { writingTestBand, roundBand } = await import("@/convex/model");
    expect(writingTestBand([6, 7])).toBe(6.5); // 6.67 → 6.5
    expect(writingTestBand([6, 8])).toBe(7.5); // 7.33 → 7.5
    expect(writingTestBand([7, 6])).toBe(6.5); // 6.33 → 6.5
    expect(writingTestBand([6.5])).toBe(6.5);
    expect(writingTestBand([6, undefined])).toBeNull(); // Task 2 not marked yet
    expect(roundBand(6.2)).toBe(6);
  });

  it("ranks with ties sharing a place", async () => {
    const { rankBy, maskedName } = await import("@/convex/model");
    const r = rankBy([{ n: "a", v: 7 }, { n: "b", v: 8.5 }, { n: "c", v: 7 }, { n: "d", v: 6 }], (x) => x.v);
    expect(r.map((x) => `${x.rank}${x.item.n}`)).toEqual(["1b", "2a", "2c", "4d"]);
    expect(maskedName("thanhtoan0789")).toBe("Xxxxx0789");
  });

  it("computes completion per folder from submitted quizzes", async () => {
    const { progressOf } = await import("@/convex/stats");
    const student = { folders: ["gs10"] } as never;
    const folders = [{ slug: "gs10", name: "Global Success 10" }, { slug: "gs11", name: "Global Success 11" }] as never;
    const q = (id: string, folder: string, published = true) => ({ _id: id, slug: id, title: id, folder, published, order: 0 });
    const quizzes = [...Array.from({ length: 10 }, (_, i) => q(`a${i}`, "gs10")), q("draft", "gs10", false), q("other", "gs11")] as never;
    const p = progressOf(student, folders, quizzes, new Set(["a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7"]) as never);
    expect([p.done, p.total, p.rate, p.pending.length]).toEqual([8, 10, 80, 2]);
    expect(p.byFolder).toEqual([{ id: "gs10", name: "Global Success 10", total: 10, done: 8, rate: 80 }]);
  });
});
