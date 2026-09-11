CREATE TYPE class_recruitment_status AS ENUM ('RECRUITING','UPCOMING','FULL','CLOSED');
CREATE TYPE schedule_exception_type AS ENUM ('CANCELLED','MAKEUP','TIME_CHANGE','LOCATION_CHANGE');

ALTER TABLE classes
  ADD COLUMN code text,
  ADD COLUMN grade_min smallint,
  ADD COLUMN grade_max smallint,
  ADD COLUMN recruitment_status class_recruitment_status NOT NULL DEFAULT 'RECRUITING',
  ADD COLUMN capacity integer,
  ADD COLUMN public_remaining_seats boolean NOT NULL DEFAULT false,
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN public_online_info text,
  ADD COLUMN is_demo boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT classes_grade_min_check CHECK (grade_min BETWEEN 6 AND 12),
  ADD CONSTRAINT classes_grade_max_check CHECK (grade_max BETWEEN 6 AND 12),
  ADD CONSTRAINT classes_grade_range_check CHECK (grade_min IS NULL OR grade_max IS NULL OR grade_min <= grade_max),
  ADD CONSTRAINT classes_capacity_check CHECK (capacity IS NULL OR capacity > 0);

UPDATE classes
SET code = 'DEV-A2-01', grade_min = 6, grade_max = 9,
    description = 'Lớp dữ liệu mẫu phục vụ kiểm thử development.', is_demo = true
WHERE code IS NULL;

ALTER TABLE classes ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX classes_tenant_code_unique ON classes(tenant_id, code);

ALTER TABLE class_schedules
  ADD COLUMN effective_from date,
  ADD COLUMN effective_to date,
  ADD COLUMN location_override text,
  ADD CONSTRAINT class_schedule_time_check CHECK (starts_at < ends_at),
  ADD CONSTRAINT class_schedule_date_check CHECK (effective_from IS NULL OR effective_to IS NULL OR effective_from <= effective_to);

UPDATE class_schedules s SET effective_from = c.starts_on, effective_to = c.ends_on FROM classes c WHERE c.id=s.class_id;

CREATE TABLE schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES class_schedules(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  type schedule_exception_type NOT NULL,
  starts_at time,
  ends_at time,
  location text,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_exception_time_check CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);
CREATE INDEX schedule_exceptions_class_date_idx ON schedule_exceptions(class_id, exception_date);

CREATE TABLE site_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  tagline text NOT NULL,
  teacher_name text NOT NULL,
  teacher_title text NOT NULL,
  teacher_organization text NOT NULL,
  teacher_short_bio text NOT NULL,
  teacher_long_bio text NOT NULL,
  contact_email text,
  contact_phone text,
  logo_asset_id uuid REFERENCES resources(id),
  portrait_asset_id uuid REFERENCES resources(id),
  seo_title text NOT NULL,
  seo_description text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_settings (
  tenant_id, brand_name, tagline, teacher_name, teacher_title, teacher_organization,
  teacher_short_bio, teacher_long_bio, seo_title, seo_description
)
SELECT id,
  'TEDUENGLISH',
  'Better English · Brighter Futures',
  'Lê Hữu Thanh Toàn',
  'Giáo viên giảng dạy môn Tiếng Anh và Tổ phó Tổ Tiếng Anh',
  'Trường THCS Lê Văn Tám, phường Bình Thạnh, TP.HCM',
  'Thầy Lê Hữu Thanh Toàn xây dựng môi trường học tiếng Anh có hệ thống, kết nối hoạt động trên lớp với việc tự học tại nhà.',
  'Thầy Lê Hữu Thanh Toàn hiện là giáo viên giảng dạy môn Tiếng Anh và giữ vai trò Tổ phó Tổ Tiếng Anh tại Trường THCS Lê Văn Tám, phường Bình Thạnh, TP.HCM.\n\nVới định hướng xây dựng một môi trường học tập có hệ thống, thầy mong muốn giúp học sinh tiếp cận tiếng Anh một cách rõ ràng, từng bước củng cố nền tảng kiến thức và phát triển sự tự tin trong quá trình học tập. Không gian học trực tuyến này được xây dựng để kết nối hoạt động giảng dạy trên lớp với việc tự học tại nhà, giúp học sinh dễ dàng theo dõi thời khóa biểu, truy cập tài liệu, hoàn thành bài tập và nhìn lại tiến độ của bản thân.\n\nThông qua sự kết hợp giữa phương pháp giảng dạy và công nghệ giáo dục, website hướng đến việc tạo ra một hành trình học tập thuận tiện, nhất quán và có sự đồng hành giữa giáo viên, học sinh và phụ huynh.',
  'TEDUENGLISH | Học tiếng Anh cùng thầy Lê Hữu Thanh Toàn',
  'TEDUENGLISH — không gian học tiếng Anh có lộ trình, có phản hồi cùng thầy Lê Hữu Thanh Toàn.'
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
