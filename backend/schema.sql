-- =============================================================================
-- Ingly (4000 Essential English Words) - PostgreSQL / Supabase Database Schema
-- Versiya: 1.0.0
-- Sana: 2026-10-03
-- Muallif: inglyJon Backend Team
-- =============================================================================

-- 1. KENGAYTMALAR (EXTENSIONS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 2. FUNKSIYALAR VA TRIGGERLAR (UTILITIES)
-- =============================================================================

-- Avtomatik 'updated_at' maydonini yangilovchi trigger funksiyasi
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. JADVALLAR TUZILMASI (TABLE SCHEMAS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1. FOYDALANUVCHILAR JADVALI (users)
-- Mobil ilovadan ro'yxatdan o'tgan foydalanuvchilar ma'lumotlari
-- -----------------------------------------------------------------------------

    is_blocked BOOLEAN NOT NULL DEFAULT false,
    is_premium BOOLEAN NOT NULL DEFAULT false,
    premium_until TIMESTAMPTZ,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Tashkent',
    daily_goal INT NOT NULL DEFAULT 20 CHECK (daily_goal BETWEEN 5 AND 100),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.users IS 'Ingly mobil ilovasining barcha foydalanuvchilari';
COMMENT ON COLUMN public.users.is_blocked IS 'Admin tomonidan bloklanganlik holati';
COMMENT ON COLUMN public.users.is_premium IS 'Premium (VIP) obunasi faolligi';
COMMENT ON COLUMN public.users.premium_until IS 'Premium obunasining tugash vaqti';
COMMENT ON COLUMN public.users.google_id IS 'Google OAuth 2.0 orqali kirganda olingan Google sub ID';

-- Trigger: users.updated_at
DROP TRIGGER IF EXISTS set_timestamp_users ON public.users;
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- -----------------------------------------------------------------------------
-- 3.2. ADMINLAR JADVALI (admins)
-- Web Admin panel operatorlari, moderatorlar va boshqaruvchilar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'editor' CHECK (role IN ('super_admin', 'editor', 'moderator')),
    permissions JSONB NOT NULL DEFAULT '["manage_words"]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.admins IS 'Web Admin panel xodimlari va ularning huquqlari (RBAC)';
COMMENT ON COLUMN public.admins.role IS 'Admin roli: super_admin, editor, moderator';
COMMENT ON COLUMN public.admins.permissions IS 'JSON formatdagi aniq ruxsatlar: manage_words, manage_users, manage_admins, view_analytics, send_notifications, manage_settings';

-- Trigger: admins.updated_at
DROP TRIGGER IF EXISTS set_timestamp_admins ON public.admins;
CREATE TRIGGER set_timestamp_admins
BEFORE UPDATE ON public.admins
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- -----------------------------------------------------------------------------
-- 3.2.1. ADMIN AUDIT LOGLAR JADVALI (admin_audit_logs)
-- Barcha adminlar va moderatorlarning harakatlari tarixi (Xavfsizlik nazorati)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    admin_username VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL, -- 'BLOCK_USER', 'UNBLOCK_USER', 'EDIT_WORD', 'RESET_PASSWORD', 'CHANGE_SETTINGS'
    target_type VARCHAR(50) NOT NULL, -- 'user', 'word', 'admin', 'setting', 'notification'
    target_id VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.admin_audit_logs IS 'Adminlarning harakatlari tarixi (Super Admin nazorati uchun)';
CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.admin_audit_logs(created_at DESC);


-- -----------------------------------------------------------------------------
-- 3.3. KITOBLAR JADVALI (books)
-- "4000 Essential English Words" 1-6 kitoblari
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.books (
    id SERIAL PRIMARY KEY,
    book_number INT NOT NULL UNIQUE CHECK (book_number BETWEEN 1 AND 6),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    level VARCHAR(50),
    total_units INT NOT NULL DEFAULT 30,
    is_free BOOLEAN NOT NULL DEFAULT true,
    cover_image_url TEXT,
    color_gradient VARCHAR(100),
    order_index INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.books IS '4000 Essential English Words kitoblar toʻplami (Book 1 - Book 6)';
COMMENT ON COLUMN public.books.is_free IS 'Kitob bepul yoki pullik (Premium) ekanligi';

-- Trigger: books.updated_at
DROP TRIGGER IF EXISTS set_timestamp_books ON public.books;
CREATE TRIGGER set_timestamp_books
BEFORE UPDATE ON public.books
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- -----------------------------------------------------------------------------
-- 3.4. UNITLAR / DARSLAR JADVALI (units)
-- Har bir kitobda 30 tadan unit (dars)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.units (
    id SERIAL PRIMARY KEY,
    book_id INT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    unit_number INT NOT NULL CHECK (unit_number BETWEEN 1 AND 30),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_words INT NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_book_unit UNIQUE (book_id, unit_number)
);

COMMENT ON TABLE public.units IS 'Har bir kitobdagi 30 tadan darslar (Unit 1 - Unit 30)';

-- Trigger: units.updated_at
DROP TRIGGER IF EXISTS set_timestamp_units ON public.units;
CREATE TRIGGER set_timestamp_units
BEFORE UPDATE ON public.units
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- -----------------------------------------------------------------------------
-- 3.5. SO'ZLAR JADVALI (words)
-- 4000 ta so'z, transkripsiya, ta'rif, misol, media havolalar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.words (
    id SERIAL PRIMARY KEY,
    unit_id INT NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    word VARCHAR(150) NOT NULL,
    phonetic VARCHAR(150),
    part_of_speech VARCHAR(50),
    uzbek_translation VARCHAR(255) NOT NULL,
    definition TEXT NOT NULL,
    definition_uz TEXT NOT NULL,
    example TEXT NOT NULL,
    example_uz TEXT NOT NULL,
    image_url TEXT,
    audio_url TEXT,
    video_clip_url TEXT,
    order_index INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.words IS 'Lugʻatdagi barcha inglizcha soʻzlar va ularning oʻzbekcha toʻliq maʼlumotlari';
COMMENT ON COLUMN public.words.definition_uz IS 'Inglizcha taʼrifning oʻzbek tilidagi tarjimasi';
COMMENT ON COLUMN public.words.example_uz IS 'Misol gapning oʻzbek tilidagi tarjimasi';
COMMENT ON COLUMN public.words.video_clip_url IS 'Kino va seriallardan 3-5 soniyalik qisqa video parcha (MP4)';

-- Trigger: words.updated_at
DROP TRIGGER IF EXISTS set_timestamp_words ON public.words;
CREATE TRIGGER set_timestamp_words
BEFORE UPDATE ON public.words
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- -----------------------------------------------------------------------------
-- 3.6. FOYDALANUVCHI PROGRESSI (user_progress)
-- Oraliq takrorlash tizimi (Spaced Repetition) va o'rganish holati
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    word_id INT NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'review' CHECK (status IN ('hard', 'review', 'mastered')),
    review_count INT NOT NULL DEFAULT 0,
    next_review_date TIMESTAMPTZ,
    last_reviewed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_word_progress UNIQUE (user_id, word_id)
);

COMMENT ON TABLE public.user_progress IS 'Har bir foydalanuvchining soʻzlarni yodlash darajasi (Spaced Repetition)';
COMMENT ON COLUMN public.user_progress.status IS 'hard: Qiyin (qizil), review: Takrorlash (moviy), mastered: Yodlandi (yashil)';

-- Trigger: user_progress.updated_at
DROP TRIGGER IF EXISTS set_timestamp_user_progress ON public.user_progress;
CREATE TRIGGER set_timestamp_user_progress
BEFORE UPDATE ON public.user_progress
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- -----------------------------------------------------------------------------
-- 3.7. FOYDALANUVCHI STREAK VA KUNLIK MAQSAD (user_streaks)
-- Kunlik faollik, olovcha (streak) va rekordlar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0,
    max_streak INT NOT NULL DEFAULT 0,
    last_activity_date DATE DEFAULT CURRENT_DATE,
    words_learned_today INT NOT NULL DEFAULT 0,
    daily_goal INT NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.user_streaks IS 'Foydalanuvchilarning kunlik streak (olovcha) va faollik hisobi';

-- Trigger: user_streaks.updated_at
DROP TRIGGER IF EXISTS set_timestamp_user_streaks ON public.user_streaks;
CREATE TRIGGER set_timestamp_user_streaks
BEFORE UPDATE ON public.user_streaks
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- -----------------------------------------------------------------------------
-- 3.8. TIZIM SOZLAMALARI (app_settings)
-- Feature flags: Reklama (AdMob), Premium rejimi, versiya boshqaruvi
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.app_settings IS 'Mobil ilova va tizimning global dinamik sozlamalari (Feature Flags)';

-- Trigger: app_settings.updated_at
DROP TRIGGER IF EXISTS set_timestamp_app_settings ON public.app_settings;
CREATE TRIGGER set_timestamp_app_settings
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();


-- =============================================================================
-- 4. INDEKSLAR (INDEXES) - YUQORI TEZLIK VA SAMARADORLIK UCHUN
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON public.users(is_blocked);
CREATE INDEX IF NOT EXISTS idx_users_is_premium ON public.users(is_premium);

CREATE INDEX IF NOT EXISTS idx_admins_username ON public.admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_role ON public.admins(role);

CREATE INDEX IF NOT EXISTS idx_books_book_number ON public.books(book_number);
CREATE INDEX IF NOT EXISTS idx_units_book_id ON public.units(book_id);
CREATE INDEX IF NOT EXISTS idx_units_unit_number ON public.units(unit_number);

CREATE INDEX IF NOT EXISTS idx_words_unit_id ON public.words(unit_id);
CREATE INDEX IF NOT EXISTS idx_words_word ON public.words(word);
CREATE INDEX IF NOT EXISTS idx_words_uzbek ON public.words(uzbek_translation);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_word_id ON public.user_progress(word_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_status ON public.user_progress(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_progress_is_favorite ON public.user_progress(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_user_progress_next_review ON public.user_progress(user_id, next_review_date);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON public.user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_last_date ON public.user_streaks(last_activity_date);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(setting_key);


-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS) XAVFSIZLIK QOIDALARI
-- =============================================================================

-- 5.1. Barcha jadvallarda RLS yoqish
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5.2. BOOKS, UNITS, WORDS: Barcha foydalanuvchilar o'qiy oladi (Public Read)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view books" ON public.books;
CREATE POLICY "Public can view books" ON public.books
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view units" ON public.units;
CREATE POLICY "Public can view units" ON public.units
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view words" ON public.words;
CREATE POLICY "Public can view words" ON public.words
    FOR SELECT USING (true);

-- -----------------------------------------------------------------------------
-- 5.3. APP_SETTINGS: Barcha foydalanuvchilar o'qiy oladi (Public Read)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view app settings" ON public.app_settings;
CREATE POLICY "Public can view app settings" ON public.app_settings
    FOR SELECT USING (true);

-- -----------------------------------------------------------------------------
-- 5.4. USERS: Foydalanuvchilar o'z profilini ko'rish va o'zgartirishi mumkin
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (
        auth.uid() = id OR 
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (
        auth.uid() = id OR 
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- Yangi foydalanuvchi o'zini ro'yxatdan o'tkaza oladi
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (
        auth.uid() = id OR 
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role' OR
        auth.role() = 'anon'
    );

-- -----------------------------------------------------------------------------
-- 5.5. USER_PROGRESS: Foydalanuvchi faqat o'z progressini boshqaradi
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_progress;
CREATE POLICY "Users can view own progress" ON public.user_progress
    FOR SELECT USING (
        auth.uid() = user_id OR 
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress;
CREATE POLICY "Users can insert own progress" ON public.user_progress
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;
CREATE POLICY "Users can update own progress" ON public.user_progress
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "Users can delete own progress" ON public.user_progress;
CREATE POLICY "Users can delete own progress" ON public.user_progress
    FOR DELETE USING (
        auth.uid() = user_id OR 
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- -----------------------------------------------------------------------------
-- 5.6. USER_STREAKS: Foydalanuvchi faqat o'z streak'ini ko'radi va yangilaydi
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own streak" ON public.user_streaks;
CREATE POLICY "Users can view own streak" ON public.user_streaks
    FOR SELECT USING (
        auth.uid() = user_id OR 
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "Users can insert own streak" ON public.user_streaks;
CREATE POLICY "Users can insert own streak" ON public.user_streaks
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "Users can update own streak" ON public.user_streaks;
CREATE POLICY "Users can update own streak" ON public.user_streaks
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- -----------------------------------------------------------------------------
-- 5.7. ADMINS: Faqat xizmat kaliti (service_role) yoki tizim ichki rollari
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role has full access to admins" ON public.admins;
CREATE POLICY "Service role has full access to admins" ON public.admins
    FOR ALL USING (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );


-- =============================================================================
-- 6. FOYDALI FUNKSIYA VA STATISTIKA (STORED PROCEDURES & VIEWS)
-- =============================================================================

-- Foydalanuvchi kunlik streak'ini xavfsiz yangilovchi funksiya
CREATE OR REPLACE FUNCTION public.record_user_activity(p_user_id UUID, p_words_count INT DEFAULT 1)
RETURNS TABLE (
    current_streak INT,
    max_streak INT,
    words_learned_today INT
) AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_streak_record public.user_streaks%ROWTYPE;
BEGIN
    SELECT * INTO v_streak_record FROM public.user_streaks WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        INSERT INTO public.user_streaks (user_id, current_streak, max_streak, last_activity_date, words_learned_today)
        VALUES (p_user_id, 1, 1, v_today, p_words_count)
        RETURNING * INTO v_streak_record;
    ELSE
        IF v_streak_record.last_activity_date = v_today THEN
            -- Bugun allaqachon faol bo'lgan, faqat so'zlar sonini oshiramiz
            UPDATE public.user_streaks
            SET words_learned_today = words_learned_today + p_words_count
            WHERE user_id = p_user_id
            RETURNING * INTO v_streak_record;
        ELSIF v_streak_record.last_activity_date = v_today - 1 THEN
            -- Kecha kirgan, streak davom etadi
            UPDATE public.user_streaks
            SET current_streak = current_streak + 1,
                max_streak = GREATEST(max_streak, current_streak + 1),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- OFLAYN PROGRESSNI BIR VAQTNING O'ZIDA SINXRONIZATSIYA QILISH (RPC FUNKSIYA)
-- Offline-first sinxronizatsiya: Bitta tranzaksiyada bir nechta so'zlarni UPSERT qiladi
-- Nizolar yechimi (Conflict Resolution): Last-Write-Wins (eng yangi tahrir vaqti ustun turadi)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_offline_progress(
    p_user_id UUID, 
    p_sync_items JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_synced_count INT := 0;
    v_current_streak INT := 0;
    v_max_streak INT := 0;
BEGIN
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
        FROM public.record_user_activity(p_user_id, v_synced_count);
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funksiyalar uchun ruxsatlar
GRANT EXECUTE ON FUNCTION public.sync_user_offline_progress(UUID, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_user_activity(UUID, INT) TO authenticated, anon, service_role;

-- Foydalanuvchi umumiy o'rganish statistikasini ko'rsatuvchi View
CREATE OR REPLACE VIEW public.v_user_stats AS
SELECT 
    u.id AS user_id,
    u.full_name,
    u.username,
    u.phone,
    u.is_premium,
    u.is_blocked,
    COALESCE(s.current_streak, 0) AS current_streak,
    COALESCE(s.max_streak, 0) AS max_streak,
    COUNT(p.id) FILTER (WHERE p.status = 'mastered') AS mastered_words_count,
    COUNT(p.id) FILTER (WHERE p.status = 'review') AS reviewing_words_count,
    COUNT(p.id) FILTER (WHERE p.status = 'hard') AS hard_words_count,
    COUNT(p.id) FILTER (WHERE p.is_favorite = true) AS favorites_count
FROM public.users u
LEFT JOIN public.user_streaks s ON u.id = s.user_id
LEFT JOIN public.user_progress p ON u.id = p.user_id
GROUP BY u.id, s.current_streak, s.max_streak;


-- =============================================================================
-- 7. DASTLABKI MA'LUMOTLAR (SEED DATA)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 7.1. 6 TA ASOSIY KITOB (Book 1 - Book 6)
-- -----------------------------------------------------------------------------
INSERT INTO public.books (book_number, title, description, level, total_units, is_free, color_gradient, order_index)
VALUES
(1, '4000 Essential English Words 1', 'Boshlang''ich daraja (A1-A2) uchun eng muhim 600 ta asosiy so''zlar.', 'Beginner / A1-A2', 30, true, 'from-blue-500 to-indigo-600', 1),
(2, '4000 Essential English Words 2', 'Boshlang''ichdan yuqori daraja (A2) uchun 600 ta kundalik faol so''zlar.', 'Elementary / A2', 30, true, 'from-emerald-500 to-teal-600', 2),
(3, '4000 Essential English Words 3', 'O''rta darajaga o''tish (B1) uchun 600 ta zaruriy va qiziqarli so''zlar.', 'Pre-Intermediate / B1', 30, true, 'from-amber-500 to-orange-600', 3),
(4, '4000 Essential English Words 4', 'O''rta daraja (B1-B2) uchun lug''at boyligini kengaytiruvchi 600 ta so''z.', 'Intermediate / B1-B2', 30, true, 'from-rose-500 to-pink-600', 4),
(5, '4000 Essential English Words 5', 'Yuqori o''rta daraja (B2) uchun akademik va murakkab 600 ta so''z.', 'Upper-Intermediate / B2', 30, true, 'from-purple-500 to-violet-600', 5),
(6, '4000 Essential English Words 6', 'Yuqori daraja (C1) uchun chuqurlashtirilgan va mukammal 600 ta so''z.', 'Advanced / C1', 30, true, 'from-indigo-600 to-slate-800', 6)
ON CONFLICT (book_number) DO UPDATE 
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    level = EXCLUDED.level,
    total_units = EXCLUDED.total_units,
    is_free = EXCLUDED.is_free,
    color_gradient = EXCLUDED.color_gradient;


-- -----------------------------------------------------------------------------
-- 7.2. 6 TA KITOB UCHUN 30 TADAN UNITLARNI AVTOMATIK YARATISH (Jami 180 ta unit)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    b_rec RECORD;
    u_num INT;
BEGIN
    FOR b_rec IN SELECT id, book_number FROM public.books ORDER BY book_number LOOP
        FOR u_num IN 1..30 LOOP
            INSERT INTO public.units (book_id, unit_number, title, description, total_words)
            VALUES (
                b_rec.id, 
                u_num, 
                'Unit ' || u_num, 
                'Book ' || b_rec.book_number || ' - ' || u_num || '-dars (20 ta so''z)',
                20
            )
            ON CONFLICT (book_id, unit_number) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 7.3. TIZIM STANDART SOZLAMALARI (app_settings)
-- TZ bo'yicha reklama va premium rejim dastlab butunlay o'chiq
-- -----------------------------------------------------------------------------
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
(
    'ads_enabled',
    'false'::jsonb,
    'Google AdMob reklamalarini ilovada ko''rsatish. Hozirda: butunlay o''chiq (100% bepul).'
),
(
    'premium_mode_enabled',
    'false'::jsonb,
    'Pullik obuna (Premium) rejimini yoqish/o''chirish. Hozirda: o''chiq (barcha 6 ta kitob ochiq).'
),
(
    'free_books_count',
    '6'::jsonb,
    'Foydalanuvchilarga bepul beriladigan kitoblar soni (Boshida barcha 6 ta kitob bepul).'
),
(
    'daily_goal_default',
    '20'::jsonb,
    'Har bir foydalanuvchi uchun kunlik standart so''z yodlash maqsadi (20 ta).'
),
(
    'app_version',
    '{"current_version": "1.0.0", "min_supported_version": "1.0.0", "force_update": false}'::jsonb,
    'Mobil ilova versiyasi va majburiy yangilash talabi sozlamasi.'
),
(
    'maintenance_mode',
    'false'::jsonb,
    'Tizim profilaktika rejimida ekanligi (true bo''lsa ilovada xabar ko''rinadi).'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description;


-- -----------------------------------------------------------------------------
-- 7.4. STANDART SUPER ADMIN (admins)
-- Dastlabki admin paneli uchun boshqaruvchi akkaunti
-- Parol: Admin123! (bcrypt shifrlangan: $2a$10$wT0E82P3.7W7NfW74y/3c.1QkU34Ym7UvXp5mY7y31uPqV8oGfWym)
-- -----------------------------------------------------------------------------
INSERT INTO public.admins (
    full_name,
    username,
    email,
    password_hash,
    role,
    permissions,
    is_active
)
VALUES (
    'Joji (Super Admin)',
    'Joji',
    'joji@ingly.uz',
    crypt('Ayubxon_2021213', gen_salt('bf')),
    'super_admin',
    '["manage_words", "manage_users", "manage_admins", "view_analytics", "send_notifications", "manage_settings"]'::jsonb,
    true
)
ON CONFLICT (username) DO UPDATE
SET permissions = EXCLUDED.permissions,
    role = EXCLUDED.role;


-- -----------------------------------------------------------------------------
-- 7.5. TEST / NAMUNAVIY SO'ZLAR (Book 1, Unit 1)
-- TZ.txt bo'yicha to'liq ma'lumotlar strukturasi
-- -----------------------------------------------------------------------------
INSERT INTO public.words (
    unit_id,
    word,
    phonetic,
    part_of_speech,
    uzbek_translation,
    definition,
    definition_uz,
    example,
    example_uz,
    image_url,
    audio_url,
    video_clip_url,
    order_index
)
SELECT 
    u.id,
    'afraid',
    '/əˈfreɪd/',
    'adjective',
    'qo''rqqan',
    'When someone is afraid, they feel fear.',
    'Biror kimsa qo''rqqanda, u xavf yoki vahimani his qiladi.',
    'The woman was afraid of what she saw.',
    'Ayol ko''rgan narsasidan qo''rqib ketdi.',
    'https://storage.ingly.uz/words/book1/unit1/afraid.webp',
    'https://storage.ingly.uz/words/book1/unit1/afraid.mp3',
    'https://storage.ingly.uz/words/book1/unit1/afraid_clip.mp4',
    1
FROM public.units u
JOIN public.books b ON u.book_id = b.id
WHERE b.book_number = 1 AND u.unit_number = 1
ON CONFLICT DO NOTHING;

INSERT INTO public.words (
    unit_id,
    word,
    phonetic,
    part_of_speech,
    uzbek_translation,
    definition,
    definition_uz,
    example,
    example_uz,
    image_url,
    audio_url,
    video_clip_url,
    order_index
)
SELECT 
    u.id,
    'agree',
    '/əˈɡriː/',
    'verb',
    'rozi bo''lmoq, fikriga qo''shilmoq',
    'To agree is to have the same opinion or say yes.',
    'Rozi bo''lmoq - bir xil fikrda bo''lish yoki ma''qullashni bildiradi.',
    'The students agreed that they have too much homework.',
    'Talabalar uy vazifasi juda ko''p ekanligiga rozilik bildirishdi.',
    'https://storage.ingly.uz/words/book1/unit1/agree.webp',
    'https://storage.ingly.uz/words/book1/unit1/agree.mp3',
    'https://storage.ingly.uz/words/book1/unit1/agree_clip.mp4',
    2
FROM public.units u
JOIN public.books b ON u.book_id = b.id
WHERE b.book_number = 1 AND u.unit_number = 1
ON CONFLICT DO NOTHING;

INSERT INTO public.words (
    unit_id,
    word,
    phonetic,
    part_of_speech,
    uzbek_translation,
    definition,
    definition_uz,
    example,
    example_uz,
    image_url,
    audio_url,
    video_clip_url,
    order_index
)
SELECT 
    u.id,
    'angry',
    '/ˈæŋɡri/',
    'adjective',
    'jahli chiqqan, darg''azab',
    'When someone is angry, they want to speak loudly or fight.',
    'Kimningdir jahli chiqqanda, u baqirib gapirishni yoki urushishni xohlaydi.',
    'She didn''t do her homework, so her father was angry.',
    'U uy vazifasini qilmadi, shu sababli otasining jahli chiqdi.',
    'https://storage.ingly.uz/words/book1/unit1/angry.webp',
    'https://storage.ingly.uz/words/book1/unit1/angry.mp3',
    'https://storage.ingly.uz/words/book1/unit1/angry_clip.mp4',
    3
FROM public.units u
JOIN public.books b ON u.book_id = b.id
WHERE b.book_number = 1 AND u.unit_number = 1
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SCHEMA YARATILISHI MUVAFFAQIYATLI YAKUNLANDI
-- =============================================================================
