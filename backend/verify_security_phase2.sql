-- Read-only deployed verification. Run as the project database operator AFTER migration.
-- This checks catalogs, not real JWT/RLS request behavior. Follow the staging matrix in docs.
BEGIN READ ONLY;
DO $$
DECLARE t TEXT; f TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','admins','admin_audit_logs','user_progress','user_streaks','app_settings','books','units','words'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'RLS missing: %',t;
    END IF;
  END LOOP;
  IF has_column_privilege('anon','public.users','phone','SELECT')
    OR has_column_privilege('authenticated','public.users','password_hash','SELECT')
    OR has_column_privilege('authenticated','public.admins','password_hash','SELECT')
    OR has_column_privilege('authenticated','public.users','is_premium','UPDATE')
    OR has_column_privilege('authenticated','public.users','is_blocked','UPDATE')
    OR has_column_privilege('authenticated','public.users','auth_user_id','UPDATE')
    OR has_table_privilege('authenticated','public.users','INSERT')
    OR has_table_privilege('authenticated','public.admins','INSERT')
    OR has_table_privilege('authenticated','public.admins','UPDATE')
    OR has_table_privilege('authenticated','public.admin_audit_logs','INSERT') THEN
    RAISE EXCEPTION 'Private/privileged column or table grant survived';
  END IF;
  FOREACH f IN ARRAY ARRAY['public.record_user_activity(integer)','public.sync_user_offline_progress(jsonb)','public.get_my_admin_access()'] LOOP
    IF has_function_privilege('anon',f,'EXECUTE') OR NOT has_function_privilege('authenticated',f,'EXECUTE') THEN
      RAISE EXCEPTION 'Incorrect effective RPC grants (including inherited PUBLIC grants): %',f;
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.verify_user_credentials(text,text)','public.set_user_password_secure(uuid,text,text)',
    'public.get_safe_user_status(text)','public.record_user_activity(uuid,integer)','public.sync_user_offline_progress(uuid,jsonb)'] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN RAISE EXCEPTION 'Legacy RPC still exists: %',f; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='ingly_private' AND p.prosecdef AND
      (p.proconfig IS NULL OR NOT ('search_path=""'=ANY(p.proconfig)))) THEN
    RAISE EXCEPTION 'Unsafe private SECURITY DEFINER search_path';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public'
    AND tablename IN ('users','admins','admin_audit_logs','user_progress','user_streaks','app_settings')) THEN
    RAISE EXCEPTION 'Private/mixed rows still published to Realtime';
  END IF;
END $$;

-- Inventory EVERY deployed privileged function, including functions outside this repository.
-- Unexpected rows require review; no unknown function is assumed safe automatically.
SELECT n.nspname AS schema_name,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
  p.proconfig AS function_settings,has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_exec,
  (SELECT string_agg(CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,',')
    FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.privilege_type='EXECUTE') AS execute_grantees
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prosecdef AND n.nspname IN ('public','ingly_private') ORDER BY n.nspname,p.proname;

SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT relname,reloptions FROM pg_class WHERE oid='public.v_user_stats'::regclass;
SELECT conname,convalidated,pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid IN ('public.users'::regclass,'public.admins'::regclass) AND (conname LIKE '%auth%' OR contype='f');
ROLLBACK;
