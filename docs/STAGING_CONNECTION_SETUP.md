# Ingly Staging: birinchi ulanishdan oldingi tekshiruv

Holat: lokal staging konfiguratsiyasi va offline build/export tekshirilgan, remote bajarish ruxsati yo'q. Egasi staging ref `dkyrpciabqtnluitpafx`, unga mos HTTPS URL va publishable keyni taqdim etdi; remote loyiha/key validity tekshirilmagan. Production o'zgartirilmagan. Ushbu qo'llanmadagi remote SQL qadamlari kelajak uchun; hozir bajarilmagan.

## 1. PUBLIC sozlamalarni olish

Supabase Dashboard'da egasi alohida **Ingly Staging** yaratadi. Loyiha nomi va project ref'ni tekshiradi. **Connect** dialogida Project URL va publishable key olinadi; **Settings → API Keys** bo'limida publishable yoki mavjud legacy anon key tanlanadi. Project ref URL'dagi `https://<ref>.supabase.co` ichidagi `<ref>` va Dashboard `/project/<ref>` manziliga mos kelishi kerak. Bitta staging public key ikkala klientga yoziladi.

Manbalar: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Connect dialog / Project URL](https://supabase.com/docs/guides/api/creating-routes). Public key autentifikatsiya qilingan foydalanuvchi yoki admin huquqini bermaydi; Auth, RLS va server authorization alohida ishlaydi.

| Joy / klassifikatsiya | Aniq nom | Staging qiymati |
| --- | --- | --- |
| Admin, PUBLIC | `APP_ENV` | `staging` |
| Admin, PUBLIC | `SUPABASE_URL` | staging HTTPS Project URL |
| Admin, PUBLIC | `SUPABASE_PROJECT_REF` | staging ref |
| Admin, PUBLIC | `SUPABASE_PUBLISHABLE_KEY` | staging publishable yoki anon key |
| Admin, PUBLIC | `ALLOW_LOCAL_HTTP` | `false` |
| Mobile, PUBLIC | `EXPO_PUBLIC_APP_ENV` | `staging` |
| Mobile, PUBLIC | `EXPO_PUBLIC_SUPABASE_URL` | o'sha staging URL |
| Mobile, PUBLIC | `EXPO_PUBLIC_SUPABASE_PROJECT_REF` | o'sha staging ref |
| Mobile, PUBLIC | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | o'sha public key; nomiga qaramay publishable ham qabul qilinadi |
| Mobile, PUBLIC | `EXPO_PUBLIC_ALLOW_LOCAL_HTTP` | `false` |
| Mobile, PUBLIC | `EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS` | `false` default; `true` faqat dev-only lokal TEST/MOCK uchun |

Local verifier/checked build/plan shu ikki fayldan foydalanadi; yangi DB env talab qilmaydi. To'g'ridan-to'g'ri `prepare-staging-plan.cjs` argumentlari: `--environment staging --project-ref REF --baseline fresh|existing`; ular PUBLIC, env nomlari emas. `EXPO_NO_DOTENV=1` va `EXPO_OFFLINE=1` wrapper tomonidan qo'yiladigan PUBLIC build sozlamalari, loyiha identifikatori emas.

Kelajakdagi `backend/supabase/functions/admin-accounts/index.ts` hozir **`SUPABASE_URL`** (PUBLIC URL, server runtime'da ham ishlatiladi) va **`SUPABASE_SERVICE_ROLE_KEY`** (PRIVATE / SERVER-ONLY) o'qiydi. Service-role key faqat trusted Edge runtime'da; klient sozlash uchun talab qilinmaydi. DB password, service-role/secret key, JWT signing secret, Supabase access token va provider secrets hech qachon Admin/Mobile env, HTML yoki Expo `extra` ichiga yozilmaydi. DB operator ulanishi klient public key bilan bajarilmaydi. Bu task server credential so'ramaydi.

## 2. Alohida lokal env fayllari

Repository root'dan, faqat tegishli `.local` hali bo'lmasa:

```powershell
if (-not (Test-Path -LiteralPath admin/.env.staging.local)) {
  Copy-Item -LiteralPath admin/.env.staging.example -Destination admin/.env.staging.local -ErrorAction Stop
}
if (-not (Test-Path -LiteralPath mobile/.env.staging.local)) {
  Copy-Item -LiteralPath mobile/.env.staging.example -Destination mobile/.env.staging.local -ErrorAction Stop
}
```

**Avval mavjudligini tekshiring; mavjud faylga Copy-Item ishlatmang**, chunki u mavjud faylni almashtirishi mumkin. Fayllarni editor orqali qo'lda to'ldiring. `YOUR_*` placeholderlar haqiqiy config hisoblanmaydi. Mavjud root `.env` va `mobile/.env` ga tegmang. Real `.env*` fayllari Git tomonidan ignored; faqat `.example` commit uchun mo'ljallangan. Config public bo'lsa ham `.local` fayllar, DB connection/certificate materiallari, preflight output, backup va target-specific plan commit qilinmaydi. Backup va operator natijalarini repository tashqarisida saqlang; `backend/staging-plans/` ignored.

```powershell
git check-ignore admin/.env.staging.local mobile/.env.staging.local
npm.cmd --prefix admin run verify:staging
```

Muvaffaqiyatli chiqish (REF haqiqiy staging ref bilan almashtiriladi):

```text
STAGING CONFIG VERIFIED LOCALLY: REF
Admin + Mobile agree; HTTPS; public key only; production rejected; manifest verified.
No remote target/key validity check or migration approval.
```

Node.js 20.12+ kerak (`util.parseEnv`); joriy lokal tekshiruv Node 24 bilan bajarilgan. Verifier ikki aniq faylni o'qiydi; root/mobile eski env'dan fallback yo'q. Fayl yo'q, maydon bo'sh, placeholder, Production, noto'g'ri environment, HTTP, ref/URL nomuvofiqligi, secret/service-role key, kutilmagan env nomi, takroriy env assignment, shell/fayl yoki Admin/Mobile kelishmovchiligi bo'lsa exit 1. Env qiymatlari va key log qilinmaydi. `--force` yo'q. Publishable key formatidan qaysi loyihaga tegishli ekanini kriptografik isbotlab bo'lmaydi; Dashboard'dan aynan staging key nusxalanishi shart. Lokal PASS remote loyiha/key ishlashini tasdiqlamaydi.

## 3. Production guard va klient izolatsiyasi

`shared/environment.cjs` known Production ref'ni staging/development uchun rad etadi; literal URL/key fallback yo'q. Staging faqat canonical HTTPS hosted URL + mos ref bilan ishlaydi. Checked workflow ikkala klientni va inherited shell env'ni tekshiradi, HTTP flaglarini `false`, mock flagini aniq `true` yoki `false` talab qiladi. U env va manifest tekshiruvi o'tmasdan build/export boshlamaydi.

Staging mock opt-in Security Phase 2 simulatorini o'zgartirmaydi: `true` bilan ham payment runtime `__DEV__` talab qiladi, release Android/iOS eksportida simulator o'chiq. Mock VIP/book huquqi vaqtinchalik React state bo'lib, logout/account switch/restartda yo'qoladi; protected entitlement yoki cloud finance yozuvi yaratilmaydi. Lokal `mock: true`, `status: mock` tranzaksiyalar environment/ref/Auth UUID bo'yicha ajratiladi. Productionda mock `true` konfiguratsiya qat'iy rad qilinadi. Oldingi verifier HTTP va mock flaglarini bitta `false` sikliga qo'shgan; staging uchun bu ortiqcha cheklov edi. HTTPS, production, public-key, shell va manifest guardlari saqlangan.

Admin'da **STAGING · REF** badge build vaqtida chiqariladi. Bu ko'rinadigan build target; live database ulanishi yoki migration holatining isboti emas. Supabase `signInWithPassword` email/password → `getUser()` → `get_my_admin_access` → mos Auth UUID va server role → panel oqimi saqlangan. Username/Joji, lokal authority yoki bootstrap bypass yo'q. Raw HTML to'g'ridan-to'g'ri deploy qilinmaydi.

Mobile staging nomi **Ingly (STAGING)**, Android/iOS ID **`com.ingly.app.staging`**. AsyncStorage va Admin storage prefiksi `@ingly_env:staging:<ref>:`. Mobile account ma'lumotlari bunga `@ingly_account:<Auth UUID>:` qo'shadi. Auth session, account cache va Phase 3 journal/outbox boshqa environment/ref'dan o'qilmaydi; Production eski kalitlari va queue joyida qoladi. Global public settings environment/ref bilan ajratiladi. Supabase Auth/RLS, Finance authorization va payment mock chegaralari saqlangan.

## 4. Checkpoint 1–5: birinchi staging runbook

1. **Dashboard:** egasi alohida Ingly Staging'ni yaratadi/tasdiqlaydi; nom, ref, URL va key manbasini tekshiradi. Production ulangani bo'lsa STOP.
2. **Local verifier:** yuqoridagi ikki private fayl to'ldiriladi; `npm.cmd --prefix admin run verify:staging`. PASS bo'lmasa STOP. `npm.cmd --prefix mobile run verify:staging` xuddi shu ikkala faylni tekshiradi.
3. **Admin build:** quyidagi checked buyruq eski/env global ustuvorlik xatosini oldini oladi:

   ```powershell
   npm.cmd --prefix admin run build:staging:checked
   ```

   Ichki bajarish mavjud real-data generator + Vite `build --mode staging`; mavjud `npm.cmd --prefix admin run build:staging` ham saqlangan. `admin/dist/index.html` va `preview.html` ichida badge/refni tekshiring. Live Auth ishlatish bu bosqichda shart emas. Artifact deploy qilinmaydi.
4. **Mobile export:** checked wrapper explicit env beradi va Expo dotenv'ni o'chiradi; mavjud `mobile/.env` yuklanmaydi:

   ```powershell
   npm.cmd --prefix mobile run export:staging:android
   npm.cmd --prefix mobile run export:staging:ios
   ```

   Natija `mobile/dist/staging-android` va `mobile/dist/staging-ios`; eksport store build/install emas. Checked wrapper `--clear` bilan Metro transform keshini yangilaydi: oldingi eksportning inline `EXPO_PUBLIC_*` fixture yoki boshqa target qiymatlari qayta ishlatilmaydi. Keyingi real qurilma sinovi alohida staging identity talab qiladi. Oldingi tayyorgarlik taski fixture bilan faqat offline export bajardi.
5. **Read-only preflight:** egasi tanlangan staging ulanishini tasdiqlagach, quyidagi metadata inventarini qo'lda bajaradi va natijani review qiladi. Hozir SQL bajarilmagan. Checkpoint 5'dan keyin **STOP**; migrationga alohida ochiq owner ruxsati kerak.

## 5. Read-only preflight va backup/recovery gate

Yangi Supabase'da `auth`/`storage` platform jadvallari tabiiy ravishda mavjud. **Fresh** degani Ingly/custom application schema, Auth identity va Storage ma'lumotlari yo'q degani. `backend/supabase_fresh_preflight.sql` PostgreSQL 15+, Supabase Auth/roles, schemas, relation/column/constraint/function/policy/grant/trigger/publication/migration-history metadata'ni inventar qiladi. Extensionga tegishli platform objects application baseline sifatida olinmaydi. Existing application objects, Auth users, storage files yoki buckets topsa fresh yo'l STOP. Migration-history jadvali chiqsa, mazmuni operator tomonidan alohida read-only ko'riladi; generic script history formatini taxmin qilmaydi.

Eski, to'liq Ingly baseline bor staging uchun **`backend/supabase_migration_preflight.sql`** ishlatiladi. U baseline tables/columns/types/constraints/dependencies va UUID/admin linkage holatini tekshiradi. Bo'sh yoki qisman schema uchun ishlatilmaydi. Qisman/nomuvofiq baseline topsa migration o'rniga alohida review kerak.

**Dashboard orqali aniq keyingi bajarish:** Checkpoint 1–4 o'tgach, Ingly Staging Dashboard URL/ref'ni yana tasdiqlang → shu loyihaning **SQL Editor** bo'limini oching → mos preflight faylning to'liq mazmunini (BEGIN READ ONLY dan ROLLBACK gacha) yangi query'ga qo'ying → faqat shu query'ni bajaring → barcha result/error'larni private review uchun saqlang. Statementlarni alohida tanlab ishga tushirmang. Migrations/schema/bootstrap SQL bu query'ga qo'shilmaydi. Error bo'lsa transactionni rollback qiling va STOP; schema'ni tuzatish uchun remote write ruxsati bu qo'llanmadan kelib chiqmaydi.

`psql` muqobili: avval Connect dialogidan aynan staging direct yoki session-pooler host/user/port va server CA ni oling, projectga mosligini tekshiring. `psql -X -W --set=ON_ERROR_STOP=1 --dbname="host=STAGING_DB_HOST port=5432 dbname=postgres user=STAGING_DB_USER sslmode=verify-full sslrootcert=LOCAL_STAGING_CA_PATH" --file=backend/supabase_fresh_preflight.sql` (existing bo'lsa existing fayl). Barcha placeholder operatorning trusted connection qiymatlari bilan almashtiriladi. Password faqat interaktiv prompt'da; command/env klient fayliga kiritilmaydi. Pooler port/user Dashboard qiymatiga mos bo'lishi shart, hostname o'zi projectni isbotlamaydi. [Supabase psql/TLS yo'riqnomasi](https://supabase.com/docs/guides/database/psql). Hozir psql/Supabase CLI/Docker topilmadi, o'rnatilmadi.

Ikkala preflight **BEGIN READ ONLY / ROLLBACK**; SQL target loyihasini o'zi isbotlay olmaydi va PASS execution approval emas. Hozir tekshiruv SQL statement chegaralari/static invariantlar bilan cheklangan; PostgreSQL compilation va actual Auth/RLS remote tasdiq kutadi.

**Backup gate, migrationdan OLDIN:**

- **Tasdiqlangan fresh/empty staging:** saqlanadigan application/Auth/Storage ma'lumotlari yo'qligi preflight bilan tasdiqlanadi. Repo commit/checksum inventari, Auth/redirect/region/extensions sozlamalari va loyiha konfiguratsiyasini qayta yaratish rejasi yoziladi. Seed/schema shu tekshirilgan repo'dan qayta tiklanadi. Bo'sh loyihani qayta yaratish imkoniyati qayd etiladi; delete/recreate avtomatik ruxsat emas. Kim recovery uchun javob berishi va qabul qilinadigan downtime owner bilan kelishiladi.
- **Existing/populated staging:** schema o'zgarishidan oldin recoverable backup majburiy. DB schema/data, Auth kerakli holati, Storage fayllari/bucket sozlamalari va external konfiguratsiya uchun recovery qamrovi tekshiriladi; database backup Storage binary fayllarini o'zi saqlaydi deb taxmin qilinmaydi. Restore yo'li va backup mavjudligi review qilinadi; backup yo'q/restore noaniq bo'lsa STOP.

Bu task backup olmadi, remote ulanmagan.

## 6. Manifest va target-specific plan

```powershell
node backend/scripts/migration-manifest.cjs --verify
node scripts/staging-readiness.cjs plan fresh
# Existing baseline uchun: node scripts/staging-readiness.cjs plan existing
```

`backend/staging-migration-manifest.json` target-free (`projectRef:null`, `executionApproved:false`) lokal inventar. Uch migrationning haqiqiy yo'li va SHA-256, schema/preflight/verifier/operator fayllari checksumlari bor. Verifier expected inventory bilan missing/extra faylni, byte o'zgarishini, ordering va version mappingni tekshiradi. CRLF/LF o'zgarishi ham checksumni o'zgartiradi; manifestni avtomatik qayta yozib mismatchni yopmaydi. Reviewdan keyingi yangilash alohida local change sifatida qilinadi.

| Mantiqiy tartib | Original fayl | Kelajak uchun unique version mapping |
| --- | --- | --- |
| 1. Security Phase 2 | `backend/migrations/20261005_security_phase2.sql` | `20261005000100` |
| 2. Repair Phase 3 | `backend/migrations/20261005_repair_phase3_offline_sync.sql` | `20261005000200` |
| 3. Admin Real Data | `backend/migrations/20261006_admin_real_data.sql` | `20261006000100` |

Ikki original `20261005` prefix bir xil: **CLI automatic deployment uchun tasdiqlanmagan**. Mapping original nomlarni yoki deployed history'ni o'zgartirmaydi. Blind `db push` yo'q. Fresh yo'lda `backend/schema.sql` allaqachon Phase 2 ni o'z ichiga oladi (`20261005000000` taklif); undan keyin Phase 3 va Admin Real Data. Fresh schema'dan keyin Phase 2 ni yana qo'llash shart emas. Existing yo'lda uch migrationning o'zi tartib bilan qo'llanadi. Admin Real Data once-only; xatodan so'ng blind retry yo'q.

`plan fresh|existing` avval ikkala env faylni va manifestni tekshiradi, faqat JSON chiqaradi; SQL, auth, child process yoki remote ulanish bajarmaydi. Plan `targetVerifiedRemotely:false`, `executionApproved:false`. Expected direct DB hostname faqat tekshirish yordami; pooler ulanishi qo'lda tekshiriladi.

## 7. Checkpoint 6–14: faqat keyingi alohida owner ruxsatidan so'ng

6. **Phase 2 baseline:** backup gate + owner approvaldan so'ng existing uchun Phase 2; tasdiqlangan fresh uchun schema.sql (Phase 2 ichida). `verify_security_phase2.sql` bilan VERIFY va STOP/review.
7. **Phase 3:** migration → phase-aware `verify_security_phase2.sql`; VERIFY va STOP/review. Phase 3 dan so'ng Phase 2 ni yolg'iz qayta qo'llamang.
8. **Admin Real Data:** once-only migration → `verify_security_phase2.sql` + `verify_migration_readiness.sql`; VERIFY va STOP/review.
9. Oddiy staging test Auth identity → profile UUID / `auth.uid()` / RLS cross-account sinovlari. Hozir identity yaratilmaydi.
10. Egaga tegishli staging email Auth identity → tasdiqlangan email, profile linkage va blocked holati tekshiriladi.
11. Trusted operator `operator_first_super_admin.sql` ni reviewed UUID bilan ishlatadi; template ROLLBACK-default. Public bootstrap, username/password hash yo'q. COMMIT alohida tasdiq va review bilan.
12. Supabase email/password login → verified Auth user → server admin role; oddiy user va noto'g'ri role kirishi rad etilishi tekshiriladi.
13. Faqat staging `admin-accounts` Edge Function deployment; server credentials faqat runtime'da. Productionga deploy yo'q.
14. Real JWT role boundaries, Finance/Analytics, account/env sessions, slow internet/offline outbox/retry/idempotency/reset va logout QA. TEST/MOCK ledger Production bilan aralashmasligi tekshiriladi.

**Hozirgi STOP: Checkpoint 6 boshlanmaydi.** Checkpoint 1–5 kelajakdagi owner tasdiqlagan staging uchun; ushbu taskda remote read-only SQL ham bajarilmadi.

## 8. Oldingi tayyorgarlik taskining lokal natijalari va fayllari

| Tekshiruv | Natija |
| --- | --- |
| Phase 1 | PASS |
| Security Phase 2, JS/JSX syntax/import/named exports | PASS |
| Phase 3 offline/sync | 31 PASS, 0 FAIL |
| Admin Real Data | 28 PASS, 0 FAIL |
| Migration/bootstrap readiness, read-only SQL static checks | 11 PASS, 0 FAIL |
| Environment isolation, built Admin artifact | 16 PASS, 0 FAIL |
| Staging verifier/manifest/checked-command tests | 9 PASS, 0 FAIL |
| Local manifest SHA-256/order/inventory | PASS |
| Admin staging build, offline PUBLIC fixture | PASS |
| Android / iOS staging export, offline PUBLIC fixture | PASS; har biri taxminan 3.2 MB Hermes bundle |
| `git diff --check` | PASS |

Real config hali yo'qligi sababli joriy `npm.cmd --prefix admin run verify:staging` kutilgan exit 1 bilan `Missing admin/.env.staging.local ... No fallback` chiqaradi. Bu himoya ishlashini bildiradi; real staging tayyorligini bildirmaydi. Vite classic `/environment.js` script haqida bundling warning beradi; plugin faylni alohida asset sifatida chiqaradi, asset/badge/runtime testlari PASS. Bu task bundle hajmini kamaytirmadi; haqiqiy O'zbekiston mobil tarmoqlarida latency/offline/device QA hali bajarilishi kerak.

**CONFIRMED LOCALLY:** explicit env guards, local verifier, manifest checksum/order, Auth/server-authorization regressionlari, environment/account storage isolation, offline fixture Admin build va Android/iOS exports. Fixture haqiqiy staging credential emas; real `.env` fayllariga yozilmagan.

**REQUIRES OWNER TO CREATE STAGING PROJECT:** alohida loyiha yaratish va Dashboard nom/ref tasdiqlash.

**REQUIRES MANUAL STAGING CONFIG:** ikkala `.env.staging.local` ni haqiqiy PUBLIC qiymatlar bilan to'ldirish, staging target/key manbasini Dashboard orqali tekshirish. Publishable key validity, DB metadata, PostgreSQL compilation, actual Auth/RLS va qurilma/slow-network QA hali tasdiqlanmagan.

**NOT DEPLOYED:** remote SQL/migrations, Auth/first-admin provisioning, Edge Functions, hosting/store deployment, backup, commit/push bajarilmagan. Productionga tegilmagan.

Bu task fayllari: `scripts/staging-readiness.cjs`, `backend/scripts/migration-manifest.cjs`, `backend/staging-migration-manifest.json`, `backend/supabase_fresh_preflight.sql`, `backend/scripts/prepare-staging-plan.cjs`, ikkala klient package.json/staging example/README, backend README, `tests/staging-readiness.cjs`, `tests/environment-isolation.cjs`, `tests/supabase-readiness.cjs` va ushbu guide. Oldingi bosqichlardan qolgan dirty fayllar saqlangan; bu task ularni o'zining yangi o'zgarishi sifatida ko'rsatmaydi.

Oldingi taskdagi keyingi checkpoint staging project va PUBLIC konfiguratsiyasini olish edi. Hozirgi lokal natijalar quyida; migration ruxsati ulardan kelib chiqmaydi.

## 9. Joriy staging konfiguratsiyasi: 2026-10-06

`admin/.env.staging.local` va `mobile/.env.staging.local` egasi bergan staging URL/ref va bir xil publishable key bilan to'ldirildi. Key qiymati bu hujjatda yo'q. Ikkala fayl Git tomonidan ignored va tracked emas; eski root/mobile `.env` hamda production sozlamalari o'zgartirilmagan.

Mobile `EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS=true` saqlandi. Yuqoridagi dev-only simulator chegarasi, vaqtinchalik mock huquqlar, account/environment isolation va production mock taqiqi regressiya testlari bilan tekshirildi. Verifier HTTP uchun `false`, mock uchun aniq boolean talab qiladi; guardlar olib tashlanmadi.

- Admin va Mobile `verify:staging`: PASS.
- Admin `build:staging:checked`: PASS; ikkala HTML badge/config staging targetga mos. Vite classic `/environment.js` bundling warningi mavjud; alohida asset chiqishi tekshirildi.
- Mobile Expo config/runtime validator: PASS; Android/iOS identity `com.ingly.app.staging`, storage prefiksi staging/ref bo'yicha ajratilgan.
- Android/iOS checked offline export: PASS; har bir Hermes artifact ichida aynan berilgan staging URL/ref/public key tekshirildi, eski fixture va production URL yo'q. Birinchi export eski fixture transform keshini ishlatgani aniqlangach wrapperga `--clear` qo'shildi va ikkala export qayta yaratildi.
- Staging readiness: 10 PASS; yangi offline staging payments: 3 PASS; environment isolation: 16 PASS; Security Phase 2 regressiyalari PASS; Admin Real Data: 28 PASS.

Bu natijalar lokal validation/exportdir; real qurilma, live Auth/RLS yoki remote key validity tasdig'i emas. Remote SQL, migration, Auth user yaratish, Edge Function deploy, commit/push bajarilmadi. Keyingi checkpoint alohida ruxsat berilgan staging read-only preflight/review; hozir STOP, remote SQL/migration boshlanmaydi.
