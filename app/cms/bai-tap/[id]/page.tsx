import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { duplicateAssignment, gradeAttempt, updateAssignmentDetails, updateAssignmentStatus } from "@/lib/actions";
import { data } from "@/lib/data";
import { requireMenuAccess } from "@/lib/permissions";
export default async function AssignmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireMenuAccess("cms.assignments");
  const { id } = await params;
  const detail = await data.assignmentDetail(id);
  if (!detail) notFound();
  const attempts = { rows: detail.attempts };
  const shortQuestions = { rows: detail.shortQuestions };
  const a = detail.assignment;
  return (
    <AppShell actor={actor}>
      <div className="content-head">
        <div>
          <div className="eyebrow">
            {a.class_name} · {a.mode === "EXAM" ? "Kiểm tra" : "Luyện tập"}
          </div>
          <h1>{a.title}</h1>
          <p>{a.instructions}</p>
        </div>
        <form action={updateAssignmentStatus}>
          <input type="hidden" name="assignmentId" value={id} />
          <select name="status" defaultValue={a.status}>
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Đang mở</option>
            <option value="ARCHIVED">Đã đóng</option>
          </select>
          <button className="button secondary">Cập nhật trạng thái</button>
        </form>
      </div>
      <div className="columns assignment-settings"><section className="card"><h2>Chỉnh sửa bài</h2><form className="form" action={updateAssignmentDetails}><input type="hidden" name="assignmentId" value={id}/><label>Tiêu đề<input name="title" defaultValue={a.title} required/></label><label>Hướng dẫn<textarea name="instructions" defaultValue={a.instructions} required/></label><label>Chế độ<select name="mode" defaultValue={a.mode}><option value="PRACTICE">Luyện tập</option><option value="EXAM">Kiểm tra</option></select></label><label>Hạn nộp<input name="dueAt" type="datetime-local" defaultValue={a.due_at?new Date(a.due_at).toISOString().slice(0,16):""}/></label><button className="button">Lưu thay đổi</button></form></section><section className="card"><h2>Tái sử dụng</h2><p className="muted">Tạo một bản sao ở trạng thái nháp, giữ nguyên toàn bộ câu hỏi nhưng chưa giao cho học sinh.</p><form action={duplicateAssignment}><input type="hidden" name="assignmentId" value={id}/><button className="button secondary">Nhân bản bài tập</button></form></section></div>
      <h2>Bài làm của học sinh</h2>
      <div className="data-list">
        {attempts.rows.map((t) => (
          <article className="card" key={t.id}>
            <div>
              <strong>{t.student}</strong>
              <div className="muted">
                {t.status} ·{" "}
                {t.submitted_at
                  ? new Date(t.submitted_at).toLocaleString("vi-VN")
                  : "Chưa nộp"}{" "}
                · {t.score ?? "—"} điểm
              </div>
            </div>
            {t.status === "PENDING_GRADING" && (
              <form className="form grading-form" action={gradeAttempt}>
                {shortQuestions.rows.map(q=><div className="student-answer" key={q.id}><b>{q.prompt}</b><p>{t.answers?.[q.id]||"Chưa trả lời"}</p></div>)}
                <input type="hidden" name="attemptId" value={t.id} />
                <label>
                  Điểm tự luận (tối đa {t.manual_max})
                  <input
                    name="manualScore"
                    type="number"
                    min="0"
                    max={t.manual_max}
                    step="0.25"
                    required
                  />
                </label>
                <label>
                  Nhận xét
                  <textarea name="feedback" />
                </label>
                <button className="button">Lưu điểm và hoàn tất chấm</button>
              </form>
            )}
          </article>
        ))}
      </div>
    </AppShell>
  );
}
