"use client";
import { useEffect, useState, useTransition } from "react";
import { checkAnswer, saveAnswers, submitAttempt } from "@/lib/actions";
type Q = {
  id: string;
  type: string;
  prompt: string;
  options: string[] | null;
  points: string;
};
type Feedback = Awaited<ReturnType<typeof checkAnswer>>;
export function QuizForm({
  attemptId,
  questions,
  initial,
  mode,
}: {
  attemptId: string;
  questions: Q[];
  initial: Record<string, string>;
  mode: string;
}) {
  const [answers, setAnswers] = useState(initial);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [submitting, startSubmit] = useTransition();
  useEffect(() => {
    const timer = setTimeout(
      () => startSaving(() => saveAnswers(attemptId, answers)),
      800,
    );
    return () => clearTimeout(timer);
  }, [answers, attemptId]);
  async function reveal(q: Q, answer: string) {
    setChecking(q.id);
    setFeedback((current) => {
      const next = { ...current };
      delete next[q.id];
      return next;
    });
    try {
      const result = await checkAnswer(attemptId, q.id, answer);
      setFeedback((current) => ({ ...current, [q.id]: result }));
    } finally {
      setChecking((current) => (current === q.id ? null : current));
    }
  }
  function choose(q: Q, answer: string) {
    setAnswers((current) => ({ ...current, [q.id]: answer }));
    if (mode === "PRACTICE") void reveal(q, answer);
  }
  return (
    <div className="quiz">
      {questions.map((q, i) => {
        const review = feedback[q.id];
        return (
          <div className="question" key={q.id}>
            <strong>
              Câu {i + 1} · {q.points} điểm
            </strong>
            <h3>{q.prompt}</h3>
            {q.options ? (
              <div className="options">
                {q.options.map((o) => (
                  <label
                    className={`option ${review && answers[q.id] === o ? (review.kind === "automatic" && review.correct ? "selected-correct" : "selected-wrong") : ""}`}
                    key={o}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={o}
                      checked={answers[q.id] === o}
                      onChange={(e) => choose(q, e.target.value)}
                    />
                    {o}
                  </label>
                ))}
              </div>
            ) : (
              <>
                <textarea
                  value={answers[q.id] || ""}
                  onChange={(e) => {
                    setAnswers((current) => ({
                      ...current,
                      [q.id]: e.target.value,
                    }));
                    setFeedback((current) => {
                      const next = { ...current };
                      delete next[q.id];
                      return next;
                    });
                  }}
                  placeholder="Nhập câu trả lời"
                />
                {mode === "PRACTICE" && <button className="button secondary check-answer" type="button" disabled={!answers[q.id]?.trim() || checking === q.id} onClick={() => void reveal(q, answers[q.id])}>{checking === q.id ? "Đang kiểm tra…" : "Xem đáp án & giải thích"}</button>}
              </>
            )}
            {checking === q.id && q.options && (
              <p className="muted inline-checking">Đang kiểm tra đáp án…</p>
            )}
            {review && (
              <div
                className={`instant-feedback ${review.kind === "manual" ? "is-manual" : review.correct ? "is-correct" : "is-wrong"}`}
                role="status"
              >
                <strong>
                  {review.kind === "manual"
                    ? "Câu này cần giáo viên đánh giá"
                    : review.correct
                      ? "Chính xác!"
                      : "Chưa chính xác"}
                </strong>
                {review.kind === "automatic" && (
                  <p>
                    Đáp án đúng: <b>{review.expected}</b>
                  </p>
                )}
                <p>
                  <b>Giải thích:</b> {review.explanation}
                </p>
              </div>
            )}
          </div>
        );
      })}
      <div className="data-row">
        <span className="muted">
          {saving ? "Đang lưu…" : "Đã bật tự động lưu"}
        </span>
        <button
          className="button"
          disabled={submitting}
          onClick={() => {
            if (confirm("Xác nhận nộp bài?"))
              startSubmit(() => submitAttempt(attemptId, answers));
          }}
        >
          {submitting ? "Đang nộp…" : "Nộp bài"}
        </button>
      </div>
    </div>
  );
}
