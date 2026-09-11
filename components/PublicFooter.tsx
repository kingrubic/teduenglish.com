import Image from "next/image";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { getSiteSettings } from "@/lib/site";

export async function PublicFooter() {
  const site = await getSiteSettings();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Image
              src="/teduenglish-logo.png"
              width={1254}
              height={888}
              alt="TEDUENGLISH"
            />
            <p>
              {brand.tagline}. Không gian học tiếng Anh có lộ trình, có phản hồi
              và có người đồng hành.
            </p>
            <Link className="footer-cta" href="/dang-ky-tu-van">
              Nhận tư vấn lộ trình <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div>
            <strong>Khám phá</strong>
            <nav className="footer-links">
              <Link href="/gioi-thieu">Giới thiệu</Link>
              <Link href="/chuong-trinh">Chương trình học</Link>
              <Link href="/thoi-khoa-bieu">Lịch khai giảng</Link>
              <Link href="/dang-nhap">Cổng học sinh</Link>
            </nav>
          </div>
          <div>
            <strong>Thông tin đơn vị</strong>
            <div className="footer-meta">
              <p>
                <span>Đơn vị chủ quản</span>
                {brand.legalName}
              </p>
              <p>
                <span>Mã số thuế</span>
                {brand.taxCode}
              </p>
              <p>
                <span>Địa chỉ</span>
                {brand.address}
              </p>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} TEDUENGLISH. All rights reserved.
          </span>
          <span>Phụ trách chuyên môn: {site.teacherName}</span>
        </div>
      </div>
    </footer>
  );
}
