"use server";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSession,
  destroySession,
  requireActor,
  requireSessionHash,
} from "@/lib/auth";
import { api, convex } from "@/lib/convex";
import { dueAtMs, idSchema } from "@/lib/ids";
import { requireMenuAccess } from "@/lib/permissions";
import {
  isReusableTempPassword,
  MIN_NEW_PASSWORD,
  passwordMeetsPolicy,
} from "@/lib/password";
import type { Id } from "@/convex/_generated/dataModel";

const digest = (value: string) =>
  createHash("sha256").update(value.toLowerCase()).digest("hex");

export async function login(formData: FormData) {
  const parsed = z
    .object({ email: z.string().email(), password: z.string().min(8) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dang-nhap?error=invalid");
  const forwarded =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const emailHash = digest(parsed.data.email);
  const ipHash = digest(forwarded);
  const recent = await convex().query(api.auth.recentLoginFailures, {
    emailHash,
    ipHash,
  });
  if (recent >= 8) redirect("/dang-nhap?error=locked");
  const user = await convex().query(api.auth.userByEmail, {
    email: parsed.data.email,
  });
  const valid = Boolean(
    user && (await bcrypt.compare(parsed.data.password, user.passwordHash)),
  );
  await convex().mutation(api.auth.recordLoginAttempt, {
    emailHash,
    ipHash,
    succeeded: valid,
  });
  if (!user || !valid) redirect("/dang-nhap?error=invalid");
  await createSession(user.id);
  if (user.mustChangePassword) redirect("/tai-khoan");
  if (user.role !== "USER") redirect("/cms");
  const landing = await convex().query(api.auth.landingMenu, { userId: user.id });
  redirect(landing?.startsWith("cms.") ? "/cms" : "/hoc-tap");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function submitInquiry(formData: FormData) {
  const data = z
    .object({
      fullName: z.string().min(2).max(100),
      phone: z.string().min(8).max(20),
      email: z.string().email().optional().or(z.literal("")),
      programId: z.string().optional().or(z.literal("")),
      currentLevel: z.string().min(1).max(80),
      note: z.string().max(1000).optional(),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.submitInquiry, {
    fullName: data.fullName,
    phone: data.phone,
    email: data.email || undefined,
    programId: data.programId
      ? (data.programId as Id<"programs">)
      : undefined,
    currentLevel: data.currentLevel,
    note: data.note || undefined,
  });
  redirect("/dang-ky-tu-van?success=1");
}

export async function createClass(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({
      name: z.string().min(2),
      code: z.string().min(2).max(30),
      gradeMin: z.coerce.number().int().min(6).max(12),
      gradeMax: z.coerce.number().int().min(6).max(12),
      level: z.string().min(1),
      modality: z.enum(["Trực tiếp", "Online"]),
      location: z.string().max(200).optional(),
      startsOn: z.string(),
      programId: idSchema,
      status: z.enum(["RECRUITING", "UPCOMING", "FULL", "CLOSED"]),
      capacity: z.union([z.coerce.number().int().positive(), z.literal("")]),
      sessions: z.string().min(5),
    })
    .parse(Object.fromEntries(formData));
  if (data.gradeMin > data.gradeMax)
    throw new Error("Khối bắt đầu phải nhỏ hơn hoặc bằng khối kết thúc");
  const sessions = data.sessions.split(";").map((raw) => {
    const [weekday, start, end] = raw.split(",").map((v) => v.trim());
    const d = Number(weekday);
    if (
      !Number.isInteger(d) ||
      d < 0 ||
      d > 6 ||
      !/^\d{2}:\d{2}$/.test(start) ||
      !/^\d{2}:\d{2}$/.test(end) ||
      start >= end
    )
      throw new Error("Lịch học không hợp lệ");
    return { weekday: d, start, end };
  });
  await convex().mutation(api.mutations.createClass, {
    tokenHash,
    name: data.name,
    code: data.code,
    gradeMin: data.gradeMin,
    gradeMax: data.gradeMax,
    level: data.level,
    modality: data.modality,
    location: data.location || undefined,
    startsOn: data.startsOn,
    programId: data.programId as Id<"programs">,
    status: data.status,
    capacity: data.capacity === "" ? undefined : data.capacity,
    sessions,
  });
  revalidatePath("/cms");
  revalidatePath("/thoi-khoa-bieu");
}

export async function updateSiteSettings(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({
      brandName: z.string().min(2).max(100),
      tagline: z.string().min(5).max(220),
      teacherName: z.string().min(2).max(100),
      teacherTitle: z.string().min(3).max(220),
      teacherOrganization: z.string().min(3).max(220),
      teacherShortBio: z.string().min(20).max(800),
      teacherLongBio: z.string().min(50).max(5000),
      contactEmail: z.string().email().optional().or(z.literal("")),
      contactPhone: z.string().max(30).optional(),
      seoTitle: z.string().min(10).max(160),
      seoDescription: z.string().min(20).max(300),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.updateSiteSettings, {
    tokenHash,
    brandName: data.brandName,
    tagline: data.tagline,
    teacherName: data.teacherName,
    teacherTitle: data.teacherTitle,
    teacherOrganization: data.teacherOrganization,
    teacherShortBio: data.teacherShortBio,
    teacherLongBio: data.teacherLongBio,
    contactEmail: data.contactEmail || undefined,
    contactPhone: data.contactPhone || undefined,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
  });
  revalidatePath("/", "layout");
  revalidatePath("/cms/thuong-hieu");
}

export async function addScheduleException(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({
      classId: idSchema,
      date: z.string(),
      type: z.enum(["CANCELLED", "MAKEUP", "TIME_CHANGE", "LOCATION_CHANGE"]),
      start: z.string().optional(),
      end: z.string().optional(),
      location: z.string().max(200).optional(),
      note: z.string().max(500).optional(),
    })
    .parse(Object.fromEntries(formData));
  if (data.start && data.end && data.start >= data.end)
    throw new Error("Giờ bắt đầu phải trước giờ kết thúc");
  await convex().mutation(api.mutations.addScheduleException, {
    tokenHash,
    classId: data.classId as Id<"classes">,
    date: data.date,
    type: data.type,
    start: data.start || undefined,
    end: data.end || undefined,
    location: data.location || undefined,
    note: data.note || undefined,
  });
  revalidatePath(`/cms/lop-hoc/${data.classId}`);
}

export async function createAssignment(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({
      classId: idSchema,
      title: z.string().min(3).max(160),
      instructions: z.string().min(3).max(1000),
      mode: z.enum(["PRACTICE", "EXAM"]).default("PRACTICE"),
      prompt: z.string().min(3).max(500),
      optionA: z.string().min(1),
      optionB: z.string().min(1),
      correct: z.enum(["A", "B"]),
      explanation: z.string().max(2000).optional(),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.createAssignment, {
    tokenHash,
    classId: data.classId as Id<"classes">,
    title: data.title,
    instructions: data.instructions,
    mode: data.mode,
    prompt: data.prompt,
    optionA: data.optionA,
    optionB: data.optionB,
    correct: data.correct === "A" ? data.optionA : data.optionB,
    explanation: data.explanation || undefined,
  });
  revalidatePath("/cms/bai-tap");
}

const bankQuestionSchema = z
  .object({
    type: z.enum(["SINGLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]),
    prompt: z.string().min(3).max(2000),
    options: z.array(z.string().min(1).max(500)).max(10).nullable().optional(),
    correctAnswer: z.string().max(2000).nullable().optional(),
    explanation: z.string().max(4000).nullable().optional(),
    points: z.coerce.number().positive().max(100).default(1),
    tags: z.array(z.string().max(50)).max(20).default([]),
  })
  .superRefine((q, ctx) => {
    if (q.type !== "SHORT_ANSWER" && !q.correctAnswer)
      ctx.addIssue({
        code: "custom",
        message: "Câu tự động chấm phải có correctAnswer",
      });
    if (q.type === "SINGLE_CHOICE" && (!q.options || q.options.length < 2))
      ctx.addIssue({
        code: "custom",
        message: "Trắc nghiệm cần ít nhất 2 lựa chọn",
      });
  });

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let value = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') {
      value += '"';
      i++;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else value += char;
  }
  cells.push(value.trim());
  return cells;
}

function parseQuestionFile(fileName: string, text: string) {
  if (fileName.toLowerCase().endsWith(".json")) {
    const raw = JSON.parse(text);
    return z
      .array(bankQuestionSchema)
      .min(1)
      .max(1000)
      .parse(Array.isArray(raw) ? raw : raw.questions);
  }
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length < 2) throw new Error("File CSV chưa có dữ liệu");
  const headers = parseCsvLine(lines[0]);
  const required = ["type", "prompt", "correctAnswer"];
  for (const key of required)
    if (!headers.includes(key)) throw new Error(`CSV thiếu cột ${key}`);
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
    try {
      return bankQuestionSchema.parse({
        type: row.type,
        prompt: row.prompt,
        options: row.options
          ? row.options
              .split("|")
              .map((v: string) => v.trim())
              .filter(Boolean)
          : null,
        correctAnswer: row.correctAnswer || null,
        explanation: row.explanation || null,
        points: row.points || 1,
        tags: row.tags
          ? row.tags
              .split("|")
              .map((v: string) => v.trim())
              .filter(Boolean)
          : [],
      });
    } catch {
      throw new Error(`Dòng ${index + 2} không hợp lệ`);
    }
  });
}

function toBankPayload(
  questions: z.infer<typeof bankQuestionSchema>[],
) {
  return questions.map((q) => ({
    type: q.type,
    prompt: q.prompt,
    options: q.options ?? undefined,
    correctAnswer: q.correctAnswer ?? undefined,
    explanation: q.explanation ?? undefined,
    points: q.points,
    tags: q.tags,
  }));
}

export async function importQuestionBank(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    throw new Error("Vui lòng chọn file CSV hoặc JSON");
  if (file.size > 2 * 1024 * 1024)
    throw new Error("File vượt quá giới hạn 2 MB");
  if (!/\.(csv|json)$/i.test(file.name))
    throw new Error("Chỉ hỗ trợ file .csv hoặc .json");
  const questions = parseQuestionFile(file.name, await file.text());
  await convex().mutation(api.mutations.importQuestionBank, {
    tokenHash,
    sourceFilename: file.name,
    questions: toBankPayload(questions),
  });
  revalidatePath("/cms/ngan-hang-de");
  redirect(`/cms/ngan-hang-de?imported=${questions.length}`);
}

function questionsFromPlainText(text: string) {
  const blocks = text
    .replace(/\r/g, "")
    .split(/(?=^(?:Câu|Question)\s*\d+[.:)])/gim)
    .map((x) => x.trim())
    .filter(Boolean);
  return blocks.slice(0, 200).map((block) => {
    const lines = block.split("\n").map((x) => x.trim()).filter(Boolean);
    const prompt = (lines.shift() || "").replace(
      /^(?:Câu|Question)\s*\d+[.:)]\s*/i,
      "",
    );
    const optionLines = lines.filter((x) => /^[A-H][.)]\s+/.test(x));
    const options = optionLines.map((x) => x.replace(/^[A-H][.)]\s+/, ""));
    const answerLine = lines.find((x) => /^(?:Đáp án|Answer)\s*:/i.test(x));
    const answerKey = answerLine?.split(":").slice(1).join(":").trim();
    const letter = answerKey?.match(/^[A-H]$/i)?.[0].toUpperCase();
    const correct =
      (letter && options[letter.charCodeAt(0) - 65]) || answerKey || null;
    return bankQuestionSchema.parse({
      type: options.length >= 2 && correct ? "SINGLE_CHOICE" : "SHORT_ANSWER",
      prompt: prompt || block.slice(0, 2000),
      options: options.length >= 2 ? options : null,
      correctAnswer: correct,
      explanation: null,
      points: 1,
      tags: ["nhập-từ-tài-liệu"],
    });
  });
}

export async function importQuestionDocument(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size)
    throw new Error("Vui lòng chọn tài liệu đề");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Tài liệu vượt quá 10 MB");
  const ext = path.extname(file.name).toLowerCase();
  if (![".txt", ".docx", ".pdf"].includes(ext))
    throw new Error("Chỉ hỗ trợ TXT, DOCX hoặc PDF");
  const buffer = Buffer.from(await file.arrayBuffer());
  let extracted = "";
  if (ext === ".txt") extracted = buffer.toString("utf8");
  else if (ext === ".docx") {
    const mammoth = await import("mammoth");
    extracted = (await mammoth.extractRawText({ buffer })).value;
  } else {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      extracted = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }
  if (extracted.trim().length < 10)
    throw new Error("Không đọc được nội dung chữ trong tài liệu");
  let questions: z.infer<typeof bankQuestionSchema>[];
  if (process.env.QUESTION_AI_ENDPOINT) {
    const response = await fetch(process.env.QUESTION_AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.QUESTION_AI_TOKEN
          ? { Authorization: `Bearer ${process.env.QUESTION_AI_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        task: "extract_questions",
        language: "vi",
        text: extracted.slice(0, 100000),
        schema: {
          type: "SINGLE_CHOICE | TRUE_FALSE | SHORT_ANSWER",
          prompt: "string",
          options: "string[] | null",
          correctAnswer: "string | null",
          explanation: "string | null",
          points: "number",
          tags: "string[]",
        },
      }),
    });
    if (!response.ok) throw new Error("Dịch vụ AI chưa xử lý được tài liệu");
    const raw = await response.json();
    questions = z
      .array(bankQuestionSchema)
      .min(1)
      .max(500)
      .parse(Array.isArray(raw) ? raw : (raw as { questions: unknown }).questions);
  } else questions = questionsFromPlainText(extracted);
  if (!questions.length)
    throw new Error(
      "Chưa nhận diện được câu hỏi; hãy dùng file CSV mẫu hoặc cấu hình AI",
    );
  await convex().mutation(api.mutations.importQuestionBank, {
    tokenHash,
    sourceFilename: file.name,
    questions: toBankPayload(questions),
  });
  revalidatePath("/cms/ngan-hang-de");
  redirect(`/cms/ngan-hang-de?imported=${questions.length}`);
}

export async function createAssignmentFromQuestionBank(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const questionIds = formData.getAll("questionIds").map(String);
  const data = z
    .object({
      classId: idSchema,
      title: z.string().min(3).max(160),
      instructions: z.string().min(3).max(1000),
      dueAt: z.string().optional(),
      mode: z.enum(["PRACTICE", "EXAM"]).default("PRACTICE"),
    })
    .parse(Object.fromEntries(formData));
  if (questionIds.length < 1)
    throw new Error("Vui lòng chọn ít nhất một câu hỏi");
  if (questionIds.length > 100)
    throw new Error("Mỗi bài tập hỗ trợ tối đa 100 câu hỏi");
  const ids = z.array(idSchema).parse(questionIds);
  await convex().mutation(api.mutations.createAssignmentFromBank, {
    tokenHash,
    classId: data.classId as Id<"classes">,
    title: data.title,
    instructions: data.instructions,
    dueAt: dueAtMs(data.dueAt),
    mode: data.mode,
    questionIds: ids as Id<"questionBankItems">[],
  });
  revalidatePath("/cms/bai-tap");
  redirect("/cms/bai-tap?created=bank");
}

export async function saveAnswers(
  attemptId: string,
  answers: Record<string, string>,
) {
  const tokenHash = await requireSessionHash();
  await convex().mutation(api.mutations.saveAnswers, {
    tokenHash,
    attemptId: attemptId as Id<"attempts">,
    answers,
  });
}

export async function checkAnswer(
  attemptId: string,
  questionId: string,
  answer: string,
) {
  const tokenHash = await requireSessionHash();
  const ids = z
    .object({
      attemptId: idSchema,
      questionId: idSchema,
      answer: z.string().max(4000),
    })
    .parse({ attemptId, questionId, answer });
  const question = await convex().query(api.portal.checkAnswer, {
    tokenHash,
    attemptId: ids.attemptId as Id<"attempts">,
    questionId: ids.questionId as Id<"questions">,
  });
  if (!question) throw new Error("Không thể kiểm tra câu hỏi này");
  if (question.mode === "EXAM")
    throw new Error("Bài kiểm tra chỉ hiển thị đáp án sau khi nộp");
  if (question.type === "SHORT_ANSWER")
    return {
      kind: "manual" as const,
      explanation:
        question.explanation ||
        "Câu trả lời này sẽ được giáo viên nhận xét khi chấm bài.",
    };
  return {
    kind: "automatic" as const,
    correct: String(answer) === String(question.correct_answer ?? ""),
    expected: String(question.correct_answer ?? ""),
    explanation:
      question.explanation || "Giáo viên chưa bổ sung giải thích cho câu này.",
  };
}

export async function submitAttempt(
  attemptId: string,
  answers: Record<string, string>,
) {
  const tokenHash = await requireSessionHash();
  await convex().mutation(api.mutations.submitAttempt, {
    tokenHash,
    attemptId: attemptId as Id<"attempts">,
    answers,
  });
  redirect(`/hoc-tap/ket-qua/${attemptId}`);
}

export async function updateAssignmentStatus(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({
      assignmentId: idSchema,
      status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.updateAssignmentStatus, {
    tokenHash,
    assignmentId: data.assignmentId as Id<"assignments">,
    status: data.status,
  });
  revalidatePath("/cms/bai-tap");
  revalidatePath(`/cms/bai-tap/${data.assignmentId}`);
}

export async function updateAssignmentDetails(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({
      assignmentId: idSchema,
      title: z.string().min(3).max(160),
      instructions: z.string().min(3).max(1000),
      dueAt: z.string().optional(),
      mode: z.enum(["PRACTICE", "EXAM"]),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.updateAssignmentDetails, {
    tokenHash,
    assignmentId: data.assignmentId as Id<"assignments">,
    title: data.title,
    instructions: data.instructions,
    dueAt: dueAtMs(data.dueAt),
    mode: data.mode,
  });
  revalidatePath(`/cms/bai-tap/${data.assignmentId}`);
}

export async function duplicateAssignment(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const id = idSchema.parse(formData.get("assignmentId"));
  await convex().mutation(api.mutations.duplicateAssignment, {
    tokenHash,
    assignmentId: id as Id<"assignments">,
  });
  revalidatePath("/cms/bai-tap");
}

export async function gradeAttempt(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({
      attemptId: idSchema,
      manualScore: z.coerce.number().min(0).max(1000),
      feedback: z.string().max(3000),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.gradeAttempt, {
    tokenHash,
    attemptId: data.attemptId as Id<"attempts">,
    manualScore: data.manualScore,
    feedback: data.feedback,
  });
  revalidatePath(`/cms/bai-tap`);
}

export async function createDepartment(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({
      name: z.string().min(2).max(100),
      description: z.string().max(500).optional(),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.createDepartment, {
    tokenHash,
    name: data.name,
    description: data.description || undefined,
  });
  revalidatePath("/cms/phong-ban");
}

export async function createPermissionGroup(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const menuKeys = formData.getAll("menuKeys").map(String);
  const data = z
    .object({
      name: z.string().min(2).max(100),
      description: z.string().max(500).optional(),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.createPermissionGroup, {
    tokenHash,
    name: data.name,
    description: data.description || undefined,
    menuKeys,
  });
  revalidatePath("/cms/nhom-quyen");
}

export async function createUser(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const groupIds = formData.getAll("groupIds").map(String);
  const parsed = z
    .object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      password: z.string().min(MIN_NEW_PASSWORD).max(100),
      role: z.enum(["ADMIN", "MOD", "USER"]),
      departmentId: z.string().optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      error:
        "Kiểm tra lại họ tên, email và mật khẩu tạm (tối thiểu 10 ký tự).",
    };
  const data = parsed.data;
  try {
    await convex().mutation(api.mutations.createUser, {
      tokenHash,
      name: data.name,
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 12),
      role: data.role,
      departmentId: data.departmentId
        ? (data.departmentId as Id<"departments">)
        : undefined,
      groupIds: groupIds as Id<"permissionGroups">[],
    });
  } catch (cause) {
    return {
      error:
        cause instanceof Error
          ? cause.message
          : "Không tạo được tài khoản. Thử lại.",
    };
  }
  revalidatePath("/cms/nguoi-dung");
  return {
    name: data.name,
    email: data.email,
    tempPassword: data.password,
  };
}

export async function updateUserStatus(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({
      userId: idSchema,
      status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.updateUserStatus, {
    tokenHash,
    userId: data.userId as Id<"users">,
    status: data.status,
  });
  revalidatePath("/cms/nguoi-dung");
}

export async function adminResetPassword(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const parsed = z
    .object({
      userId: idSchema,
      password: z.string().min(MIN_NEW_PASSWORD).max(100),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: "Mật khẩu tạm phải có tối thiểu 10 ký tự." };
  const data = parsed.data;
  try {
    const user = await convex().mutation(api.mutations.adminResetPassword, {
      tokenHash,
      userId: data.userId as Id<"users">,
      passwordHash: await bcrypt.hash(data.password, 12),
    });
    revalidatePath("/cms/nguoi-dung");
    return {
      name: user.name,
      email: user.email,
      tempPassword: data.password,
    };
  } catch (cause) {
    return {
      error:
        cause instanceof Error
          ? cause.message
          : "Không đặt lại được mật khẩu. Thử lại.",
    };
  }
}

export async function changePassword(formData: FormData) {
  const tokenHash = await requireSessionHash();
  await requireActor(undefined, { allowMustChangePassword: true });
  const data = z
    .object({
      currentPassword: z.string().min(8).max(100),
      newPassword: z.string().min(1).max(100),
    })
    .safeParse(Object.fromEntries(formData));
  if (!data.success || !passwordMeetsPolicy(data.data.newPassword))
    redirect("/tai-khoan?error=short");
  if (isReusableTempPassword(data.data.newPassword, data.data.currentPassword))
    redirect("/tai-khoan?error=same");
  const hash = await convex().query(api.cms.passwordHash, { tokenHash });
  if (!hash || !(await bcrypt.compare(data.data.currentPassword, hash)))
    redirect("/tai-khoan?error=current");
  await convex().mutation(api.mutations.changePassword, {
    tokenHash,
    passwordHash: await bcrypt.hash(data.data.newPassword, 12),
  });
  await destroySession();
  redirect("/dang-nhap?changed=1");
}

export async function enrollStudent(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({ studentId: idSchema, classId: idSchema })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.enrollStudent, {
    tokenHash,
    studentId: data.studentId as Id<"users">,
    classId: data.classId as Id<"classes">,
  });
  revalidatePath("/cms/hoc-sinh");
}

export async function unenrollStudent(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({ studentId: idSchema, classId: idSchema })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.unenrollStudent, {
    tokenHash,
    studentId: data.studentId as Id<"users">,
    classId: data.classId as Id<"classes">,
  });
  revalidatePath("/cms/hoc-sinh");
}

export async function uploadResource(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const file = formData.get("file");
  const classIds = formData.getAll("classIds").map(String);
  const data = z
    .object({
      title: z.string().min(3).max(180),
      description: z.string().max(1000),
    })
    .parse(Object.fromEntries(formData));
  if (!(file instanceof File) || !file.size)
    throw new Error("Vui lòng chọn file");
  const max = Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024;
  if (file.size > max) throw new Error("File vượt quá giới hạn");
  const allowedTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "audio/mpeg",
  ]);
  if (!allowedTypes.has(file.type))
    throw new Error("Định dạng file chưa được hỗ trợ");
  const uploadUrl = await convex().mutation(api.mutations.generateUploadUrl, {
    tokenHash,
  });
  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!uploaded.ok) throw new Error("Không tải được file lên Convex");
  const { storageId } = (await uploaded.json()) as { storageId: Id<"_storage"> };
  await convex().mutation(api.mutations.createResource, {
    tokenHash,
    title: data.title,
    description: data.description,
    mimeType: file.type,
    storageId,
    originalName: file.name,
    byteSize: file.size,
    classIds: classIds as Id<"classes">[],
  });
  revalidatePath("/cms/tai-lieu");
}

export async function createWorkTask(formData: FormData) {
  await requireMenuAccess("cms.tasks");
  const tokenHash = await requireSessionHash();
  const actor = await requireActor();
  if (actor.role === "USER") throw new Error("Chỉ Admin và Mod được giao việc");
  const data = z
    .object({
      title: z.string().min(3).max(180),
      description: z.string().max(3000).optional(),
      assignedTo: idSchema,
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      dueAt: z.string().optional(),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.createWorkTask, {
    tokenHash,
    title: data.title,
    description: data.description || undefined,
    assignedTo: data.assignedTo as Id<"users">,
    priority: data.priority,
    dueAt: dueAtMs(data.dueAt),
  });
  revalidatePath("/cms/cong-viec");
  revalidatePath("/hoc-tap/cong-viec");
}

export async function updateWorkTaskStatus(formData: FormData) {
  const tokenHash = await requireSessionHash();
  const data = z
    .object({
      taskId: idSchema,
      status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
    })
    .parse(Object.fromEntries(formData));
  await convex().mutation(api.mutations.updateWorkTaskStatus, {
    tokenHash,
    taskId: data.taskId as Id<"workTasks">,
    status: data.status,
  });
  revalidatePath("/cms/cong-viec");
  revalidatePath("/hoc-tap/cong-viec");
}
