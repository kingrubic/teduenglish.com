import { AppShell } from "@/components/AppShell";
import { requireMenuAccess } from "@/lib/permissions";
import { data } from "@/lib/data";

type Track={id:string;title:string;summary:string;target:string;status:string};
type Module={id:string;title:string;skill:string;summary:string;accent:string;unit_count:number;published_count:number};

export default async function IeltsCms(){
  const actor=await requireMenuAccess("cms.ielts");
  const page=await data.ieltsCms();
  const track=page.track as Track | null;
  const modules={rows:page.modules as Module[]};
  const total=modules.rows.reduce((sum,item)=>sum+item.unit_count,0);
  const published=modules.rows.reduce((sum,item)=>sum+item.published_count,0);

  return <AppShell actor={actor}>
    <div className="content-head ielts-cms-head"><div><div className="eyebrow">Quản trị chương trình</div><h1>Luyện thi IELTS</h1><p className="muted">Cấu trúc nội dung theo kỹ năng, sẵn sàng kết nối trình biên tập CMS.</p></div><span className={`tag ${track?.status==="PUBLISHED"?"success":"warning"}`}>{track?.status==="PUBLISHED"?"Đang hiển thị":"Bản nháp"}</span></div>
    {track?<>
      <section className="ielts-cms-summary">
        <div><small>Định hướng</small><strong>{track.target}</strong><p>{track.summary}</p></div>
        <div className="ielts-cms-metrics"><span><b>{modules.rows.length}</b>Kỹ năng & chặng</span><span><b>{total}</b>Nội dung</span><span><b>{published}</b>Đã xuất bản</span></div>
      </section>
      <div className="ielts-path-head"><div><h2>Cấu trúc chương trình</h2><p className="muted">Mỗi module chứa bài học, bài luyện tập, thi thử hoặc tài liệu.</p></div><span className="tag">CMS-ready</span></div>
      <div className="ielts-cms-grid">{modules.rows.map((module,index)=><article className={`ielts-cms-module accent-${module.accent}`} key={module.id}><span className="ielts-cms-index">{String(index+1).padStart(2,"0")}</span><div><span className="tag">{module.skill}</span><h3>{module.title}</h3><p>{module.summary}</p></div><footer><span><b>{module.unit_count}</b> nội dung</span><span><b>{module.published_count}</b> đã xuất bản</span></footer></article>)}</div>
      <section className="ielts-cms-types card"><div><div className="eyebrow">Loại nội dung</div><h2>Cấu trúc đã chuẩn hóa</h2></div><div><span><b>01</b>Bài học</span><span><b>02</b>Luyện tập</span><span><b>03</b>Thi thử</span><span><b>04</b>Tài liệu</span></div></section>
    </>:<div className="empty-state">Chưa có cấu trúc IELTS cho đơn vị này.</div>}
  </AppShell>;
}
