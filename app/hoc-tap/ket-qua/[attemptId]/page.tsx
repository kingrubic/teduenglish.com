import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireMenuAccess } from "@/lib/permissions";
import { data } from "@/lib/data";

type QuestionResult={id:string;prompt:string;type:string;correct_answer:unknown;explanation:string|null;points:string;position:number};
function answerText(value:unknown){if(value===null||value===undefined||value==="")return "Chưa trả lời";return typeof value==="string"?value:JSON.stringify(value);}

export default async function Result({params}:{params:Promise<{attemptId:string}>}){
 const actor=await requireMenuAccess("portal.assignments");const {attemptId}=await params;
 const attempt=await data.resultPage(attemptId);if(!attempt)notFound();
 const questions={rows:attempt.questions as QuestionResult[]};
 return <AppShell actor={actor}><div className="content-head"><div><div className="eyebrow">Bài đã nộp</div><h1>Kết quả & giải thích</h1></div></div><div className="card result-summary"><span className="tag">{attempt.status}</span><h2>{attempt.title}</h2><p className="score">{attempt.score??"—"} / {attempt.total}</p><p>{attempt.status==="PENDING_GRADING"?"Phần trắc nghiệm đã chấm. Câu tự luận đang chờ giáo viên chấm.":"Bài đã được chấm tự động. Xem đáp án và giải thích bên dưới."}</p>{attempt.teacher_feedback&&<div className="success">Nhận xét của giáo viên: {attempt.teacher_feedback}</div>}</div><div className="quiz review-list">{questions.rows.map((q,index)=>{const expected=answerText(q.correct_answer);const given=answerText(attempt.answers?.[q.id]);const auto=q.type!=="SHORT_ANSWER";const correct=auto&&given===expected;return <section className={`question review-question ${auto?(correct?"is-correct":"is-wrong"):"is-pending"}`} key={q.id}><div className="review-heading"><strong>Câu {index+1} · {q.points} điểm</strong><span className={`tag ${auto?(correct?"success":"danger"):"warning"}`}>{auto?(correct?"Đúng":"Chưa đúng"):"Chờ giáo viên chấm"}</span></div><h3>{q.prompt}</h3><div className="answer-comparison"><div><small>Câu trả lời của em</small><strong>{given}</strong></div><div><small>Đáp án đúng</small><strong>{auto?expected:"Giáo viên đánh giá"}</strong></div></div><div className="explanation"><strong>Giải thích</strong><p>{q.explanation||"Giáo viên chưa bổ sung giải thích cho câu này."}</p></div></section>})}</div></AppShell>;
}
