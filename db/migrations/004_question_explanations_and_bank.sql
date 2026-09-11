ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation text;

CREATE TABLE IF NOT EXISTS question_bank_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  created_by uuid NOT NULL REFERENCES users(id),
  type text NOT NULL CHECK (type IN ('SINGLE_CHOICE','TRUE_FALSE','SHORT_ANSWER')),
  prompt text NOT NULL,
  options jsonb,
  correct_answer jsonb,
  explanation text,
  points numeric(7,2) NOT NULL DEFAULT 1 CHECK (points > 0),
  tags text[] NOT NULL DEFAULT '{}',
  source_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_question_bank_tenant_created
  ON question_bank_items(tenant_id, created_at DESC)
  WHERE archived_at IS NULL;

UPDATE questions
SET explanation = CASE
  WHEN prompt = 'I ___ breakfast at 7 a.m. every day.' THEN 'Với chủ ngữ “I” ở thì hiện tại đơn, động từ giữ nguyên mẫu: “I have breakfast”.'
  WHEN prompt = '“She goes to school” is grammatically correct.' THEN 'Chủ ngữ ngôi thứ ba số ít “She” dùng động từ thêm -es: “goes”.'
  ELSE explanation
END
WHERE explanation IS NULL;
