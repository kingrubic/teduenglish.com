import { AppShell } from "@/components/AppShell";
import {
  createAssignmentFromQuestionBank,
  importQuestionDocument,
  importQuestionBank,
} from "@/lib/actions";
import { data } from "@/lib/data";
import { requireMenuAccess } from "@/lib/permissions";

export default async function QuestionBank({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string }>;
}) {
  const actor = await requireMenuAccess("cms.question_bank");
  const params = await searchParams;
  const [bank, classes] = await Promise.all([
    data.questionBankPage(),
    data.classOptions(true),
  ]);
  const items = { rows: bank.items };
  return (
    <AppShell actor={actor}>
      <div className="content-head">
        <div>
          <div className="eyebrow">Từ đề mẫu đến bài tập</div>
          <h1>Ngân hàng đề</h1>
          <p className="muted">
            Tải câu hỏi lên, rà soát, chọn câu phù hợp rồi giao thành bài tập
            cho lớp.
          </p>
        </div>
      </div>
      {params.imported && (
        <div className="success import-notice">
          Đã tạo {params.imported} câu hỏi. Thầy có thể chọn câu và giao bài
          ngay bên dưới.
        </div>
      )}
      <div className="columns bank-layout">
        <section className="card">
          <h2>1. Tải đề mẫu lên</h2>
          <p className="muted">
            Bản hiện tại nhận CSV/JSON theo mẫu để đáp án không bị đọc sai. Hệ
            thống kiểm tra toàn bộ file trước khi lưu.
          </p>
          <form className="form" action={importQuestionBank}>
            <label>
              File câu hỏi (.CSV hoặc .JSON, tối đa 2 MB)
              <input
                name="file"
                type="file"
                accept=".csv,.json,text/csv,application/json"
                required
              />
            </label>
            <button className="button" type="submit">
              Đọc và tạo câu hỏi
            </button>
          </form>
          <div className="template-help"><strong>Hoặc nhập đề Word/PDF</strong><p className="muted">Hệ thống đọc nội dung thành câu hỏi nháp. Với đề có đáp án A/B/C/D, nên ghi rõ dòng “Đáp án: A”. Nếu đã cấu hình dịch vụ AI, hệ thống sẽ tự nhận diện cấu trúc linh hoạt hơn.</p><form className="form" action={importQuestionDocument}><label>File đề (.DOCX, .PDF hoặc .TXT, tối đa 10 MB)<input name="file" type="file" accept=".docx,.pdf,.txt" required/></label><button className="button secondary">Đọc đề và tạo bản nháp</button></form></div>
          <div className="template-help">
            <strong>Cấu trúc CSV</strong>
            <code>
              type,prompt,options,correctAnswer,explanation,points,tags
            </code>
            <p className="muted">
              Các lựa chọn và tags ngăn cách bằng dấu |. Hỗ trợ trắc nghiệm,
              đúng/sai và trả lời ngắn.
            </p>
            <a
              className="button secondary"
              href="/templates/ngan-hang-de-mau.csv"
              download
            >
              Tải file mẫu CSV
            </a>
          </div>
        </section>
        <section className="card">
          <h2>2. Chọn câu và giao bài</h2>
          {items.rows.length ? (
            <form className="form" action={createAssignmentFromQuestionBank}>
              <div className="bank-question-picker">
                {items.rows.map((item, index) => (
                  <label className="bank-select-item" key={item.id}>
                    <input type="checkbox" name="questionIds" value={item.id} />
                    <span>
                      <b>
                        Câu {index + 1}: {item.prompt}
                      </b>
                      <small>
                        {item.type} · {item.points} điểm ·{" "}
                        {item.source_filename || "Tạo trực tiếp"}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            <label>
              Lớp nhận bài
                <select name="classId" required>
                  <option value="">Chọn lớp học</option>
                  {classes.rows.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Chế độ
              <select name="mode">
                <option value="PRACTICE">Luyện tập · xem giải thích ngay</option>
                <option value="EXAM">Kiểm tra · chỉ xem sau khi nộp</option>
              </select>
            </label>
            <label>
              Tên bài tập
                <input
                  name="title"
                  placeholder="Ví dụ: Ôn tập Unit 3"
                  required
                />
              </label>
              <label>
                Hướng dẫn
                <input
                  name="instructions"
                  defaultValue="Đọc kỹ câu hỏi và hoàn thành toàn bộ bài tập."
                  required
                />
              </label>
              <label>
                Hạn nộp
                <input name="dueAt" type="datetime-local" />
              </label>
              <button className="button" type="submit">
                Xuất bản và giao cho học sinh
              </button>
              <p className="muted">
                Chỉ câu được đánh dấu mới vào bài. Học sinh trong lớp sẽ nhận
                bài ngay sau khi xuất bản.
              </p>
            </form>
          ) : (
            <div className="empty-state">
              Chưa có câu hỏi. Hãy tải file mẫu ở bước 1 trước.
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
