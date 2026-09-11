import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { getSiteSettings } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function About() {
  const site = await getSiteSettings();

  return (
    <>
      <PublicHeader />
      <main>
        <section className="page-hero about-hero">
          <div className="container about-hero-grid">
            <div>
              <div className="eyebrow">Giới thiệu TEDUENGLISH</div>
              <h1>Một nơi để việc học tiếng Anh rõ ràng hơn.</h1>
            </div>
            <p className="lead">
              Website kết nối lịch học, chương trình, tài liệu và hoạt động tự
              học trong cùng một không gian để học sinh dễ theo dõi và chủ động
              hơn mỗi ngày.
            </p>
          </div>
        </section>

        <section className="section white">
          <div className="container about-content">
            <div className="about-intro">
              <div className="eyebrow">Cách tổ chức việc học</div>
              <h2>Đơn giản, nhất quán và vừa đủ.</h2>
              <p>
                TEDUENGLISH được xây dựng như một phần hỗ trợ cho hoạt động trên
                lớp. Học sinh có thể xem lịch, tìm tài liệu, hoàn thành bài tập
                và theo dõi những việc cần làm mà không phải tìm kiếm ở nhiều
                nơi khác nhau.
              </p>
            </div>

            <div className="about-principles">
              <article>
                <span>01</span>
                <h3>Có lộ trình</h3>
                <p>
                  Nội dung được sắp xếp theo từng giai đoạn và mục tiêu học tập.
                </p>
              </article>
              <article>
                <span>02</span>
                <h3>Có phản hồi</h3>
                <p>
                  Bài tập và tiến độ được theo dõi để học sinh biết điểm cần cải
                  thiện.
                </p>
              </article>
              <article>
                <span>03</span>
                <h3>Có kết nối</h3>
                <p>
                  Hoạt động trên lớp và việc tự học tại nhà được duy trì liền
                  mạch.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section about-teacher-section">
          <div className="container about-teacher">
            <div>
              <div className="eyebrow">Phụ trách chuyên môn</div>
              <h2>{site.teacherName}</h2>
            </div>
            <div>
              <p className="lead">{site.teacherTitle}</p>
              <p>{site.teacherOrganization}</p>
              <p>
                Thầy phụ trách nội dung giảng dạy và sử dụng website để hỗ trợ
                học sinh theo dõi quá trình học tập ngoài giờ lên lớp.
              </p>
              <div className="hero-actions">
                <Link className="button accent" href="/thoi-khoa-bieu">
                  Xem thời khóa biểu
                </Link>
                <Link className="button secondary" href="/dang-ky-tu-van">
                  Đăng ký tư vấn
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
