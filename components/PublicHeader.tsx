import Image from "next/image";
import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="site-header">
      <div className="container nav">
        <Link className="brand" href="/" aria-label="TEDUENGLISH — Trang chủ">
          <Image
            src="/teduenglish-logo.png"
            width={1254}
            height={888}
            priority
            alt="TEDUENGLISH"
          />
        </Link>
        <nav className="navlinks" aria-label="Điều hướng chính">
          <Link href="/gioi-thieu">Giới thiệu</Link>
          <Link href="/chuong-trinh">Chương trình</Link>
          <Link href="/thoi-khoa-bieu">Lịch học</Link>
          <Link href="/dang-ky-tu-van">Tư vấn</Link>
          <Link className="button header-login" href="/dang-nhap">
            Cổng học tập <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
