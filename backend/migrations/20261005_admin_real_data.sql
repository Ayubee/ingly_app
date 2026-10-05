-- Admin Dashboard + Finance. Apply AFTER Security Phase 2 and Repair Phase 3.
-- Local preparation only: no deployment, historical finance import or fake data.
BEGIN;

-- Catalog verified against mobile/src/data/all_words.json (3600 contiguous IDs).
-- This is content metadata, not a fabricated learning/finance population.
CREATE TABLE public.admin_course_catalog (
  word_id BIGINT PRIMARY KEY, book INT NOT NULL, unit INT NOT NULL,
  title TEXT NOT NULL
);
INSERT INTO public.admin_course_catalog(word_id,book,unit,title)
SELECT n, (n-1)/600+1, ((n-1)%600)/20+1,
  (ARRAY['Book 1 - Elementary','Book 2 - Pre-Intermediate','Book 3 - Intermediate',
    'Book 4 - Upper-Intermediate','Book 5 - Advanced','Book 6 - Mastery'])[(n-1)/600+1]
FROM generate_series(1,3600) n;

CREATE TABLE public.admin_learning_days (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_day DATE NOT NULL, first_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,activity_day)
);
CREATE INDEX admin_learning_days_day ON public.admin_learning_days(activity_day);
CREATE TABLE public.admin_analytics_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK(singleton),
  activity_tracking_started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.admin_analytics_state(singleton) VALUES(true);

CREATE TABLE public.finance_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK(type IN ('income','expense')),
  amount BIGINT NOT NULL CHECK(amount > 0 AND amount <= 1000000000000),
  currency TEXT NOT NULL DEFAULT 'UZS' CHECK(currency='UZS'),
  category TEXT NOT NULL CHECK(category IN ('vip','book','hosting','sms','marketing','other')),
  title TEXT NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=1000),
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  book INT CHECK(book BETWEEN 1 AND 6),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','bank_transfer','click','payme','other')),
  reference TEXT NOT NULL CHECK(length(reference) BETWEEN 1 AND 200),
  occurred_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('completed','pending','failed','cancelled','voided')),
  environment TEXT NOT NULL CHECK(environment IN ('production','test','mock')),
  source TEXT NOT NULL CHECK(source IN ('manual','verified_provider')),
  is_purchase BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ, voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason TEXT CHECK(length(void_reason) BETWEEN 1 AND 500),
  CHECK(NOT is_purchase OR (source='verified_provider' AND type='income' AND category IN ('vip','book'))),
  CHECK((status='voided') = (voided_at IS NOT NULL AND void_reason IS NOT NULL)),
  UNIQUE(source,environment,reference)
);
CREATE INDEX finance_ledger_date ON public.finance_ledger(environment,occurred_at DESC,id DESC);
CREATE TABLE public.finance_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ledger_id UUID NOT NULL REFERENCES public.finance_ledger(id),
  action TEXT NOT NULL CHECK(action IN ('create','void')),
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), details JSONB NOT NULL
);

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['admin_course_catalog','admin_learning_days','admin_analytics_state','finance_ledger','finance_audit'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public.finance_audit_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.finance_audit_id_seq TO service_role;
-- No direct client grants or policies: only explicitly authorized aggregate/RPC access.

CREATE FUNCTION ingly_private.track_admin_learning_day()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE day DATE; current_day DATE := (now() AT TIME ZONE 'Asia/Tashkent')::DATE;
BEGIN
  IF NEW.operation->>'action' IS DISTINCT FROM 'patch' THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_each(NEW.operation->'changes') c
      WHERE c.key='learning' OR (c.key LIKE 'word:%' AND c.value->>'status' IN ('mastered','review','hard'))) THEN RETURN NEW; END IF;
  -- Only newly committed receipts. Never invent/backfill historical days.
  -- Dates are account-owned, client-reported learning snapshots, not anti-cheat events.
  BEGIN day := (NEW.operation->'changes'->'learning'->>'lastActiveDate')::DATE;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN NEW; END;
  IF day IS NOT NULL AND day<=current_day THEN
    INSERT INTO public.admin_learning_days(user_id,activity_day) VALUES(NEW.user_id,day) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ingly_private.track_admin_learning_day() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER admin_learning_day_receipt AFTER INSERT ON public.learning_sync_receipts
  FOR EACH ROW EXECUTE FUNCTION ingly_private.track_admin_learning_day();

CREATE FUNCTION public.admin_dashboard_snapshot()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result JSONB; today DATE := (now() AT TIME ZONE 'Asia/Tashkent')::DATE;
BEGIN
  IF auth.uid() IS NULL OR NOT ingly_private.has_permission('view_stats') THEN
    RAISE EXCEPTION 'Analytics authorization required' USING ERRCODE='42501'; END IF;
  WITH population AS (
    SELECT u.id,a.created_at FROM public.users u JOIN auth.users a ON a.id=u.auth_user_id AND u.id=a.id
    WHERE NOT EXISTS(SELECT 1 FROM public.admins ad WHERE ad.auth_user_id=a.id)
  ), completed AS (
    SELECT e.user_id,c.word_id,c.book FROM public.learning_sync_entities e
    JOIN public.admin_course_catalog c ON e.entity_key='word:'||c.word_id
    JOIN population p ON p.id=e.user_id
    WHERE e.payload->>'completed'='true' OR e.payload->>'status'='mastered'
    UNION
    SELECT w.user_id,c.word_id,c.book FROM public.user_progress w
    JOIN public.admin_course_catalog c ON c.word_id=w.word_id JOIN population p ON p.id=w.user_id
    WHERE w.status='mastered' AND NOT EXISTS(SELECT 1 FROM public.learning_sync_entities e
      WHERE e.user_id=w.user_id AND e.entity_key='word:'||w.word_id)
  ), registrations AS (
    SELECT count(*) FILTER(WHERE created_at >= (today-6)::TIMESTAMP AT TIME ZONE 'Asia/Tashkent'
      AND created_at < (today+1)::TIMESTAMP AT TIME ZONE 'Asia/Tashkent') current_week,
      count(*) FILTER(WHERE created_at >= (today-13)::TIMESTAMP AT TIME ZONE 'Asia/Tashkent'
      AND created_at < (today-6)::TIMESTAMP AT TIME ZONE 'Asia/Tashkent') previous_week FROM population
  ), config AS (
    SELECT coalesce(jsonb_object_agg(setting_key,setting_value),'{}'::JSONB) value FROM public.app_settings
    WHERE setting_key IN ('premium_mode_enabled','ads_enabled','free_book_ids','free_books_count','videos_enabled',
      'premium_monthly_price','premium_monthly_original_price','single_book_price','single_book_original_price')
  ), books AS (
    SELECT c.book,min(c.title) title,count(*) word_count,count(DISTINCT c.unit) unit_count,
      (SELECT count(*) FROM completed d WHERE d.book=c.book) mastered_pairs,
      (SELECT count(DISTINCT d.user_id) FROM completed d WHERE d.book=c.book) learners
    FROM public.admin_course_catalog c GROUP BY c.book
  ), streaks AS (
    SELECT p.id FROM population p LEFT JOIN public.learning_sync_entities e ON e.user_id=p.id AND e.entity_key='learning'
    LEFT JOIN public.user_streaks s ON s.user_id=p.id
    WHERE CASE WHEN e.user_id IS NOT NULL THEN
      coalesce(e.payload->>'lastActiveDate','') IN (today::TEXT,(today-1)::TEXT)
      AND coalesce(e.payload->>'streakDays','') ~ '^[1-9][0-9]{0,8}$'
    ELSE s.current_streak>0 AND s.last_activity_date IN (today,today-1) END
  ) SELECT jsonb_build_object(
    'timezone','Asia/Tashkent','day',today,'total_users',(SELECT count(*) FROM population),
    'dau',(SELECT count(*) FROM public.admin_learning_days d JOIN population p ON p.id=d.user_id WHERE d.activity_day=today),
    'activity_tracking_started_at',(SELECT activity_tracking_started_at FROM public.admin_analytics_state),
    'current_week_new_users',r.current_week,'previous_week_new_users',r.previous_week,
    'weekly_growth_pct',CASE WHEN r.previous_week=0 THEN NULL ELSE round((r.current_week-r.previous_week)*100.0/r.previous_week,1) END,
    'mastered_words',(SELECT count(*) FROM completed),'active_streak_users',(SELECT count(*) FROM streaks),
    'config',config.value,'books',(SELECT jsonb_agg(to_jsonb(books) ORDER BY book) FROM books),
    'generated_at',now()) INTO result FROM registrations r CROSS JOIN config;
  RETURN result;
END $$;

CREATE FUNCTION public.admin_update_configuration(p_changes JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item RECORD; changes JSONB := p_changes;
BEGIN
  IF auth.uid() IS NULL OR NOT ingly_private.has_permission('manage_settings') THEN
    RAISE EXCEPTION 'Settings authorization required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(changes) IS DISTINCT FROM 'object' OR changes='{}'::JSONB OR octet_length(changes::TEXT)>4096 THEN
    RAISE EXCEPTION 'Invalid configuration' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT * FROM jsonb_each(changes) LOOP
    IF item.key IN ('premium_mode_enabled','ads_enabled','videos_enabled') THEN
      IF jsonb_typeof(item.value) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid switch' USING ERRCODE='22023'; END IF;
    ELSIF item.key='free_book_ids' THEN
      IF jsonb_typeof(item.value) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid books' USING ERRCODE='22023'; END IF;
      IF jsonb_array_length(item.value)>6 OR EXISTS(SELECT 1 FROM jsonb_array_elements(item.value) v WHERE v::TEXT !~ '^[1-6]$')
        OR (SELECT count(DISTINCT v) FROM jsonb_array_elements(item.value) v)<>jsonb_array_length(item.value) THEN
        RAISE EXCEPTION 'Invalid books' USING ERRCODE='22023'; END IF;
    ELSIF item.key IN ('premium_monthly_price','premium_monthly_original_price','single_book_price','single_book_original_price') THEN
      IF item.value::TEXT !~ '^[1-9][0-9]{0,11}$' THEN RAISE EXCEPTION 'Invalid price' USING ERRCODE='22023'; END IF;
    ELSE RAISE EXCEPTION 'Unsupported configuration key' USING ERRCODE='22023'; END IF;
  END LOOP;
  -- Atomic compatibility projection. No browser max-ID-as-count mistake.
  IF changes ? 'free_book_ids' THEN changes := changes||jsonb_build_object('free_books_count',jsonb_array_length(changes->'free_book_ids')); END IF;
  INSERT INTO public.app_settings(setting_key,setting_value)
    SELECT key,value FROM jsonb_each(changes)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value;
  INSERT INTO public.admin_audit_logs(admin_id,admin_username,action,target_type,details)
    SELECT id,username,'CHANGE_SETTINGS','setting',changes FROM public.admins WHERE auth_user_id=auth.uid();
  RETURN jsonb_build_object('success',true,'config',(SELECT jsonb_object_agg(setting_key,setting_value) FROM public.app_settings
    WHERE setting_key IN ('premium_mode_enabled','ads_enabled','free_book_ids','free_books_count','videos_enabled',
      'premium_monthly_price','premium_monthly_original_price','single_book_price','single_book_original_price')));
END $$;

CREATE FUNCTION ingly_private.validate_finance_input(p JSONB)
RETURNS VOID LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::TEXT)>8192
    OR coalesce(p->>'type','') NOT IN ('income','expense') OR coalesce(p->>'amount','') !~ '^[1-9][0-9]{0,12}$'
    OR (p->>'amount')::BIGINT>1000000000000 OR coalesce(p->>'currency','')<>'UZS'
    OR coalesce(p->>'category','') NOT IN ('vip','book','hosting','sms','marketing','other')
    OR length(btrim(coalesce(p->>'title',''))) NOT BETWEEN 1 AND 200 OR length(coalesce(p->>'description',''))>1000
    OR coalesce(p->>'payment_method','') NOT IN ('cash','bank_transfer','click','payme','other')
    OR length(coalesce(p->>'reference','')) NOT BETWEEN 1 AND 200 OR (p->>'occurred_at') IS NULL
    OR coalesce(p->>'environment','') NOT IN ('production','test','mock') THEN
    RAISE EXCEPTION 'Invalid finance entry' USING ERRCODE='22023'; END IF;
  IF (p->>'occurred_at')::TIMESTAMPTZ<'2000-01-01'::TIMESTAMPTZ OR (p->>'occurred_at')::TIMESTAMPTZ>now()+INTERVAL '1 day' THEN
    RAISE EXCEPTION 'Invalid transaction date' USING ERRCODE='22023'; END IF;
END $$;
REVOKE ALL ON FUNCTION ingly_private.validate_finance_input(JSONB) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.admin_create_finance_entry(p_entry JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row public.finance_ledger%ROWTYPE; request_id UUID; ref TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT ingly_private.has_permission('manage_finance') THEN
    RAISE EXCEPTION 'Finance authorization required' USING ERRCODE='42501'; END IF;
  PERFORM ingly_private.validate_finance_input(p_entry);
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_entry) k WHERE k NOT IN
    ('request_id','reference','type','amount','currency','category','title','description','payment_method','occurred_at','environment')) THEN
    RAISE EXCEPTION 'Unsupported finance field' USING ERRCODE='22023'; END IF;
  request_id := (p_entry->>'request_id')::UUID;
  IF request_id IS NULL THEN RAISE EXCEPTION 'Request ID required' USING ERRCODE='22023'; END IF;
  ref := p_entry->>'reference';
  INSERT INTO public.finance_ledger(id,type,amount,currency,category,title,description,payment_method,reference,
    occurred_at,status,environment,source,created_by)
    VALUES(request_id,p_entry->>'type',(p_entry->>'amount')::BIGINT,'UZS',p_entry->>'category',btrim(p_entry->>'title'),
      coalesce(p_entry->>'description',''),p_entry->>'payment_method',ref,(p_entry->>'occurred_at')::TIMESTAMPTZ,
      'completed',p_entry->>'environment','manual',auth.uid()) ON CONFLICT DO NOTHING RETURNING * INTO row;
  IF row.id IS NULL THEN
    SELECT * INTO row FROM public.finance_ledger WHERE id=request_id OR
      (source='manual' AND environment=p_entry->>'environment' AND reference=ref) FOR UPDATE;
    IF row.id IS DISTINCT FROM request_id OR row.created_by IS DISTINCT FROM auth.uid() OR row.source<>'manual'
      OR row.type IS DISTINCT FROM p_entry->>'type' OR row.amount IS DISTINCT FROM (p_entry->>'amount')::BIGINT
      OR row.environment IS DISTINCT FROM p_entry->>'environment' OR row.reference IS DISTINCT FROM ref
      OR row.category IS DISTINCT FROM p_entry->>'category' OR row.title IS DISTINCT FROM btrim(p_entry->>'title')
      OR row.description IS DISTINCT FROM coalesce(p_entry->>'description','') OR row.payment_method IS DISTINCT FROM p_entry->>'payment_method'
      OR row.occurred_at IS DISTINCT FROM (p_entry->>'occurred_at')::TIMESTAMPTZ THEN
      RAISE EXCEPTION 'Duplicate reference or reused request ID' USING ERRCODE='23505'; END IF;
    RETURN jsonb_build_object('success',true,'id',row.id,'replayed',true);
  END IF;
  INSERT INTO public.finance_audit(ledger_id,action,actor,details) VALUES(row.id,'create',auth.uid(),jsonb_build_object('source','manual'));
  RETURN jsonb_build_object('success',true,'id',row.id);
END $$;

CREATE FUNCTION public.admin_void_finance_entry(p_id UUID,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row public.finance_ledger%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT ingly_private.has_permission('manage_finance') THEN
    RAISE EXCEPTION 'Finance authorization required' USING ERRCODE='42501'; END IF;
  IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Void reason required' USING ERRCODE='22023'; END IF;
  SELECT * INTO row FROM public.finance_ledger WHERE id=p_id FOR UPDATE;
  IF row.id IS NULL THEN RAISE EXCEPTION 'Transaction missing' USING ERRCODE='22023'; END IF;
  IF row.status='voided' THEN RETURN jsonb_build_object('success',true,'id',row.id,'replayed',true); END IF;
  UPDATE public.finance_ledger SET status='voided',voided_at=now(),voided_by=auth.uid(),void_reason=btrim(p_reason) WHERE id=p_id;
  INSERT INTO public.finance_audit(ledger_id,action,actor,details) VALUES(p_id,'void',auth.uid(),jsonb_build_object('reason',btrim(p_reason),'previous_status',row.status));
  RETURN jsonb_build_object('success',true,'id',p_id);
END $$;

-- Future verified server callbacks only. No client execute grant or mock flow wiring.
-- Idempotency is per provider+environment+external event ID, independent of browser IDs.
CREATE FUNCTION public.record_verified_finance_purchase(p_event JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row public.finance_ledger%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted server required' USING ERRCODE='42501'; END IF;
  PERFORM ingly_private.validate_finance_input(p_event);
  IF p_event->>'type'<>'income' OR p_event->>'category' NOT IN ('vip','book')
    OR coalesce(p_event->>'status','') NOT IN ('completed','pending','failed','cancelled')
    OR coalesce(p_event->>'payment_method','') NOT IN ('click','payme') THEN
    RAISE EXCEPTION 'Invalid verified purchase' USING ERRCODE='22023'; END IF;
  -- Caller must verify provider signature, amount/product/user and status BEFORE invoking.
  INSERT INTO public.finance_ledger(type,amount,currency,category,title,description,related_user_id,book,
    payment_method,reference,occurred_at,status,environment,source,is_purchase)
    VALUES('income',(p_event->>'amount')::BIGINT,'UZS',p_event->>'category',btrim(p_event->>'title'),
      coalesce(p_event->>'description',''),(p_event->>'related_user_id')::UUID,(p_event->>'book')::INT,
      p_event->>'payment_method',p_event->>'payment_method'||':'||(p_event->>'reference'),
      (p_event->>'occurred_at')::TIMESTAMPTZ,p_event->>'status',p_event->>'environment','verified_provider',true)
    ON CONFLICT(source,environment,reference) DO NOTHING RETURNING * INTO row;
  IF row.id IS NULL THEN
    SELECT * INTO row FROM public.finance_ledger WHERE source='verified_provider' AND environment=p_event->>'environment'
      AND reference=(p_event->>'payment_method')||':'||(p_event->>'reference');
    IF row.amount IS DISTINCT FROM (p_event->>'amount')::BIGINT OR row.status IS DISTINCT FROM p_event->>'status'
      OR row.category IS DISTINCT FROM p_event->>'category' OR row.related_user_id IS DISTINCT FROM (p_event->>'related_user_id')::UUID
      OR row.book IS DISTINCT FROM (p_event->>'book')::INT OR row.title IS DISTINCT FROM btrim(p_event->>'title')
      OR row.description IS DISTINCT FROM coalesce(p_event->>'description','')
      OR row.occurred_at IS DISTINCT FROM (p_event->>'occurred_at')::TIMESTAMPTZ THEN
      RAISE EXCEPTION 'Provider event ID reused' USING ERRCODE='23505'; END IF;
    RETURN jsonb_build_object('success',true,'id',row.id,'replayed',true);
  END IF;
  INSERT INTO public.finance_audit(ledger_id,action,details) VALUES(row.id,'create',jsonb_build_object('source','verified_provider'));
  RETURN jsonb_build_object('success',true,'id',row.id);
END $$;

CREATE FUNCTION public.admin_finance_snapshot(p_environment TEXT DEFAULT 'production',p_filter TEXT DEFAULT 'all',
  p_search TEXT DEFAULT '',p_before_date TIMESTAMPTZ DEFAULT NULL,p_before_id UUID DEFAULT NULL,p_limit INT DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT ingly_private.has_permission('view_finance') THEN
    RAISE EXCEPTION 'Finance authorization required' USING ERRCODE='42501'; END IF;
  IF p_environment IS NULL OR p_environment NOT IN ('production','test','mock') OR p_filter IS NULL
    OR p_filter NOT IN ('all','income','expense','vip','book') OR p_search IS NULL OR length(p_search)>100
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200
    OR (p_before_date IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid finance query' USING ERRCODE='22023'; END IF;
  WITH base AS (SELECT * FROM public.finance_ledger WHERE environment=p_environment),
  filtered AS (SELECT * FROM base WHERE (p_filter='all' OR type=p_filter OR category=p_filter)
    AND (p_search='' OR strpos(lower(title||' '||description||' '||payment_method||' '||reference),lower(p_search))>0)),
  page AS (SELECT * FROM filtered WHERE p_before_date IS NULL OR (occurred_at,id)<(p_before_date,p_before_id)
    ORDER BY occurred_at DESC,id DESC LIMIT p_limit),
  totals AS (SELECT coalesce(sum(amount) FILTER(WHERE type='income' AND status='completed'),0) income,
    coalesce(sum(amount) FILTER(WHERE type='expense' AND status='completed'),0) expenses,
    count(*) FILTER(WHERE type='income' AND status='completed' AND is_purchase AND source='verified_provider') purchase_count FROM base)
  SELECT jsonb_build_object('environment',p_environment,'currency','UZS','income',income,'expenses',expenses,'net_profit',income-expenses,
    'purchase_count',purchase_count,'matched_count',(SELECT count(*) FROM filtered),
    'counts',(SELECT jsonb_build_object('all',count(*),'income',count(*) FILTER(WHERE type='income'),
      'expense',count(*) FILTER(WHERE type='expense'),'vip',count(*) FILTER(WHERE category='vip'),'book',count(*) FILTER(WHERE category='book')) FROM base),
    'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'type',type,'amount',amount,'currency',currency,
      'category',category,'title',title,'description',description,'payment_method',payment_method,'reference',reference,
      'occurred_at',occurred_at,'status',status,'environment',environment,'source',source,'is_purchase',is_purchase,
      'voided_at',voided_at,'void_reason',void_reason) ORDER BY occurred_at DESC,id DESC) FROM page),'[]'::JSONB),
    'generated_at',now()) INTO result FROM totals;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.admin_dashboard_snapshot(),public.admin_update_configuration(JSONB),
  public.admin_create_finance_entry(JSONB),public.admin_void_finance_entry(UUID,TEXT),
  public.admin_finance_snapshot(TEXT,TEXT,TEXT,TIMESTAMPTZ,UUID,INT),public.record_verified_finance_purchase(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_snapshot(),public.admin_update_configuration(JSONB),
  public.admin_create_finance_entry(JSONB),public.admin_void_finance_entry(UUID,TEXT),
  public.admin_finance_snapshot(TEXT,TEXT,TEXT,TIMESTAMPTZ,UUID,INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_finance_purchase(JSONB) TO service_role;
COMMIT;
