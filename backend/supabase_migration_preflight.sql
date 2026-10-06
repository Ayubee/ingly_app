-- PREPARATION ONLY. Not a migration; never included in an automatic deploy.
-- Trusted operator read-only inventory for an EXISTING Ingly/Supabase database.
-- No contacts, passwords, tokens or credential hashes are returned.
-- Output requires human review; passing this is NOT production approval.
BEGIN READ ONLY;
-- Display connection evidence for operator review, NOT proof of Supabase project
-- identity. A database named postgres/pooler IP does not identify the project.
-- Confirm the staging Dashboard/project ref and pinned TLS connection first.
SELECT current_database() AS database_name,session_user AS connected_role,current_user AS effective_role,
  inet_server_addr() AS server_address,inet_server_port() AS server_port;
DO $$
DECLARE t TEXT; requirement RECORD;
BEGIN
  IF current_setting('server_version_num')::INT < 150000 THEN
    RAISE EXCEPTION 'PostgreSQL 15+ required (security_invoker view)'; END IF;
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL
    OR to_regprocedure('auth.role()') IS NULL THEN RAISE EXCEPTION 'Supabase Auth baseline missing'; END IF;
  FOREACH t IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=t) THEN RAISE EXCEPTION 'Supabase role missing: %',t; END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['users','admins','admin_audit_logs','user_progress','user_streaks','app_settings','books','units','words'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relkind='r') THEN
      RAISE EXCEPTION 'Expected baseline table missing or incompatible: %',t; END IF;
  END LOOP;
  FOR requirement IN SELECT * FROM (VALUES
    ('users','id','uuid'),('users','username','varchar'),('users','full_name','varchar'),
    ('users','phone','varchar'),('users','email','varchar'),('users','password_hash','varchar'),
    ('users','avatar_url','text'),('users','daily_goal','int4'),('users','is_blocked','bool'),
    ('users','is_premium','bool'),('users','premium_until','timestamptz'),
    ('users','created_at','timestamptz'),('users','updated_at','timestamptz'),
    ('admins','id','uuid'),('admins','username','varchar'),('admins','full_name','varchar'),
    ('admins','email','varchar'),('admins','password_hash','varchar'),('admins','role','varchar'),
    ('admins','permissions','jsonb'),('admins','is_active','bool'),
    ('admins','created_at','timestamptz'),('admins','updated_at','timestamptz'),
    ('admin_audit_logs','admin_id','uuid'),('admin_audit_logs','admin_username','varchar'),
    ('admin_audit_logs','action','varchar'),('admin_audit_logs','target_type','varchar'),
    ('admin_audit_logs','target_id','varchar'),('admin_audit_logs','details','jsonb'),
    ('user_progress','user_id','uuid'),('user_progress','word_id','int4'),
    ('user_progress','status','varchar'),('user_progress','review_count','int4'),
    ('user_progress','next_review_date','timestamptz'),('user_progress','last_reviewed_at','timestamptz'),
    ('user_progress','is_favorite','bool'),('user_progress','updated_at','timestamptz'),
    ('user_streaks','user_id','uuid'),('user_streaks','current_streak','int4'),
    ('user_streaks','max_streak','int4'),('user_streaks','last_activity_date','date'),
    ('user_streaks','words_learned_today','int4'),('books','id','int4'),
    ('units','id','int4'),('words','id','int4'),('app_settings','setting_key','varchar'),
    ('app_settings','setting_value','jsonb')
  ) AS expected(table_name,column_name,type_name) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute a
      WHERE a.attrelid=to_regclass('public.'||requirement.table_name)
        AND a.attname=requirement.column_name AND NOT a.attisdropped
        AND a.atttypid=to_regtype(requirement.type_name)) THEN
      RAISE EXCEPTION 'Baseline column missing/incompatible: %.% (expected %)',
        requirement.table_name,requirement.column_name,requirement.type_name;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.users'::regclass
    AND attname='password_hash' AND attnotnull) THEN
    RAISE EXCEPTION 'Legacy users.password_hash NOT NULL would block Auth profile creation; review separately'; END IF;
  FOREACH t IN ARRAY ARRAY['books_id_seq','units_id_seq','words_id_seq'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'Required sequence missing: %',t; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.v_user_stats') AND relkind='v')
    OR to_regprocedure('public.trigger_set_timestamp()') IS NULL THEN
    RAISE EXCEPTION 'Baseline statistics view/timestamp trigger function missing'; END IF;
END $$;

SELECT count(*) AS auth_user_count FROM auth.users;
SELECT count(*) AS application_user_count FROM public.users;
SELECT count(*) AS legacy_admin_count FROM public.admins;
-- Duplicate groups, without revealing contact values. Case folding is deliberate:
-- Auth contacts/trigger usernames can conflict with older case-sensitive data.
SELECT 'users.username' AS field,count(*) AS case_folded_duplicate_groups FROM
  (SELECT lower(username) FROM public.users GROUP BY lower(username) HAVING count(*)>1) d
UNION ALL SELECT 'users.email',count(*) FROM
  (SELECT lower(email) FROM public.users WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*)>1) d
UNION ALL SELECT 'admins.username',count(*) FROM
  (SELECT lower(username) FROM public.admins GROUP BY lower(username) HAVING count(*)>1) d
UNION ALL SELECT 'admins.email',count(*) FROM
  (SELECT lower(email) FROM public.admins WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*)>1) d;

-- Review every constraint/default/type; IF NOT EXISTS does not repair schema drift.
SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns WHERE table_schema='public'
  AND table_name IN ('users','admins','user_progress','user_streaks') ORDER BY table_name,ordinal_position;
SELECT c.conrelid::regclass AS relation,c.conname,c.convalidated,pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c WHERE c.conrelid IN ('public.users'::regclass,'public.admins'::regclass,
  'public.user_progress'::regclass,'public.user_streaks'::regclass) ORDER BY c.conrelid::regclass::TEXT,c.conname;
-- JSON projection works BEFORE auth_user_id exists, without modifying any rows.
SELECT count(*) FILTER(WHERE to_jsonb(u)->>'auth_user_id' IS NULL) AS unlinked_users,
  count(*) FILTER(WHERE to_jsonb(u)->>'auth_user_id' IS NOT NULL
    AND to_jsonb(u)->>'auth_user_id'<>u.id::TEXT) AS mismatched_profile_ids FROM public.users u;
SELECT a.id AS legacy_admin_row_id,a.role,a.is_active,
  to_jsonb(a)->>'auth_user_id' AS linked_auth_uuid FROM public.admins a ORDER BY a.id;

SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef,p.proconfig,
  pg_get_userbyid(p.proowner) AS owner,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','ingly_private') ORDER BY n.nspname,p.proname,arguments;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT event_object_schema,event_object_table,trigger_name,action_statement
FROM information_schema.triggers WHERE event_object_schema IN ('public','auth') ORDER BY trigger_name;
SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.table_privileges
WHERE table_schema='public' AND grantee IN ('PUBLIC','anon','authenticated') ORDER BY table_name,grantee;
SELECT table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges
WHERE table_schema='public' AND grantee IN ('PUBLIC','anon','authenticated') ORDER BY table_name,column_name;
SELECT pubname,schemaname,tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';
SELECT n.nspname,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('learning_sync_accounts','learning_sync_entities',
  'learning_sync_receipts','learning_sync_versions','admin_course_catalog','admin_learning_days',
  'admin_analytics_state','finance_ledger','finance_audit') ORDER BY c.relname;
ROLLBACK;
