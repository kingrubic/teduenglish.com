import { AppShell } from "@/components/AppShell";
import { createDepartment } from "@/lib/actions";
import { requireActor } from "@/lib/auth";
import { data } from "@/lib/data";

export default async function Departments(){const actor=await requireActor(["ADMIN"]);const rows=await data.departmentsPage();return <AppShell actor={actor}><div className="content-head"><div><div className="eyebrow">Cấu trúc tổ chức</div><h1>Phòng ban</h1></div><span className="tag">Chỉ Admin</span></div><div className="columns"><section className="data-list">{rows.rows.length?rows.rows.map(item=><article className="data-row" key={item.id}><div><strong>{item.name}</strong><div className="muted">{item.description||"Chưa có mô tả"}</div></div><span>{item.members} thành viên</span></article>):<div className="empty-state">Chưa có phòng ban.</div>}</section><section className="card"><h2>Tạo phòng ban</h2><form className="form" action={createDepartment}><label>Tên phòng ban<input name="name" required/></label><label>Mô tả<textarea name="description"/></label><button className="button accent">Tạo phòng ban</button></form></section></div></AppShell>}
