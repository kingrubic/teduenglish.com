CREATE TYPE learning_track_status AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE learning_unit_type AS ENUM ('LESSON','PRACTICE','MOCK_TEST','RESOURCE');

CREATE TABLE learning_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  target text NOT NULL DEFAULT '',
  status learning_track_status NOT NULL DEFAULT 'DRAFT',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE learning_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES learning_tracks(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  skill text NOT NULL,
  summary text NOT NULL DEFAULT '',
  accent text NOT NULL DEFAULT 'earth',
  position integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  UNIQUE (track_id, slug)
);

CREATE TABLE learning_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  unit_type learning_unit_type NOT NULL DEFAULT 'LESSON',
  estimated_minutes integer CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
  content jsonb NOT NULL DEFAULT '{}',
  position integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  UNIQUE (module_id, slug)
);

CREATE TABLE student_unit_progress (
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES learning_units(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED')),
  score numeric(7,2),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, unit_id)
);

CREATE INDEX learning_tracks_tenant_status_idx ON learning_tracks(tenant_id,status,position);
CREATE INDEX learning_modules_track_position_idx ON learning_modules(track_id,position);
CREATE INDEX learning_units_module_position_idx ON learning_units(module_id,position);

WITH track AS (
  INSERT INTO learning_tracks (tenant_id,slug,title,summary,target,status,position)
  SELECT id,'ielts','Luyện thi IELTS','Lộ trình luyện thi theo bốn kỹ năng, có chẩn đoán đầu vào, luyện tập theo dạng bài và thi thử định kỳ.','Xây nền tảng và tiến tới band mục tiêu','PUBLISHED',20
  FROM tenants
  ON CONFLICT (tenant_id,slug) DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,target=EXCLUDED.target,status='PUBLISHED'
  RETURNING id
)
INSERT INTO learning_modules (track_id,slug,title,skill,summary,accent,position,is_published)
SELECT id,x.slug,x.title,x.skill,x.summary,x.accent,x.position,true FROM track CROSS JOIN (VALUES
  ('listening','IELTS Listening','Listening','Luyện nghe theo section, nhận diện bẫy và kiểm soát chính tả.','blue',10),
  ('reading','IELTS Reading','Reading','Đọc chiến lược theo dạng câu hỏi, quản trị thời gian và bằng chứng.','green',20),
  ('writing','IELTS Writing','Writing','Phát triển Task 1, Task 2 theo tiêu chí chấm điểm IELTS.','orange',30),
  ('speaking','IELTS Speaking','Speaking','Rèn phản xạ, độ trôi chảy và cách phát triển câu trả lời tự nhiên.','purple',40),
  ('mock-test','Thi thử & phân tích','Mock test','Thi thử theo chặng và biến kết quả thành kế hoạch cải thiện.','dark',50)
) AS x(slug,title,skill,summary,accent,position)
ON CONFLICT (track_id,slug) DO NOTHING;
