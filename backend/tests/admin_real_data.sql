-- MANUAL STAGING ONLY. Not run by local Node tests or automatically deployed.
-- Requires Phase 2, Phase 3, admin-real-data migration and a database owner.
-- Synthetic fixtures are transaction-local and ROLLED BACK. Never run in production.
BEGIN;
DO $$
DECLARE admin_id UUID := gen_random_uuid(); learner UUID := gen_random_uuid();
  older UUID := gen_random_uuid(); manual_id UUID := gen_random_uuid(); expense_id UUID := gen_random_uuid();
  reference_prefix TEXT := 'admin-test-'||gen_random_uuid(); today DATE := (now() AT TIME ZONE 'Asia/Tashkent')::DATE;
  before_stats JSONB; after_stats JSONB; before_finance JSONB; result JSONB; op JSONB; entry JSONB; provider JSONB;
BEGIN
  -- Auth trigger, not a browser profile insert, establishes fixture identities.
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(admin_id,admin_id||'@example.invalid',jsonb_build_object('username','test_'||replace(admin_id::TEXT,'-','')));
  INSERT INTO public.admins(auth_user_id,username,full_name,role,permissions)
    VALUES(admin_id,'test_'||replace(admin_id::TEXT,'-',''),'Staging test','super_admin','[]');
  PERFORM set_config('request.jwt.claim.sub',admin_id::TEXT,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  before_stats := public.admin_dashboard_snapshot();
  before_finance := public.admin_finance_snapshot();
  INSERT INTO auth.users(id,email,created_at,raw_user_meta_data)
    VALUES(learner,learner||'@example.invalid',now(),jsonb_build_object('username','test_'||replace(learner::TEXT,'-',''))),
      (older,older||'@example.invalid',(today-8)::TIMESTAMP AT TIME ZONE 'Asia/Tashkent',jsonb_build_object('username','test_'||replace(older::TEXT,'-','')));
  PERFORM set_config('request.jwt.claim.sub',learner::TEXT,true);
  op := jsonb_build_object('id','stagingdevice:1','owner',learner,'device','stagingdevice','sequence',1,'epoch','initial','action','patch',
    'changes',jsonb_build_object('word:1',jsonb_build_object('status','mastered','completed',true,'review_count',1),
      'word:2',jsonb_build_object('status','mastered','completed',true,'review_count',1),
      'custom:test',jsonb_build_object('word','private custom','status','mastered'),
      'learning',jsonb_build_object('streakDays',1,'lastActiveDate',today,'totalWordsLearned',999999)));
  PERFORM public.sync_learning_operations(jsonb_build_array(op));
  PERFORM public.sync_learning_operations(jsonb_build_array(op));
  PERFORM set_config('request.jwt.claim.sub',admin_id::TEXT,true);
  after_stats := public.admin_dashboard_snapshot();
  ASSERT (after_stats->>'total_users')::BIGINT=(before_stats->>'total_users')::BIGINT+2,'Auth/profile count; admins excluded';
  ASSERT (after_stats->>'dau')::BIGINT=(before_stats->>'dau')::BIGINT+1,'DAU unique receipt day, duplicate replay excluded';
  ASSERT (after_stats->>'mastered_words')::BIGINT=(before_stats->>'mastered_words')::BIGINT+2,'Unique textbook pairs; custom and aggregate inflation excluded';
  ASSERT (after_stats->>'active_streak_users')::BIGINT=(before_stats->>'active_streak_users')::BIGINT+1,'Active persisted streak';
  ASSERT (after_stats->>'current_week_new_users')::BIGINT=(before_stats->>'current_week_new_users')::BIGINT+1,'Current calendar registration window';
  ASSERT (after_stats->>'previous_week_new_users')::BIGINT=(before_stats->>'previous_week_new_users')::BIGINT+1,'Previous calendar registration window';
  ASSERT (after_stats->>'weekly_growth_pct')::NUMERIC=round(((after_stats->>'current_week_new_users')::NUMERIC-(after_stats->>'previous_week_new_users')::NUMERIC)*100/(after_stats->>'previous_week_new_users')::NUMERIC,1),'Growth formula';
  ASSERT jsonb_array_length(after_stats->'books')=6,'Six bundled books';
  ASSERT (SELECT sum((value->>'word_count')::INT) FROM jsonb_array_elements(after_stats->'books'))=3600,'Canonical word catalog';
  ASSERT (SELECT sum((value->>'unit_count')::INT) FROM jsonb_array_elements(after_stats->'books'))=180,'Canonical units';
  result := public.admin_update_configuration('{"free_book_ids":[1,3]}');
  ASSERT result->'config'->'free_books_count'='1'::JSONB,'Non-contiguous free books do not unlock Book 2';
  entry := jsonb_build_object('request_id',manual_id,'reference',reference_prefix||'-income','type','income','amount',100,'currency','UZS',
    'category','other','title',reference_prefix,'description','','payment_method','cash','occurred_at',now(),'environment','production');
  PERFORM public.admin_create_finance_entry(entry);
  PERFORM public.admin_create_finance_entry(entry);
  BEGIN PERFORM public.admin_create_finance_entry(entry||jsonb_build_object('amount',101));
    RAISE EXCEPTION 'Expected ID reuse rejection'; EXCEPTION WHEN unique_violation THEN NULL; END;
  PERFORM public.admin_create_finance_entry(entry||jsonb_build_object('request_id',expense_id,'reference',reference_prefix||'-expense','type','expense','amount',30,'category','hosting'));
  PERFORM public.admin_create_finance_entry(entry||jsonb_build_object('request_id',gen_random_uuid(),'reference',reference_prefix||'-mock','amount',9999,'environment','mock'));
  provider := jsonb_build_object('reference',reference_prefix||'-purchase','type','income','amount',200,'currency','UZS',
    'category','book','book',2,'title',reference_prefix,'description','','payment_method','click','occurred_at',now(),
    'environment','production','related_user_id',learner,'status','completed');
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM public.record_verified_finance_purchase(provider);
  PERFORM public.record_verified_finance_purchase(provider);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  -- Unsuccessful trusted rows are fixtures, not real provider integration.
  INSERT INTO public.finance_ledger(type,amount,category,title,payment_method,reference,occurred_at,status,recorded_status,environment,source)
    SELECT 'income',9000,'other',reference_prefix,'other',reference_prefix||'-'||state,now(),state,state,'production','manual'
      FROM unnest(ARRAY['pending','failed','cancelled']) state;
  result := public.admin_finance_snapshot();
  ASSERT (result->>'income')::NUMERIC=(before_finance->>'income')::NUMERIC+300,'Production completed income; duplicate/mock/failed excluded';
  ASSERT (result->>'expenses')::NUMERIC=(before_finance->>'expenses')::NUMERIC+30,'Completed expenses';
  ASSERT (result->>'net_profit')::NUMERIC=(before_finance->>'net_profit')::NUMERIC+270,'Net profit';
  ASSERT (result->>'purchase_count')::BIGINT=(before_finance->>'purchase_count')::BIGINT+1,'Only verified purchase, never manual income or expenses';
  result := public.admin_finance_snapshot('production','expense',reference_prefix);
  ASSERT jsonb_array_length(result->'rows')=1 AND result->>'income'=((before_finance->>'income')::NUMERIC+300)::TEXT,'Filter/search do not change totals';
  ASSERT NOT ((result->'rows'->0) ?| ARRAY['related_user_id','created_by','password','access_token','card_number','cvv']),'No unrelated PII or secrets';
  PERFORM public.admin_void_finance_entry(manual_id,'Staging correction');
  PERFORM public.admin_void_finance_entry(manual_id,'Staging correction');
  result := public.admin_finance_snapshot();
  ASSERT (result->>'income')::NUMERIC=(before_finance->>'income')::NUMERIC+200,'Void excluded, row retained';
  ASSERT (SELECT count(*) FROM public.finance_audit WHERE ledger_id=manual_id)=2,'Create and exactly one void audit';
  ASSERT NOT has_table_privilege('authenticated','public.finance_ledger','SELECT'),'No direct client ledger reads';
  ASSERT NOT has_function_privilege('authenticated','public.record_verified_finance_purchase(jsonb)','EXECUTE'),'Provider writes service-only';
  ASSERT NOT has_function_privilege('anon','public.admin_dashboard_snapshot()','EXECUTE'),'No anonymous analytics';
  PERFORM set_config('request.jwt.claim.sub',learner::TEXT,true);
  BEGIN PERFORM public.admin_dashboard_snapshot(); RAISE EXCEPTION 'Expected analytics denial'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.admin_finance_snapshot(); RAISE EXCEPTION 'Expected finance denial'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.admin_create_finance_entry(entry); RAISE EXCEPTION 'Expected finance write denial'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.admin_update_configuration('{"premium_mode_enabled":false}'); RAISE EXCEPTION 'Expected config denial'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.record_verified_finance_purchase(provider); RAISE EXCEPTION 'Expected provider denial'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'Admin real-data staging integration assertions passed (rollback follows).';
END $$;
ROLLBACK;
