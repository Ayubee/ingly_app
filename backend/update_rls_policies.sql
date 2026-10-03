-- =============================================================================
-- Ingly - Supabase RLS Fix for Admin Panel & Real-time Two-Way Sync
-- =============================================================================

-- 1. APP_SETTINGS: Admin panel va mobil ilova sozlamalarni bemalol o'qiy olsin va yangilay olsin
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow all on app_settings" ON public.app_settings;

CREATE POLICY "Allow all on app_settings" ON public.app_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);


-- 2. WORDS: Admin yangi so'z qo'shishi, tahrirlashi va ilova o'qishi uchun to'liq ruxsat
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view words" ON public.words;
DROP POLICY IF EXISTS "Allow all on words" ON public.words;

CREATE POLICY "Allow all on words" ON public.words
    FOR ALL
    USING (true)
    WITH CHECK (true);


-- 3. USERS: Admin panel foydalanuvchilar ro'yxatini ko'rishi va bloklashi uchun ruxsat
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Allow all on users" ON public.users;

CREATE POLICY "Allow all on users" ON public.users
    FOR ALL
    USING (true)
    WITH CHECK (true);


-- 4. REALTIME: Mobil ilova va Admin panel darhol bir-birini jonli eshitishi (Realtime) uchun
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.words;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- 5. ADMINS: Adminlarni boshqarish uchun RLS ruxsati
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view admins" ON public.admins;
DROP POLICY IF EXISTS "Allow all on admins" ON public.admins;

CREATE POLICY "Allow all on admins" ON public.admins
    FOR ALL
    USING (true)
    WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.admins;
