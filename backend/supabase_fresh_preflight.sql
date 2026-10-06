-- Future trusted-operator inventory BEFORE the first schema on a FRESH staging project.
-- READ ONLY, no user contacts, credentials, passwords or application row values.
-- Dashboard/project + TLS connection must be reviewed separately. SQL cannot prove project identity.
BEGIN READ ONLY;
SELECT current_database() AS database_name,session_user AS connected_role,current_user AS effective_role,
  inet_server_addr() AS server_address,inet_server_port() AS server_port;
SELECT nspname AS schema_name FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' ORDER BY nspname;
SELECT n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','ingly_private','supabase_migrations') ORDER BY n.nspname,c.relname;
SELECT table_schema,table_name,column_name,data_type,is_nullable
FROM information_schema.columns WHERE table_schema IN ('public','ingly_private','supabase_migrations')
ORDER BY table_schema,table_name,ordinal_position;
SELECT n.nspname,c.conrelid::regclass AS relation,c.conname,c.convalidated,pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
WHERE n.nspname IN ('public','ingly_private') ORDER BY n.nspname,c.conname;
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef,p.proconfig,
  pg_get_userbyid(p.proowner) AS owner,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','ingly_private') ORDER BY n.nspname,p.proname,arguments;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname IN ('public','ingly_private','storage') ORDER BY schemaname,tablename,policyname;
SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.table_privileges
WHERE table_schema IN ('public','ingly_private') ORDER BY table_schema,table_name,grantee;
SELECT table_schema,table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges
WHERE table_schema IN ('public','ingly_private') ORDER BY table_schema,table_name,column_name,grantee;
SELECT n.nspname,n.nspacl FROM pg_namespace n WHERE n.nspname IN ('public','ingly_private');
SELECT defaclrole::regrole AS owner,defaclnamespace::regnamespace AS schema_name,defaclobjtype,defaclacl
FROM pg_default_acl ORDER BY defaclrole,defaclnamespace,defaclobjtype;
SELECT event_object_schema,event_object_table,trigger_name,action_statement FROM information_schema.triggers
WHERE event_object_schema IN ('public','auth','storage') ORDER BY event_object_schema,trigger_name;
SELECT pubname,schemaname,tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';
DO $$
DECLARE t TEXT;
BEGIN
  IF current_setting('server_version_num')::INT < 150000 THEN RAISE EXCEPTION 'PostgreSQL 15+ required'; END IF;
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL
    OR to_regprocedure('auth.role()') IS NULL THEN RAISE EXCEPTION 'Supabase Auth baseline missing'; END IF;
  FOREACH t IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=t) THEN RAISE EXCEPTION 'Supabase role missing: %',t; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM auth.users) THEN RAISE EXCEPTION 'Auth identities already exist; fresh baseline is forbidden; review existing state and recovery'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','ingly_private') AND c.relkind IN ('r','p','v','m','S','f')
    AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass
      AND d.objid=c.oid AND d.deptype='e'))
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN ('public','ingly_private')
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass
        AND d.objid=p.oid AND d.deptype='e')) THEN
    RAISE EXCEPTION 'Non-extension application objects found; do not apply fresh schema; review existing baseline and recoverable backup';
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM storage.objects) THEN RAISE EXCEPTION 'Stored files exist; fresh recovery assumption invalid'; END IF;
  END IF;
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM storage.buckets) THEN RAISE EXCEPTION 'Storage buckets exist; review setup/recovery before choosing baseline'; END IF;
  END IF;
END $$;
SELECT count(*) AS auth_user_count FROM auth.users;
-- Existing migration-history tables above require manual review; no assumed history format.
-- A successful inventory is NOT permission to run schema.sql or any migration.
ROLLBACK;
