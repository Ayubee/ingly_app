-- Security Phase 2: apply to an EXISTING schema; for fresh installations use the complete schema.sql.
-- No legacy account is automatically linked, and no production identity is fabricated.
BEGIN;
CREATE SCHEMA IF NOT EXISTS ingly_private;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA ingly_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ingly_private TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA ingly_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.admins ALTER COLUMN password_hash DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_identity_matches' AND conrelid='public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_auth_identity_matches CHECK (auth_user_id IS NULL OR id = auth_user_id) NOT VALID;
  END IF;
END $$;
-- Remove all pre-existing policies and table/column grants so permissive policies cannot survive.
DO $$ DECLARE t TEXT; c RECORD; p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','admins','admin_audit_logs','user_progress','user_streaks','app_settings','books','units','words'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
    FOR c IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=t LOOP
      EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.%I FROM PUBLIC, anon, authenticated',c.column_name,c.column_name,c.column_name,c.column_name,t);
    END LOOP;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
  END LOOP;
END $$;
REVOKE ALL ON public.v_user_stats FROM PUBLIC, anon, authenticated;
ALTER VIEW public.v_user_stats SET (security_invoker = true);
GRANT SELECT ON public.v_user_stats TO authenticated;
-- Realtime DELETE payloads and legacy full-row replication are a separate exposure.
-- Private rows and mixed public/private settings must not be replicated to clients.
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT tablename FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public'
      AND tablename IN ('users','admins','admin_audit_logs','user_progress','user_streaks','app_settings') LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I',t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION ingly_private.active_account()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id=auth.uid() AND id=auth.uid() AND NOT is_blocked);
$$;
CREATE OR REPLACE FUNCTION ingly_private.has_permission(permission TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins a JOIN public.users u ON u.auth_user_id=a.auth_user_id AND u.id=a.auth_user_id
    WHERE a.auth_user_id=auth.uid() AND a.is_active AND NOT u.is_blocked
    AND (a.role='super_admin' OR (permission <> 'manage_admins' AND jsonb_typeof(a.permissions)='array' AND a.permissions ? permission)));
$$;
REVOKE ALL ON FUNCTION ingly_private.active_account() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ingly_private.has_permission(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ingly_private.active_account(), ingly_private.has_permission(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_admin_access()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', a.id, 'auth_user_id', a.auth_user_id, 'username', a.username, 'name', a.full_name, 'role', a.role, 'permissions', a.permissions)
  FROM public.admins a JOIN public.users u ON u.auth_user_id=a.auth_user_id AND u.id=a.auth_user_id
  WHERE a.auth_user_id=auth.uid() AND a.is_active AND NOT u.is_blocked;
$$;
REVOKE ALL ON FUNCTION public.get_my_admin_access() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_admin_access() TO authenticated;

GRANT SELECT (id,auth_user_id,full_name,username,phone,email,avatar_url,daily_goal,is_blocked,is_premium,premium_until,created_at,updated_at) ON public.users TO authenticated;
GRANT UPDATE (full_name,avatar_url,daily_goal,updated_at) ON public.users TO authenticated;
CREATE POLICY profiles_read ON public.users FOR SELECT TO authenticated
 USING ((auth_user_id=auth.uid() AND ingly_private.active_account()) OR ingly_private.has_permission('manage_users'));
CREATE POLICY profiles_update ON public.users FOR UPDATE TO authenticated
 USING (auth_user_id=auth.uid() AND ingly_private.active_account())
 WITH CHECK (auth_user_id=auth.uid() AND ingly_private.active_account());
GRANT SELECT (id,auth_user_id,full_name,username,role,permissions,is_active,created_at,updated_at) ON public.admins TO authenticated;
CREATE POLICY admins_read ON public.admins FOR SELECT TO authenticated
 USING (auth_user_id=auth.uid() OR ingly_private.has_permission('manage_admins'));
GRANT SELECT ON public.admin_audit_logs TO authenticated;
CREATE POLICY audit_read ON public.admin_audit_logs FOR SELECT TO authenticated USING (ingly_private.has_permission('manage_admins'));
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['user_progress','user_streaks'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',t);
    EXECUTE format('CREATE POLICY owned_data ON public.%I FOR ALL TO authenticated USING (user_id=auth.uid() AND ingly_private.active_account()) WITH CHECK (user_id=auth.uid() AND ingly_private.active_account())',t);
    EXECUTE format('CREATE POLICY admin_stats ON public.%I FOR SELECT TO authenticated USING (ingly_private.has_permission(''manage_users''))',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['books','units','words'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated',t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated',t);
    EXECUTE format('CREATE POLICY content_read ON public.%I FOR SELECT TO anon, authenticated USING (true)',t);
    EXECUTE format('CREATE POLICY content_write ON public.%I FOR ALL TO authenticated USING (ingly_private.has_permission(''manage_words'')) WITH CHECK (ingly_private.has_permission(''manage_words''))',t);
  END LOOP;
END $$;
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
CREATE POLICY public_settings ON public.app_settings FOR SELECT TO anon, authenticated USING (setting_key IN (
 'ads_enabled','premium_mode_enabled','free_books_count','free_book_ids','videos_enabled','latest_announcement',
 'daily_goal_default','premium_monthly_original_price','premium_monthly_price','single_book_original_price','single_book_price'));
CREATE POLICY admin_settings ON public.app_settings FOR ALL TO authenticated
 USING (ingly_private.has_permission('manage_settings')) WITH CHECK (ingly_private.has_permission('manage_settings'));
-- Legacy transactions_data/leaderboard_scores are deliberately excluded from public reads.
-- No normal client may insert profiles, admins, or trusted entitlements.
REVOKE ALL ON SEQUENCE public.books_id_seq, public.units_id_seq, public.words_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON SEQUENCE public.books_id_seq, public.units_id_seq, public.words_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.books_id_seq, public.units_id_seq, public.words_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION ingly_private.create_auth_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE login TEXT := lower(coalesce(nullif(NEW.raw_user_meta_data->>'username',''), 'user_' || replace(NEW.id::text,'-','')));
BEGIN
  IF login !~ '^[a-z0-9_]{3,100}$' THEN RAISE EXCEPTION 'Invalid username'; END IF;
  INSERT INTO public.users(id,auth_user_id,username,full_name,phone,email,daily_goal,avatar_url)
    VALUES (NEW.id, NEW.id, login, coalesce(nullif(NEW.raw_user_meta_data->>'full_name',''),login),nullif(NEW.phone,''),nullif(NEW.email,''),
      CASE WHEN NEW.raw_user_meta_data->>'daily_goal' IN ('10','20','30') THEN (NEW.raw_user_meta_data->>'daily_goal')::int ELSE 20 END,
      nullif(left(NEW.raw_user_meta_data->>'avatar',40),''));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ingly_private.create_auth_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ingly_auth_profile ON auth.users;
CREATE TRIGGER ingly_auth_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION ingly_private.create_auth_profile();
-- Profiles' contact data follows verified Auth contact updates, never caller metadata.
CREATE OR REPLACE FUNCTION ingly_private.sync_auth_contact()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.users SET phone=nullif(NEW.phone,''),email=nullif(NEW.email,'') WHERE auth_user_id=NEW.id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ingly_private.sync_auth_contact() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ingly_auth_contact ON auth.users;
CREATE TRIGGER ingly_auth_contact AFTER UPDATE OF phone,email ON auth.users FOR EACH ROW EXECUTE FUNCTION ingly_private.sync_auth_contact();

DROP FUNCTION IF EXISTS public.verify_user_credentials(TEXT,TEXT);
DROP FUNCTION IF EXISTS public.set_user_password_secure(UUID,TEXT,TEXT);
DROP FUNCTION IF EXISTS public.get_safe_user_status(TEXT);
DROP FUNCTION IF EXISTS public.sync_user_offline_progress(UUID,JSONB);
DROP FUNCTION IF EXISTS public.record_user_activity(UUID,INT);
CREATE OR REPLACE FUNCTION public.record_user_activity(p_words_count INT DEFAULT 1)
RETURNS TABLE (
    current_streak INT,
    max_streak INT,
    words_learned_today INT
) AS $$
DECLARE
    p_user_id UUID := auth.uid();
    v_today DATE := CURRENT_DATE;
    v_streak_record public.user_streaks%ROWTYPE;
BEGIN
    IF p_user_id IS NULL OR NOT ingly_private.active_account() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
    IF p_words_count IS NULL OR p_words_count < 0 OR p_words_count > 500 THEN RAISE EXCEPTION 'Invalid activity count'; END IF;
    SELECT * INTO v_streak_record FROM public.user_streaks WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        INSERT INTO public.user_streaks (user_id, current_streak, max_streak, last_activity_date, words_learned_today)
        VALUES (p_user_id, 1, 1, v_today, p_words_count)
        RETURNING * INTO v_streak_record;
    ELSE
        IF v_streak_record.last_activity_date = v_today THEN
            -- Bugun allaqachon faol bo'lgan, faqat so'zlar sonini oshiramiz
            UPDATE public.user_streaks
            SET words_learned_today = user_streaks.words_learned_today + p_words_count
            WHERE user_id = p_user_id
            RETURNING * INTO v_streak_record;
        ELSIF v_streak_record.last_activity_date = v_today - 1 THEN
            -- Kecha kirgan, streak davom etadi
            UPDATE public.user_streaks
            SET current_streak = user_streaks.current_streak + 1,
                max_streak = GREATEST(user_streaks.max_streak, user_streaks.current_streak + 1),
                last_activity_date = v_today,
                words_learned_today = p_words_count
            WHERE user_id = p_user_id
            RETURNING * INTO v_streak_record;
        ELSE
            -- 1 kundan ko'p uzilib qolgan, streak nollanadi va 1 dan boshlanadi
            UPDATE public.user_streaks
            SET current_streak = 1,
                last_activity_date = v_today,
                words_learned_today = p_words_count
            WHERE user_id = p_user_id
            RETURNING * INTO v_streak_record;
        END IF;
    END IF;

    RETURN QUERY
    SELECT v_streak_record.current_streak, v_streak_record.max_streak, v_streak_record.words_learned_today;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.sync_user_offline_progress(
    p_sync_items JSONB
)
RETURNS JSONB AS $$
DECLARE
    p_user_id UUID := auth.uid();
    v_item RECORD;
    v_synced_count INT := 0;
    v_current_streak INT := 0;
    v_max_streak INT := 0;
BEGIN
    IF p_user_id IS NULL OR NOT ingly_private.active_account() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
    IF jsonb_typeof(p_sync_items) <> 'array' OR jsonb_array_length(p_sync_items) > 500 THEN RAISE EXCEPTION 'Invalid batch'; END IF;
    -- 1. Parametrlarni tekshirish
    IF p_sync_items IS NULL OR jsonb_array_length(p_sync_items) = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'synced_count', 0,
            'message', 'Sinxronizatsiya uchun ma''lumot berilmadi'
        );
    END IF;

    -- 2. Har bir oflayn so'z progressini qayta ishlash va UPSERT qilish
    FOR v_item IN
        SELECT
            (x->>'word_id')::INT AS word_id,
            COALESCE(x->>'status', 'review') AS status,
            COALESCE((x->>'is_favorite')::BOOLEAN, false) AS is_favorite,
            COALESCE((x->>'reviewed_at')::TIMESTAMPTZ, timezone('utc'::text, now())) AS reviewed_at,
            COALESCE((x->>'next_review_date')::TIMESTAMPTZ, NULL) AS next_review_date
        FROM jsonb_array_elements(p_sync_items) AS x
        WHERE (x->>'word_id') IS NOT NULL
    LOOP
        -- Faqat to'g'ri statuslar qabul qilinadi
        IF v_item.status NOT IN ('hard', 'review', 'mastered') THEN
            v_item.status := 'review';
        END IF;

        -- UPSERT: Agar mavjud bo'lsa va kelgan vaqt bazadagidan yangiroq bo'lsa yangilaydi (Last-Write-Wins)
        INSERT INTO public.user_progress (
            user_id,
            word_id,
            status,
            review_count,
            next_review_date,
            last_reviewed_at,
            is_favorite,
            updated_at
        )
        VALUES (
            p_user_id,
            v_item.word_id,
            v_item.status,
            1,
            v_item.next_review_date,
            v_item.reviewed_at,
            v_item.is_favorite,
            timezone('utc'::text, now())
        )
        ON CONFLICT (user_id, word_id) DO UPDATE
        SET
            status = EXCLUDED.status,
            review_count = public.user_progress.review_count + 1,
            next_review_date = COALESCE(EXCLUDED.next_review_date, public.user_progress.next_review_date),
            last_reviewed_at = EXCLUDED.last_reviewed_at,
            is_favorite = CASE
                WHEN EXCLUDED.is_favorite IS NOT NULL THEN EXCLUDED.is_favorite
                ELSE public.user_progress.is_favorite
            END,
            updated_at = timezone('utc'::text, now())
        WHERE public.user_progress.last_reviewed_at IS NULL
           OR EXCLUDED.last_reviewed_at >= public.user_progress.last_reviewed_at;

        v_synced_count := v_synced_count + 1;
    END LOOP;

    -- 3. user_streaks jadvalini sinxronlangan yangi faollik bilan yangilash
    IF v_synced_count > 0 THEN
        SELECT current_streak, max_streak
        INTO v_current_streak, v_max_streak
        FROM public.record_user_activity(v_synced_count);
    ELSE
        SELECT COALESCE(current_streak, 0), COALESCE(max_streak, 0)
        INTO v_current_streak, v_max_streak
        FROM public.user_streaks
        WHERE user_id = p_user_id;
    END IF;

    -- 4. Natijani JSON formatda qaytarish
    RETURN jsonb_build_object(
        'success', true,
        'synced_count', v_synced_count,
        'current_streak', COALESCE(v_current_streak, 0),
        'max_streak', COALESCE(v_max_streak, 0),
        'synced_at', timezone('utc'::text, now())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


REVOKE ALL ON FUNCTION public.record_user_activity(INT), public.sync_user_offline_progress(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_activity(INT), public.sync_user_offline_progress(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.trigger_set_timestamp() FROM PUBLIC, anon, authenticated;
COMMIT;
