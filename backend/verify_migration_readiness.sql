-- FUTURE OPERATOR READ-ONLY CHECK, after all three migrations.
-- Catalog/data invariants only. Real Auth/JWT/RLS tests are still required.
BEGIN READ ONLY;
DO $$
DECLARE t TEXT; f TEXT; relation REGCLASS; column_number SMALLINT; invalid_count BIGINT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','admins'] LOOP
    relation := ('public.'||t)::regclass;
    SELECT attnum INTO column_number FROM pg_attribute WHERE attrelid=relation
      AND attname='auth_user_id' AND atttypid='uuid'::regtype AND NOT attisdropped;
    IF column_number IS NULL THEN RAISE EXCEPTION 'UUID Auth link missing: %',t; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=relation AND contype='u'
      AND conkey=ARRAY[column_number]) THEN RAISE EXCEPTION 'Unique Auth link missing: %',t; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid=relation AND c.contype='f'
      AND c.conkey=ARRAY[column_number] AND c.confrelid='auth.users'::regclass AND c.confdeltype='c'
      AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='auth.users'::regclass AND attname='id')]) THEN
      RAISE EXCEPTION 'Auth UUID FK/ON DELETE CASCADE missing: %',t; END IF;
  END LOOP;
  SELECT count(*) INTO invalid_count FROM public.users WHERE auth_user_id IS NOT NULL AND id<>auth_user_id;
  IF invalid_count<>0 THEN RAISE EXCEPTION 'Invalid linked profile UUIDs: %',invalid_count; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass
    AND conname='users_auth_identity_matches' AND contype='c') THEN RAISE EXCEPTION 'Identity check missing'; END IF;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.admins'::regclass
    AND attname='password_hash' AND attnotnull) THEN RAISE EXCEPTION 'Legacy admin password still required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
    AND tgname='ingly_auth_profile' AND tgenabled='O'
    AND tgfoid='ingly_private.create_auth_profile()'::regprocedure) THEN RAISE EXCEPTION 'Auth profile trigger missing/disabled'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
    AND tgname='ingly_auth_contact' AND tgenabled='O'
    AND tgfoid='ingly_private.sync_auth_contact()'::regprocedure) THEN RAISE EXCEPTION 'Auth contact trigger missing/disabled'; END IF;

  FOREACH t IN ARRAY ARRAY['learning_sync_accounts','learning_sync_entities','learning_sync_receipts',
    'learning_sync_versions','admin_course_catalog','admin_learning_days','admin_analytics_state','finance_ledger','finance_audit'] LOOP
    relation := ('public.'||t)::regclass;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=relation) THEN RAISE EXCEPTION 'RLS missing: %',t; END IF;
    IF has_table_privilege('anon',relation,'SELECT') OR has_table_privilege('authenticated',relation,'INSERT')
      OR has_table_privilege('authenticated',relation,'UPDATE') OR has_table_privilege('authenticated',relation,'DELETE')
      OR has_any_column_privilege('anon',relation,'SELECT')
      OR has_any_column_privilege('authenticated',relation,'INSERT')
      OR has_any_column_privilege('authenticated',relation,'UPDATE') THEN
      RAISE EXCEPTION 'Unexpected client write/anon grant: %',t; END IF;
    IF t NOT IN ('learning_sync_accounts','learning_sync_entities')
      AND has_any_column_privilege('authenticated',relation,'SELECT') THEN
      RAISE EXCEPTION 'Private table directly readable by client: %',t; END IF;
    IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t
      AND (t NOT LIKE 'learning_sync_%' OR policyname<>'own_learning_read')) THEN
      RAISE EXCEPTION 'Unexpected additive policy requires review: %',t; END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.read_learning_sync(bigint)','public.sync_learning_operations(jsonb)',
    'public.admin_dashboard_snapshot()','public.admin_configuration_snapshot()','public.admin_update_configuration(jsonb)',
    'public.admin_create_finance_entry(jsonb)','public.admin_void_finance_entry(uuid,text)',
    'public.admin_finance_snapshot(text,text,text,timestamp with time zone,uuid,integer)'] LOOP
    IF has_function_privilege('anon',f,'EXECUTE') OR NOT has_function_privilege('authenticated',f,'EXECUTE') THEN
      RAISE EXCEPTION 'Incorrect client RPC grants: %',f; END IF;
  END LOOP;
  IF has_function_privilege('anon','public.record_verified_finance_purchase(jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.record_verified_finance_purchase(jsonb)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.record_verified_finance_purchase(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Verified purchase RPC must remain service-only'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.learning_sync_receipts'::regclass
    AND tgname='admin_learning_day_receipt' AND tgenabled='O'
    AND tgfoid='ingly_private.track_admin_learning_day()'::regprocedure) THEN
    RAISE EXCEPTION 'Admin activity receipt trigger missing/disabled'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','ingly_private') AND p.prosecdef
      AND (p.proconfig IS NULL OR NOT ('search_path=""'=ANY(p.proconfig)))) THEN
    RAISE EXCEPTION 'Unexpected/unsafe SECURITY DEFINER requires operator review'; END IF;
END $$;
-- Migrations intentionally do not link legacy rows or fabricate historical activity.
SELECT conname,convalidated,pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.users'::regclass AND conname='users_auth_identity_matches';
SELECT count(*) AS missing_auth_profiles FROM auth.users a WHERE NOT EXISTS
  (SELECT 1 FROM public.users u WHERE u.id=a.id AND u.auth_user_id=a.id);
SELECT count(*) AS orphan_admin_authorizations FROM public.admins a WHERE a.auth_user_id IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=a.auth_user_id AND u.auth_user_id=a.auth_user_id);
SELECT count(*) AS catalog_count,count(DISTINCT book) AS books,count(DISTINCT (book,unit)) AS units
FROM public.admin_course_catalog;
ROLLBACK;
