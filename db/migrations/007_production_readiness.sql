ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'PRACTICE' CHECK (mode IN ('PRACTICE','EXAM')),
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS shuffle_questions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shuffle_options boolean NOT NULL DEFAULT false;

UPDATE assignments SET published_at=created_at WHERE status='PUBLISHED' AND published_at IS NULL;

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS original_name text,
  ADD COLUMN IF NOT EXISTS byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  ADD COLUMN IF NOT EXISTS storage_key text;

CREATE TABLE IF NOT EXISTS login_attempts (
  id bigserial PRIMARY KEY,
  email_hash text NOT NULL,
  ip_hash text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_lookup_idx ON login_attempts(email_hash,ip_hash,attempted_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS resources_storage_idx ON resources(storage_key) WHERE storage_key IS NOT NULL;
