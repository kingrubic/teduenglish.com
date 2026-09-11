UPDATE site_settings
SET teacher_long_bio = replace(teacher_long_bio, E'\\n', E'\n'), updated_at = now()
WHERE teacher_long_bio LIKE '%\n%';
