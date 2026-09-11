-- Guarantee the tenant is not left without an administrator after legacy role migration.
WITH first_mod AS (
  SELECT DISTINCT ON (tenant_id) id
  FROM users u
  WHERE role='MOD' AND deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM users a WHERE a.tenant_id=u.tenant_id AND a.role='ADMIN' AND a.deleted_at IS NULL)
  ORDER BY tenant_id,created_at
)
UPDATE users SET role='ADMIN' WHERE id IN (SELECT id FROM first_mod);

-- Existing learner groups also receive the personal task inbox.
INSERT INTO permission_group_menus(group_id,menu_key)
SELECT id,'portal.tasks' FROM permission_groups WHERE name='Học viên'
ON CONFLICT DO NOTHING;
