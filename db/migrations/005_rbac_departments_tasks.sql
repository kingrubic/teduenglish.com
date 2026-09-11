-- Unified CMS RBAC: ADMIN / MOD / USER. Rebuild the enum transaction-safely.
CREATE TYPE user_role_v2 AS ENUM ('ADMIN','MOD','USER');
ALTER TABLE users ALTER COLUMN role TYPE user_role_v2 USING (
  CASE role::text WHEN 'TEACHER' THEN 'MOD' WHEN 'STUDENT' THEN 'USER' ELSE role::text END
)::user_role_v2;
DROP TYPE user_role;
ALTER TYPE user_role_v2 RENAME TO user_role;

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,name)
);

ALTER TABLE users ADD COLUMN department_id uuid REFERENCES departments(id);

CREATE TABLE permission_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,name)
);

CREATE TABLE permission_group_menus (
  group_id uuid NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  menu_key text NOT NULL,
  PRIMARY KEY(group_id,menu_key)
);

CREATE TABLE user_permission_groups (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,group_id)
);

CREATE TABLE work_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  status text NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO','IN_PROGRESS','DONE','CANCELLED')),
  due_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  assigned_to uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX departments_tenant_idx ON departments(tenant_id,status);
CREATE INDEX permission_groups_tenant_idx ON permission_groups(tenant_id,status);
CREATE INDEX user_permission_groups_user_idx ON user_permission_groups(user_id);
CREATE INDEX work_tasks_assignee_idx ON work_tasks(tenant_id,assigned_to,status,due_at);

-- Existing learners keep the learning portal after the role migration.
INSERT INTO permission_groups(tenant_id,name,description)
SELECT id,'Học viên','Quyền mặc định cho người học' FROM tenants
ON CONFLICT(tenant_id,name) DO NOTHING;

INSERT INTO permission_group_menus(group_id,menu_key)
SELECT g.id,k FROM permission_groups g
CROSS JOIN unnest(ARRAY['portal.dashboard','portal.classes','portal.ielts','portal.resources','portal.assignments','portal.tasks']) AS k
WHERE g.name='Học viên'
ON CONFLICT DO NOTHING;

INSERT INTO user_permission_groups(user_id,group_id)
SELECT u.id,g.id FROM users u JOIN permission_groups g ON g.tenant_id=u.tenant_id AND g.name='Học viên'
WHERE u.role='USER'
ON CONFLICT DO NOTHING;
