> **Security Phase 2:** Use [the deployment guide](../docs/SECURITY_PHASE_2.md). Existing projects apply only `migrations/20261005_security_phase2.sql`; fresh Supabase projects apply the complete `schema.sql`. There is no default admin/password. This schema requires Supabase Auth and PostgreSQL 15+. Vanilla PostgreSQL instructions below require a Supabase-compatible local environment.

> **Current Phase 3 mobile:** Both existing and fresh projects additionally need `migrations/20261005_repair_phase3_offline_sync.sql` after the Phase 2 baseline. See [the offline-sync report](../docs/REPAIR_PHASE_3_OFFLINE_SYNC.md); this migration has not been deployed or verified against a live database.

# Ingly - Backend & Ma'lumotlar Bazasi Arxitekturasi

Ushbu papkada **"Ingly - 4000 Essential English Words"** mobil ilovasi va Web Admin paneli uchun mo'ljallangan PostgreSQL / Supabase ma'lumotlar bazasi sxemasi (`schema.sql`) va sozlash qo'llanmasi joylashgan.

---

## 📁 Fayllar tarkibi

- [`schema.sql`](file:///d:/inglyJon/backend/schema.sql) — Barcha jadvallar, indekslar, RLS xavfsizlik qoidalari, triggerlar, saqlangan funksiyalar va seed data (6 ta kitob, 180 ta unit, boshlang'ich sozlamalar va namunaviy so'zlar).
- [`README.md`](file:///d:/inglyJon/backend/README.md) — Ushbu o'rnatish va foydalanish qo'llanmasi.

---

## 🗄️ Jadvallar tavsifi

| Jadval nomi | Tavsifi | Asosiy maydonlar |
| :--- | :--- | :--- |
| `users` | Mobil ilovaning barcha foydalanuvchilari | `id` (UUID), `full_name`, `phone`, `username`, `google_id`, `is_blocked`, `is_premium`, `premium_until` |
| `admins` | Web Admin paneli xodimlari (RBAC) | `id`, `username`, `role` (`super_admin`, `editor`, `moderator`), `permissions` (JSONB) |
| `books` | "4000 Essential English Words" kitoblari | `id`, `book_number` (1-6), `title`, `level`, `total_units`, `is_free`, `color_gradient` |
| `units` | Har bir kitob darslari (jami 180 ta) | `id`, `book_id`, `unit_number` (1-30), `title`, `total_words` (20) |
| `words` | So'zlar, tarjimalar va media havolalar | `id`, `unit_id`, `word`, `phonetic`, `uzbek_translation`, `definition_uz`, `example_uz`, `video_clip_url`, `image_url`, `audio_url` |
| `user_progress` | Spaced repetition o'rganish holati | `id`, `user_id`, `word_id`, `status` (`hard`, `review`, `mastered`), `review_count`, `next_review_date` |
| `user_streaks` | Kunlik olovcha (streak) va faollik | `id`, `user_id`, `current_streak`, `max_streak`, `last_activity_date`, `words_learned_today`, `daily_goal` |
| `app_settings` | Tizim sozlamalari (Feature flags) | `setting_key`, `setting_value` (JSONB): `ads_enabled: false`, `premium_mode_enabled: false` va h.k. |

---

## 🚀 1. Supabase loyihasiga yuklash (Tavsiya etiladi)

Supabase PostgreSQL asosida ishlaydi, shuning uchun sxemani yuklash juda oson:

1. [Supabase Console](https://supabase.com/dashboard) ga kiring va yangi loyiha (Project) yarating.
2. Chap menyudan **SQL Editor** bo'limiga o'ting.
3. **"New Query"** tugmasini bosing.
4. [`schema.sql`](file:///d:/inglyJon/backend/schema.sql) faylining barcha tarkibini nusxalang va SQL Editor oynasiga joylashtiring.
5. **"Run"** tugmasini bosing.
6. Sxema avtomatik ravishda:
   - 8 ta jadvalni yaratadi;
   - Triggerni sozlaydi (`updated_at` avtomatik yangilanishi uchun);
   - Indekslar va RLS qoidalarini faollashtiradi;
   - Book 1 dan Book 6 gacha 6 ta kitob va 180 ta dars (unit)ni bazaga yozadi;
   - Standart tizim sozlamalarini (`ads_enabled: false`, `premium_mode_enabled: false`) kiritadi;
   - Book 1 Unit 1 namunaviy so'zlarini saqlaydi. Admin faqat tasdiqlangan Auth identity orqali operator tomonidan yaratiladi.

---

## 🗄️ 2. Standart PostgreSQL ga yuklash (Lokal / VPS server)

Agar loyihani o'zingizning PostgreSQL serveringizda ishlatayotgan bo'lsangiz:

### `psql` buyruqlar satri orqali:
```bash
# Yangi ma'lumotlar bazasini yarating
psql -U postgres -c "CREATE DATABASE ingly_db;"

# Sxemani bazaga yuklang
psql -U postgres -d ingly_db -f schema.sql
```

### pgAdmin yoki DBeaver orqali:
1. `ingly_db` bazasiga ulaning.
2. **Tools -> Query Tool** (pgAdmin) yoki **SQL Editor** (DBeaver) ni oching.
3. `schema.sql` faylini ochib, barchasini ishga tushiring (Execute / F5).

---

## 📦 3. Supabase Storage (Fayllar xotirasi) sozlash

Ilova rasmlar, audiolar va kino lavhalarini yuqori tezlikda yuklab olishi uchun Supabase Storage da quyidagi 3 ta ommaviy (Public) bucket yaratish tavsiya etiladi:

1. **`words-images`** (WebP / PNG formatdagi so'z kartochkalari rasmlari)
2. **`words-audio`** (MP3 formatdagi talaffuz audiolari)
3. **`words-videos`** (MP4 formatdagi 3-5 soniyalik kino va serial parchalari)

> [!NOTE]
> Har bir bucket uchun **Public bucket** parametrini yoqing, shunda mobil ilova ularni to'g'ridan-to'g'ri CDN orqali tezkor o'qiy oladi.

---

## 🛡️ 4. Xavfsizlik (Row Level Security - RLS)

- **Kitoblar, darslar va so'zlar (`books`, `units`, `words`):** Barcha foydalanuvchilar va mobil ilova mehmonlari uchun `SELECT` (o'qish) huquqi ochiq. Tahrirlash faqat Admin / Service Role tomonidan amalga oshiriladi.
- **Foydalanuvchi ma'lumotlari (`users`):** Har bir foydalanuvchi faqat o'z shaxsiy hisobini ko'rishi va tahrirlashi mumkin (`auth.uid() = id`).
- **Progress va Streak (`user_progress`, `user_streaks`):** Foydalanuvchilar faqat o'zlarining progressi va olovcha ma'lumotlarini ko'rishlari va yangilashlari mumkin.
- **Adminlar paneli (`admins`):** RLS/permission checks bilan o'qiladi; privileged yozish faqat tekshirilgan server endpoint orqali.

---

## 🔑 5. Standart Super Admin ma'lumotlari

Standart admin yoki parol yo'q. Tasdiqlangan Supabase Auth hisobini operator DB orqali `admins.auth_user_id` ga bog'laydi. [Security Phase 2](../docs/SECURITY_PHASE_2.md) bootstrap bosqichlariga amal qiling.

---

## 🔄 6. Oflayn Sinxronizatsiya (Offline-first RPC)

Mobil ilova oflayn rejimda ishlaganda yig'ilgan natijalar internet paydo bo'lganda quyidagi RPC funksiya orqali bitta so'rovda serverga yuboriladi:

```typescript
// Supabase JS / React Native chaqiruvi:
const { data, error } = await supabase.rpc('sync_user_offline_progress', {
  p_sync_items: [
    {
      word_id: 1,
      status: 'mastered', // 'hard' | 'review' | 'mastered'
      reviewed_at: '2026-10-03T10:15:00Z',
      is_favorite: false
    },
    {
      word_id: 2,
      status: 'review',
      reviewed_at: '2026-10-03T10:16:30Z',
      is_favorite: true
    }
  ]
});

// Qaytuvchi javob:
// { "success": true, "synced_count": 2, "current_streak": 5, "max_streak": 7, "synced_at": "..." }
```
- **Nizolarni hal qilish (Conflict Resolution):** `Last-Write-Wins` — agar serverda mavjud vaqt kelayotgan vaqtdan eski bo'lsa, ma'lumot yangilanadi. Aks holda eskiroq oflayn ma'lumot bazadagi yangi ma'lumotni buzmaydi.
- **Streak yangilanishi:** Sinxronlangan so'zlar soniga mos ravishda foydalanuvchining kunlik faolligi va streak'i avtomatik qayta hisoblanadi.

# Repair Phase 3 offline synchronization

After the Security Phase 2 schema/migration, apply
`migrations/20261005_repair_phase3_offline_sync.sql` in an approved staging change.
Fresh installations also need this separate migration after `schema.sql`.
The migration is supplied, not deployed. It adds owned learning entities, reset
epochs, operation receipts and per-device/entity sequence checkpoints. Mobile
uses `read_learning_sync` and `sync_learning_operations`; the old non-idempotent
progress/activity RPCs lose client execution permission. Coordinate server/client
rollout, since old mobile versions will retain queued progress after RPC rejection.
See `../docs/REPAIR_PHASE_3_OFFLINE_SYNC.md` for conflict rules and verification.
