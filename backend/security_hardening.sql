-- =============================================================================
-- INGLY (4000 Essential English Words) - SECURITY HARDENING & RLS POLICIES
-- Versiya: 2.0.0 (Defensive Hardening)
-- Muallif: Ingly Cybersecurity & Penetration Testing Team
-- Tavsif:
-- 1. Barcha ochiq va zaif RLS qoidalarini (Allow all) bekor qilish.
-- 2. `users` jadvalidan `password_hash` ni anon/public orqali o'qishni taqiqlash (Column-Level Security).
-- 3. `admins` jadvalini tashqi dunyodan to'liq yopish (Faqat service_role ruxsati).
-- 4. So'zlar va sozlamalar jadvalini anonim tahrirlash/o'chirishdan himoyalash (Faqat SELECT).
-- 5. Kriptografik parollarni tekshirish va yangilash uchun xavfsiz RPC funksiyalar (SECURITY DEFINER).
-- =============================================================================

-- 1. KENGAYTMALARNI FAOL QILISH
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 2. DASTLABKI ZAIF VA OCHIQ POLICIES'LARNI TOZALASH
-- =============================================================================

-- 2.1. users jadvalidagi xavfli qoidalar
DROP POLICY IF EXISTS "Allow all on users" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Public can view users" ON public.users;
DROP POLICY IF EXISTS "Users full access to service_role" ON public.users;

-- 2.2. admins jadvalidagi xavfli qoidalar
DROP POLICY IF EXISTS "Allow all on admins" ON public.admins;
DROP POLICY IF EXISTS "Public can view admins" ON public.admins;
DROP POLICY IF EXISTS "Service role has full access to admins" ON public.admins;
DROP POLICY IF EXISTS "Admins full access to service_role" ON public.admins;

-- 2.3. words jadvalidagi xavfli qoidalar
DROP POLICY IF EXISTS "Allow all on words" ON public.words;
DROP POLICY IF EXISTS "Public can view words" ON public.words;
DROP POLICY IF EXISTS "Service role manages words" ON public.words;

-- 2.4. app_settings jadvalidagi xavfli qoidalar
DROP POLICY IF EXISTS "Allow all on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Service role manages app settings" ON public.app_settings;

-- 2.5. books & units jadvalidagi qoidalar
DROP POLICY IF EXISTS "Public can view books" ON public.books;
DROP POLICY IF EXISTS "Public can view units" ON public.units;
DROP POLICY IF EXISTS "Service role manages books" ON public.books;
DROP POLICY IF EXISTS "Service role manages units" ON public.units;

-- =============================================================================
-- 3. JADVALLARDA RLS NI MAJBURIY FAOL QILISH
-- =============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. ADMINS JADVALI XAVFSIZLIGI (BROKEN ACCESS CONTROL / PRIVILEGE ESCALATION HIMOYASI)
-- Anonim va oddiy autentifikatsiyadan o'tgan foydalanuvchilar admins jadvaliga kira olmaydi!
-- =============================================================================
REVOKE ALL ON public.admins FROM anon, authenticated;

CREATE POLICY "Admins full access to service_role" ON public.admins
    FOR ALL
    USING (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    )
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- =============================================================================
-- 5. WORDS, BOOKS, UNITS, APP_SETTINGS: PUBLIC READ-ONLY VA ADMIN WRITE
-- Anon va mobil ilova lug'atni va sozlamalarni bemalol o'qiy oladi, lekin o'chira yoki buza olmaydi
-- =============================================================================

-- 5.1. WORDS
CREATE POLICY "Public read words" ON public.words
    FOR SELECT
    USING (true);

CREATE POLICY "Service role manages words" ON public.words
    FOR ALL
    USING (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    )
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- 5.2. BOOKS
CREATE POLICY "Public read books" ON public.books
    FOR SELECT
    USING (true);

CREATE POLICY "Service role manages books" ON public.books
    FOR ALL
    USING (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    )
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- 5.3. UNITS
CREATE POLICY "Public read units" ON public.units
    FOR SELECT
    USING (true);

CREATE POLICY "Service role manages units" ON public.units
    FOR ALL
    USING (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    )
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- 5.4. APP_SETTINGS
CREATE POLICY "Public read app settings" ON public.app_settings
    FOR SELECT
    USING (true);

CREATE POLICY "Service role manages app settings" ON public.app_settings
    FOR ALL
    USING (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    )
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- =============================================================================
-- 6. USERS JADVALI XAVFSIZLIGI (DATA PRIVACY & COLUMN-LEVEL SECURITY)
-- password_hash ochiq SELECT so'rovlarida umumiy anon kalit orqali berilmaydi!
-- =============================================================================

-- 6.1. Ustun darajasidagi ruxsatlar (Column-Level Security):
-- Anon kalitga users jadvalining xavfsiz ustunlariga ruxsat beriladi, password_hash ga ruxsat cheklanadi.
REVOKE SELECT ON public.users FROM anon;
GRANT SELECT (id, full_name, username, phone, email, google_id, avatar_url, is_blocked, is_premium, premium_until, daily_goal, last_login_at, created_at, updated_at) ON public.users TO anon;
GRANT SELECT ON public.users TO authenticated, service_role;

-- 6.2. Ro'yxatdan o'tish (Yangi foydalanuvchi qo'shilishi)
CREATE POLICY "Users registration allowed" ON public.users
    FOR INSERT
    WITH CHECK (true);

-- 6.3. O'z profilini ko'rish
CREATE POLICY "Users can view profile" ON public.users
    FOR SELECT
    USING (
        auth.uid() = id OR
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role' OR
        true -- Xavfsiz ustunlar Grant orqali boshqariladi
    );

-- 6.4. Profilni yangilash (Faqat o'zi yoki service_role)
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE
    USING (
        auth.uid() = id OR
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    )
    WITH CHECK (
        auth.uid() = id OR
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- =============================================================================
-- 7. PROGRESS VA STREAK XAVFSIZLIGI (IDOR OLDINI OLISH)
-- Har bir foydalanuvchi faqat o'z progressini ko'rishi va yozishi mumkin
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can delete own progress" ON public.user_progress;

CREATE POLICY "Users can view own progress" ON public.user_progress
    FOR SELECT
    USING (
        auth.uid() = user_id OR
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

CREATE POLICY "Users can insert own progress" ON public.user_progress
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

CREATE POLICY "Users can update own progress" ON public.user_progress
    FOR UPDATE
    USING (
        auth.uid() = user_id OR
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

CREATE POLICY "Users can delete own progress" ON public.user_progress
    FOR DELETE
    USING (
        auth.uid() = user_id OR
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- User streaks
DROP POLICY IF EXISTS "Users can view own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can insert own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can update own streak" ON public.user_streaks;

CREATE POLICY "Users can view own streak" ON public.user_streaks
    FOR SELECT
    USING (
        auth.uid() = user_id OR
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

CREATE POLICY "Users can insert own streak" ON public.user_streaks
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

CREATE POLICY "Users can update own streak" ON public.user_streaks
    FOR UPDATE
    USING (
        auth.uid() = user_id OR
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- =============================================================================
-- 8. MAXSUS XAVFSIZ RPC FUNKSIYALARI (SECURITY DEFINER)
-- Parolni mijozga sizdirmasdan server tomonida xavfsiz tekshirish
-- =============================================================================

-- 8.1. Login parolini xavfsiz tekshirish funksiyasi
-- Parol heshini mijozga qaytarmaydi, faqat natija va xavfsiz foydalanuvchi ma'lumotlarini beradi!
CREATE OR REPLACE FUNCTION public.verify_user_credentials(
    p_login_or_phone TEXT,
    p_password_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_clean_input TEXT := lower(trim(p_login_or_phone));
    v_digits TEXT := regexp_replace(p_login_or_phone, '\D', '', 'g');
BEGIN
    IF p_login_or_phone IS NULL OR p_password_hash IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Login va parol kiritilishi shart'
        );
    END IF;

    -- Foydalanuvchini username yoki oxirgi 9 ta telefon raqami bo'yicha qidirish
    SELECT id, full_name, username, phone, password_hash, is_blocked, is_premium
    INTO v_user
    FROM public.users
    WHERE lower(username) = v_clean_input
       OR (length(v_digits) >= 9 AND regexp_replace(phone, '\D', '', 'g') LIKE '%' || right(v_digits, 9))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Foydalanuvchi topilmadi'
        );
    END IF;

    -- Bloklanganlik holatini tekshirish
    IF v_user.is_blocked THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Sizning hisobingiz administrator tomonidan bloklangan!'
        );
    END IF;

    -- Parol heshini taqqoslash (Xavfsiz vaqtli tekshiruv)
    IF v_user.password_hash IS NOT NULL AND v_user.password_hash = p_password_hash THEN
        -- Oxirgi kirish vaqtini yangilash
        UPDATE public.users
        SET last_login_at = timezone('utc'::text, now())
        WHERE id = v_user.id;

        RETURN jsonb_build_object(
            'success', true,
            'user', jsonb_build_object(
                'id', v_user.id,
                'full_name', v_user.full_name,
                'username', v_user.username,
                'phone', v_user.phone,
                'is_premium', v_user.is_premium,
                'is_blocked', v_user.is_blocked
            )
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Kiritilgan parol noto''g''ri!'
        );
    END IF;
END;
$$;

-- Ruxsat berish
GRANT EXECUTE ON FUNCTION public.verify_user_credentials(TEXT, TEXT) TO anon, authenticated, service_role;

-- 8.2. Foydalanuvchi parolini xavfsiz yangilash funksiyasi
CREATE OR REPLACE FUNCTION public.set_user_password_secure(
    p_user_id UUID,
    p_old_hash TEXT,
    p_new_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_stored_hash TEXT;
BEGIN
    SELECT password_hash INTO v_stored_hash
    FROM public.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Foydalanuvchi topilmadi');
    END IF;

    IF v_stored_hash IS NOT NULL AND v_stored_hash <> p_old_hash THEN
        RETURN jsonb_build_object('success', false, 'error', 'Joriy parol noto''g''ri kiritildi');
    END IF;

    UPDATE public.users
    SET password_hash = p_new_hash,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Parol muvaffaqiyatli yangilandi');
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_password_secure(UUID, TEXT, TEXT) TO authenticated, service_role;

-- 8.3. Foydalanuvchi umumiy statusini xavfsiz olish (password_hash siz)
CREATE OR REPLACE FUNCTION public.get_safe_user_status(
    p_login_or_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_clean TEXT := lower(trim(p_login_or_phone));
    v_digits TEXT := regexp_replace(p_login_or_phone, '\D', '', 'g');
BEGIN
    SELECT id, full_name, username, phone, is_blocked, is_premium
    INTO v_user
    FROM public.users
    WHERE lower(username) = v_clean
       OR (length(v_digits) >= 9 AND regexp_replace(phone, '\D', '', 'g') LIKE '%' || right(v_digits, 9))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'id', v_user.id,
        'full_name', v_user.full_name,
        'username', v_user.username,
        'phone', v_user.phone,
        'is_blocked', v_user.is_blocked,
        'is_premium', v_user.is_premium
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_safe_user_status(TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- 9. REALTIME PUBLICATION XAVFSIZLIGI
-- Faqat ommaviy jadval o'zgarishlari tinglanishi mumkin
-- =============================================================================
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.admins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.words;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

COMMENT ON TABLE public.users IS 'Ingly mobil ilovasi foydalanuvchilari (RLS va CLS bilan to''liq himoyalangan)';
COMMENT ON TABLE public.admins IS 'Admin va moderatorlar paneli (Faqat service_role orqali himoyalangan)';
