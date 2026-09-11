import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireMenuAccess } from "@/lib/permissions";
import { data } from "@/lib/data";

type Module={id:string;slug:string;title:string;skill:string;summary:string;accent:string;unit_count:number;completed_count:number};

export default async function IeltsLearning(){
  const actor=await requireMenuAccess("portal.ielts");
  const page=await data.ieltsLearning();
  const current=page.track;
  const modules={rows:page.modules as Module[]};
  return <AppShell actor={actor}><div className="ielts-hero"><div><div className="eyebrow">Không gian học tập · IELTS</div><h1>{current?.title||"Luyện thi IELTS"}</h1><p>{current?.summary||"Lộ trình IELTS đang được xây dựng."}</p></div><div className="ielts-target"><small>Đích đến</small><strong>{current?.target||"Band mục tiêu cá nhân"}</strong></div></div><div className="ielts-path-head"><div><h2>Lộ trình theo năng lực</h2><p className="muted">Học theo kỹ năng, luyện theo dạng bài và kiểm tra theo từng chặng.</p></div><span className="tag">Cấu trúc CMS-ready</span></div><div className="ielts-module-grid">{modules.rows.map((m,index)=><article className={`ielts-module accent-${m.accent}`} key={m.id}><div className="ielts-module-number">{String(index+1).padStart(2,"0")}</div><span className="tag">{m.skill}</span><h3>{m.title}</h3><p>{m.summary}</p><div className="ielts-progress"><span><b>{m.completed_count}</b>/{m.unit_count} nội dung hoàn thành</span><div><i style={{width:`${m.unit_count?Math.round(m.completed_count/m.unit_count*100):0}%`}}/></div></div>{m.unit_count?<Link className="text-link" href={`/hoc-tap/ielts/${m.slug}`}>Tiếp tục học →</Link>:<span className="muted">Nội dung sắp được cập nhật</span>}</article>)}</div><section className="ielts-flow card"><div><span className="eyebrow">Chu trình học</span><h2>Mỗi vòng học đều tạo ra dữ liệu tiến bộ</h2></div><ol><li><b>01</b><span>Chẩn đoán đầu vào</span></li><li><b>02</b><span>Học chiến lược</span></li><li><b>03</b><span>Luyện dạng bài</span></li><li><b>04</b><span>Thi thử & phản hồi</span></li></ol></section></AppShell>;
}
