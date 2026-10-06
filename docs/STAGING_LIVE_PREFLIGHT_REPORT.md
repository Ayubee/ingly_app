# Ingly Staging: birinchi live read-only preflight hisoboti

Sana: 2026-10-06, Asia/Tashkent.

**Qaror: NOT SAFE TO PROCEED. Live preflight SQL ulanishi yo'qligi sababli bajarilmadi.** Bu qaror bazada nuqson borligi haqidagi xulosa emas; remote dalil yetishmaydi. FRESH yoki EXISTING deb taxmin qilinmadi. Migration yoki bootstrap ruxsati berilmagan.

## 1. Target tekshiruvi

Remote ish boshlashdan oldin `npm.cmd --prefix admin run verify:staging` bajarildi: **PASS**.

| Lokal tekshiruv | Natija |
| --- | --- |
| Admin `APP_ENV` | `staging` |
| Mobile `EXPO_PUBLIC_APP_ENV` | `staging` |
| Project ref | `dkyrpciabqtnluitpafx` |
| Project URL | `https://dkyrpciabqtnluitpafx.supabase.co` |
| HTTPS va URL/ref mosligi | PASS |
| Admin/Mobile public-key va target mosligi | PASS; key qiymati oshkor qilinmadi |
| Known Production guard | PASS; lokal production ref rad etiladi |
| Lokal migration manifest | PASS |

Bu lokal konfiguratsiya tasdig'i. Ishlaydigan trusted SQL sessiyasi, remote loyiha identity va remote API key validity ushbu taskda tasdiqlanmadi. Productionga ulanilmadi va Production query bajarilmadi.

## 2. Ulanish holati va blocker

- Mavjud connected vositalar ichida staging Supabase/PostgreSQL SQL ulanishi yo'q.
- Supabase integratsiyasi katalogda mavjud, lekin o'rnatilgani yoki ulanganligi tasdiqlanmagan. Uni staging uchun ulash tavsiya qilindi.
- `psql`, Supabase CLI va Docker commandlari lokal PATH'da topilmadi. Hech biri o'rnatilmadi.
- Joriy process environment va tekshirilgan loyiha env fayllarida database ulanishiga oid variable nomlari topilmadi. Public client konfiguratsiyasi SQL katalogi yoki Auth inventarini o'qish uchun trusted operator ulanishining o'rnini bosmaydi.
- Credential, password, token yoki secret/service-role key so'ralmadi va hisobotga yozilmadi. Mavjud trusted SQL credential bo'lsa, faqat uning lokal saqlanish yo'li orqali davom etish mumkin.

**Live preflight: BLOCKED / NOT RUN. Stagingga remote so'rov yuborilmadi.** Ulanish bo'lmagani uchun remote target identity ham isbotlanmagan; SQL bajarishga o'tilmadi.

## 3. Remote baseline va Auth holati

| Talab qilingan kuzatuv | Haqiqiy holat |
| --- | --- |
| FRESH yoki EXISTING BASELINE | ANIQLANMAGAN |
| Auth user count/state | Kuzatilmadi; `0` deb qabul qilinmadi |
| Storage buckets/objects mavjudligi | Kuzatilmadi |
| PostgreSQL versiyasi, Auth structures va platform roles | Remote tekshirilmadi |
| Application/legacy/admin row holati | Kuzatilmadi |

Yangi Supabase loyiha yaratilganining o'zi empty database isboti emas. Auth identity yoki Storage ma'lumoti bo'lsa, application schema bo'shligining o'zi fresh recovery yo'lini tasdiqlamaydi.

## 4. Schema, security va migration inventari

Quyidagi jadval **topilgan remote obyektlar ro'yxati emas**. Bular hali trusted read-only natija talab qiladigan toifalardir.

| Toifa | Remote kuzatuv |
| --- | --- |
| Schemas, `public`/`ingly_private` relationlar, columns, sequences | Mavjudligi/natijasi noma'lum |
| Constraints, PK/UNIQUE/CHECK/FK va UUID linkage | Tekshirilmadi |
| Functions/RPC, overloadlar, owners, SECURITY DEFINER/search_path | Tekshirilmadi |
| Auth/public/storage triggers va dependency collisionlar | Tekshirilmadi |
| RLS enabled/forced holati, policies, table/column/function/schema/default grants | Tekshirilmadi |
| `supabase_migrations` obyektlari va haqiqiy applied history | Tekshirilmadi; history yozilmadi |
| `admins`, `admin_audit_logs`, admin RPC va admin linkage | Tekshirilmadi |
| `finance_ledger`, `finance_audit`, finance RPC | Tekshirilmadi |
| `learning_sync_*`, receipt/epoch/sequence va offline RPC | Tekshirilmadi |
| Supabase Realtime publication a'zolari | Tekshirilmadi |

## 5. Tasdiqlangan read-only preflight fayllari

Quyidagi lokal fayllar o'qildi, SHA-256 manifesti va static SQL boundary regressiyalari tekshirildi. SQL o'zgartirilmadi va remote bajarilmadi:

- `backend/supabase_fresh_preflight.sql`: `BEGIN READ ONLY` / `ROLLBACK`; platform Auth/role prerequisites, umumiy schema/relation/column/constraint/function/RLS/policy/grant/trigger/publication inventari, Auth va Storage bo'shligi hamda non-extension application objects guardlari.
- `backend/supabase_migration_preflight.sql`: `BEGIN READ ONLY` / `ROLLBACK`; to'liq existing Ingly baseline jadval/type/sequence/view/timestamp prerequisites, user/admin aggregate holati, duplicate groups, UUID linkage, function/policy/trigger/grant va Phase 3/finance obyektlari inventari.

Ulanish tasdiqlangach, umumiy inventar orqali baseline aniqlanishi kerak. Fresh preflight application obyektlar, Auth identities yoki Storage topib exception chiqarsa, bu fresh yo'liga STOP; exceptionni chetlab o'tish mumkin emas. Inventar full existing Ingly baseline borligini ko'rsatsagina existing preflight mos bo'ladi. Partial schema fresh ham, tayyor existing baseline ham deb hisoblanmaydi.

Fresh preflightdagi inventar yakuniy guardlardan oldin chiqadi. Exception bo'lsa, olingan metadata alohida review qilinishi va transaction ROLLBACK bilan yopilishi kerak; scriptni kesib yoki guardlarni olib tashlab davom etish mumkin emas. Transport barcha result/errorlarni saqlashi va failed transactionni yopishni kafolatlashi kerak.

Existing preflightning o'zi barcha schemas/migration-history/RLS flaglarini to'liq ko'rsatmaydi, columns/constraints ham asosiy to'rtta jadvalga qaratilgan. Talab qilingan umumiy katalog coverage'i uchun yuqoridagi keng inventar ham zarur. SQL coverage cheklovi aniqlanganda qo'shimcha remote query yoki SQL patch ushbu taskda avtomatik bajarilmadi.

## 6. Migration manifest

`node backend/scripts/migration-manifest.cjs --verify`: **PASS**. Actual lokal bytes, inventory, SHA-256 va logical ordering mos; supporting schema/preflight/verifier/operator fayllari ham mos.

| Tartib | Migration | SHA-256 | Kelajak uchun unique version |
| --- | --- | --- | --- |
| 1 | `20261005_security_phase2.sql` | `88fd6af71859538680d11111b34f6c7ef76a5a8999ed4a736894890d0badd87d` | `20261005000100` |
| 2 | `20261005_repair_phase3_offline_sync.sql` | `044543136b4bec06abf6b2677c1b950841b3991b3acd48c91120a1be842610a7` | `20261005000200` |
| 3 | `20261006_admin_real_data.sql` | `76dec4200b5fd0940fcf88bce95d74986e594a62754e4024660e2b8835c3d581` | `20261006000100` |

Birinchi ikki original faylning `20261005` prefixi takrorlangan. Mapping faqat taklif; migrations rename qilinmadi, remote history yozilmadi, automatic CLI deployment ruxsat etilmadi. Manifest `planOnly=true`, `projectRef=null`, `executionApproved=false`, `automaticCliDeploymentAllowed=false` bo'lib qoldi.

## 7. Security Phase 2 compatibility

**Actual remote database uchun compatibility tasdiqlanmadi.** Lokal static tahlil quyidagi prerequisites va review nuqtalarini ko'rsatadi:

- PostgreSQL 15+, Supabase Auth helpers/roles va to'qqiz Ingly jadvali: `users`, `admins`, `admin_audit_logs`, `user_progress`, `user_streaks`, `app_settings`, `books`, `units`, `words` talab qilinadi. Stats view, timestamp trigger function va catalog sequences ham mavjud/mos bo'lishi kerak.
- Phase 2 to'liq bo'sh DB'da standalone bootstrap emas: `ALTER TABLE public.users` va boshqa existing relationlarga bog'liq.
- `auth_user_id` oldindan mavjud bo'lsa, `ADD COLUMN IF NOT EXISTS` uning type/UNIQUE/FK definitionini tuzatmaydi. Actual constraint va UUID/FK holatini review qilish zarur.
- User/Auth UUID nomuvofiqligi, unlinked legacy rows, contact/username duplicate groups, qo'shimcha NOT NULL/default/CHECK constraintlar tekshirilmagan. Migration legacy identitylarni avtomatik link qilmaydi. `users_auth_identity_matches` NOT VALID bilan qo'shiladi; bu barcha eski rows mosligini isbotlamaydi.
- Existing `users.password_hash NOT NULL` Auth profile triggerini bloklashi mumkin; existing preflight buni STOP qiladi. Phase 2 faqat `admins.password_hash` NOT NULL ni olib tashlaydi. Ushbu remote holat bor deb taxmin qilinmadi.
- Migration eski RPC signaturelarini DROP qiladi, Auth triggerlarini almashtiradi, barcha tegishli policies va client table/column grantsni qayta quradi, ayrim private relationlarni Realtime publicationdan chiqaradi. Bular xavfsizlik uchun rejalangan remote o'zgarishlar; dependency/collision/backup review zarur. Top-level DROP TABLE/SCHEMA, TRUNCATE yoki DELETE topilmadi; bundan existing obyektlar uchun xavfsizlik xulosasi kelib chiqmaydi.
- Function signature/return type yoki owner mos kelmasa `CREATE OR REPLACE` muvaffaqiyatsiz bo'lishi mumkin. Existing dependencies, boshqa triggerlar va object ownership remote tekshirilmadi.
- Phase 3 yoki Admin Real Data allaqachon mavjud bo'lsa, Phase 2 ni ko'r-ko'rona qayta qo'llash keyingi security/RPC holatini o'zgartirishi mumkin. Applied baseline/historyni aniqlamasdan qayta migration tavsiya qilinmaydi.

Remote nuqson haqida dalil yo'q; actual moslik haqida ham dalil yo'q. Application arxitekturasi va migration SQL patch qilinmadi.

## 8. `schema.sql` yoki alohida Phase 2 bo'yicha qaror

Ushbu staging uchun aniq SQL tanlanmagan: baseline noma'lum. Lokal regressiya `backend/schema.sql` oxirida Security Phase 2 mavjudligini tasdiqladi.

| Kelajakda remote tasdiqlanadigan holat | Faqat keyingi alohida owner approvaldan so'ng yo'l |
| --- | --- |
| Haqiqiy FRESH, Auth/Storage/application baseline guardlari o'tgan | `backend/schema.sql`; unda Phase 2 allaqachon bor. Uning ortidan alohida Phase 2 ni qayta bajarish kerak emas. So'ng verification/review va alohida Phase 3, keyin Admin Real Data checkpointlari. |
| To'liq mos, Phase 2 hali qo'llanmagan EXISTING Ingly baseline | `backend/migrations/20261005_security_phase2.sql`; so'ng verification/review, Phase 3, Admin Real Data tartibi. |
| Partial/incompatible yoki allaqachon keyingi phase qo'llangan | STOP; applied holat, backup/recovery va qolgan o'zgarishlarni alohida review. `schema.sql` yoki Phase 2 ni avtomatik qayta qo'llash yo'q. |

Bu shartli yo'llar execution approval yoki ushbu bazaning tasnifi emas. **Hozir keyingi checkpoint uchun SQL/migration bajarishga tavsiya: YO'Q.**

## 9. Lokal regressionlar

Live ulanish bloklangan paytda mustaqil bajarish mumkin bo'lgan xavfsiz lokal tekshiruvlar yakunlandi. Ular remote preflightdan keyingi real-database verifikatsiyasining o'rnini bosmaydi.

| Buyruq | Natija |
| --- | --- |
| `npm.cmd --prefix admin run verify:staging` | PASS |
| `node backend/scripts/migration-manifest.cjs --verify` | PASS |
| `node tests/staging-readiness.cjs` | 10 PASS, 0 FAIL |
| `node tests/security-phase2.cjs` | PASS |
| `node tests/repair-phase3.cjs` | 31 PASS, 0 FAIL |
| `node tests/admin-real-data.cjs` | 28 PASS, 0 FAIL |
| `node tests/environment-isolation.cjs` | 16 PASS, 0 FAIL; optional artifact flag ishlatilmadi |
| `node tests/supabase-readiness.cjs` | 11 PASS, 0 FAIL; SQL boundary/static/mocked tekshiruvlar |
| `git diff --check` | PASS (`core.safecrlf=false` faqat buyruq warninglarini bosish uchun; Git config yozilmadi) |

SQL PostgreSQL'da compile/execute qilinmadi; actual RLS/grants/Auth natijalari noma'lum. Offline suite ichidagi fixture/mocked network calls real staging yoki productionga yuborilmagan.

## 10. Risklar, tavsiya va STOP

Asosiy blocker: targeti isbotlanadigan trusted staging SQL ulanishi va haqiqiy read-only inventar natijalari yo'q. Shu sabab Auth state, existing objects, collisionlar, legacy UUID/FK rows, RLS/policies/grants va migration history tekshirilmagan. Recoverable backup yoki tasdiqlangan empty recovery yo'li ham ushbu taskda olingani/tasdiqlangani yo'q.

Supabase integratsiyasini aynan `dkyrpciabqtnluitpafx` uchun ulash yoki trusted staging SQL ulanishini xavfsiz taqdim etish, so'ng targetni qayta tekshirib approved read-only preflightni davom ettirish kerak. Secret materialni chatga yoki repository hujjatiga yozish kerak emas. Faqat verified staging target ishlatiladi; production bilan remote solishtirish bo'lmaydi.

Ushbu taskdagi yagona yangi lokal fayl: `docs/STAGING_LIVE_PREFLIGHT_REPORT.md`. Oldindan mavjud dirty fayllar saqlandi; application env/code, SQL, migrations va manifest o'zgartirilmadi. Commit/push qilinmadi.

**REMOTE MUTATIONS: NONE. REMOTE QUERIES: NONE. PRODUCTION: UNTOUCHED. NOT SAFE TO PROCEED.**

STOP: hozir hech qaysi schema yoki migration bajarilmaydi. Keyingi ish live read-only inventarning o'zi; migration faqat uning natijalari review qilinib, keyingi checkpointga egadan alohida explicit approval olingandan keyin ko'rib chiqiladi.
