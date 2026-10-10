import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell">
      <section className="gate" style={{ marginInline: "auto" }}>
        <div>
          <p className="eyebrow">Không tìm thấy</p>
          <h2>Trang này không tồn tại</h2>
          <p className="small muted">Có thể đường link đã cũ hoặc bài đã được đổi tên.</p>
        </div>
        <Link className="btn btn-primary" href="/">
          Về trang học tập
        </Link>
      </section>
    </div>
  );
}
