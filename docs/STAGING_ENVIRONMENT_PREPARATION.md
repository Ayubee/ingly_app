# Ingly staging environment tayyorgarligi

**Scope:** audit va repository-side tayyorlash. Production/staging Supabase'ga ulanilmadi; loyiha, Auth user yoki Super Admin yaratilmadi; SQL, migration, Edge Function/static deployment, commit/push bajarilmadi. Oldingi readiness ishining dirty fayllari saqlandi. Real `.env` fayllari o'zgartirilmadi, qiymatlari bu reportga kiritilmadi.

## 1. Oldingi konfiguratsiya: audit tasnifi

Tasnif: **A** environment-based; **B** production hardcoded; **C** development/local; **D** unsafe/ambiguous; **E** test-only. Tracked source, ignored real env fayllarining faqat nomlar/target belgilari, build/Expo/HTML/backend/test/documentation va ignored scratch daraxti tekshirildi. `.git`, dependencies, binary assets va build outputs source auditdan tashqarida; yangi build outputs alohida tekshirildi. Secret qiymatlari qayta chop etilmadi.

| Manba | Oldingi toifa | Audit va yakuniy holat |
| --- | --- | --- |
| `admin/public/auth.js` | B | Production URL/public key fixed; endi build-injected validated config. Auth/roles oqimi saqlangan. |
| `admin/index.html`, `admin/preview.html` | B/D | Takroriy production constants va umumiy localStorage; endi trusted Auth config + scoped storage + artifact environment badge. Connection modal read-only, project almashtirmaydi. |
| `mobile/src/services/supabaseClient.js` | A+D | EXPO_PUBLIC overrides, lekin missing field production fallback; endi validated config va fallback yo'q. |
| `mobile/src/services/authService.js` | A | Password reauth uchun vaqtinchalik ikkinchi SDK client asosiy client URL/key'idan oladi; endi shu explicit environment. PersistSession false, alohida target yo'q. |
| `mobile/src/services/storage.js`, `sessionCache.js`, `context/UserContext.js` | D | SDK auth key, global settings va account journal umumiy namespace; endi fizik storage boundary orqali environment/project izolatsiyasi. SessionCache/logout logical SDK key'lari saqlangan, scoped authStorage orqali o'qiladi. |
| `mobile/src/services/appSettingsService.js` | A/D | Asosiy SDK, umumiy cached settings va local mock transactions; storage wrapper endi hammasini scope qiladi. Secret-bearing backend client yo'q. |
| `mobile/src/components/PaymentModal.js`, `context/UserContext.js` | A | EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS + __DEV__ gate; production environment'da mock flag true konfiguratsiya rad qilinadi. Mock haqiqiy entitlement/finance backendga yozmaydi. |
| ignored `.env` | D/B | Known production URL, explicit APP_ENV yo'q, eski ADMIN_DEFAULT maydonlari bor. Qiymatlar o'zgartirilmadi; yangi client bularni default admin deb ishlatmaydi. Root env clientni avtomatik sozlash manbai emas. |
| ignored `mobile/.env` | A+D/B | Known production URL/public fieldlar, explicit APP_ENV/project pin yo'q. Endi shu fayl to'ldirilmaguncha config aniq fail qiladi. Agent uni staging'ga almashtirmadi. |
| `.env.example` | D | Default admin username/password misoli qolgan edi; olib tashlandi, client-specific placeholder templatesga yo'naltiriladi. Default credentials hech qayerda active qilinmadi. |
| `mobile/.env.example` | A, lekin to'liq emas | Endi APP_ENV/project-ref/local-HTTP/mock flag placeholders bilan to'liq. |
| `admin/vite.config.js`, `admin/package.json` | D | Mode environment targetini aniqlamas edi; endi mode va APP_ENV mosligi majburiy, build/development server bir contract bilan ishlaydi. |
| `mobile/app.json` | C/D | Bitta app/package identity; yangi `app.config.js` staging/development uchun alohida install identity va export-time validation beradi. Production app ID o'zgarmaydi. |
| `backend/supabase/functions/admin-accounts/index.ts` | A, server-only | SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY hosted runtime'dan; token getUser + profile/admin/permission server checks. O'zgartirilmadi, client keyga o'tkazilmadi. |
| `backend/supabase/config.toml` | C | project_id=ingly local CLI identifikatori, hosted project pin emas. verify_jwt=false handlerning getUser tekshiruvi bilan birga; authorization o'chirilmagan. |
| `vercel.json`, `netlify.toml` | D | Netlify raw admin publish qilardi; endi Vite artifact. Ikkalasi APP_ENV mode bilan build qiladi, missing/mismatched config fail qiladi. Hostingga o'zgarish yuborilmadi. |
| `tests/security-phase2.cjs`, `repair-phase3.cjs`, `admin-real-data.cjs`, `supabase-readiness.cjs` | E | SDK/RPC/storage mocks; explicit offline fixture dependency qo'shildi, security assertions saqlangan. Yangi environment suite real resolver/storage kodini fixture bilan tekshiradi. |
| `backend/*.sql`, `migrations/*.sql`, `tests/admin_real_data.sql` | Operator/server/E | SQL rollari/API function nomlari; client endpoint/key manbai emas. SQL fixture testi remote staging-only rollback, bu taskda bajarilmadi. |
| `docs/SECURITY_PHASE_2.md`, `REPAIR_PHASE_3_OFFLINE_SYNC.md`, `ADMIN_REAL_DATA_AUDIT_REPAIR.md`, `SUPABASE_MIGRATION_AND_ADMIN_BOOTSTRAP_READINESS.md`, backend/admin README, `SECURITY_AUDIT_REPORT.md` | Historical/operator docs | Oldingi fixed config/deploy taxminlari endi shu reportdagi model bilan yangilanadi. Documentation URL misollari runtime config emas. |
| ignored `scratch_repo/` | Non-shipped | Supabase config/client patternlari bo'yicha mos manba topilmadi; application/deploy entrypoint emas, o'zgartirilmadi. |

Repo tarixida eski template qiymatlari qolishi mumkin; ushbu ish git history rewrite yoki account password change qilmaydi. Ignored eski ADMIN_DEFAULT maydonlari ishlatilmaydi. Client repo'ga yangi secret kiritilmadi.

## 2. Environment modeli: oldin → keyin

**Oldin:** admin fixed production; mobile per-field production fallback; bir SDK/session/cache namespace; environment UI/config ajratilmagan.

**Keyin:** `shared/environment.cjs` barcha public clientlar uchun bitta validated contract. `development`, `staging`, `production` explicit. URL, public key, expected project-ref majburiy; default target/key yo'q. APP_ENV NODE_ENV yoki __DEV__ bilan tanlanmaydi. Runtime/browser build/Expo export bir contractni qo'llaydi.

- Hosted URL faqat `https://<20 lowercase alphanumeric project-ref>.supabase.co`; credentials/path/query/port/custom host rad qilinadi. Expected ref URL bilan aynan mos bo'lishi kerak.
- Known production **non-secret project reference** shared contractda faqat allow/deny guard bo'lib qoladi. Bu URL/key fallback emas. Development/staging uni qabul qilmaydi; production boshqa refni qabul qilmaydi. Production project ko'chsa guard alohida ko'rib chiqilgan kod o'zgarishini talab qiladi.
- `sb_publishable_` public key yoki `role=anon` JWT mumkin; hosted anon JWT ref ham targetga mos bo'lishi kerak. `sb_secret_`, service_role/authenticated JWT yoki placeholder rad qilinadi. Publishable key opaque: haqiqiyligini/ref mosligini lokal tekshiruv to'liq isbotlay olmaydi; live staging tekshiruvi zarur.
- Xato faqat configuration sababini aytadi; berilgan key/password/token qiymatini xabarga qo'shmaydi. Public config server authorization emas; RLS/Auth o'z kuchida.

## 3. Development va local foydalanish

Admin `admin/.env.example`ni ignored `admin/.env.development.local`ga private nusxalang va **production bo'lmagan** real development/staging project URL/ref/public key kiriting. `APP_ENV=development`; `cd admin` → `npm.cmd run dev`. Default Vite dev mode development bo'lgani sabab shu mode bilan APP_ENV mos bo'lishi kerak.

Local Supabase allaqachon operator tomonidan alohida tayyorlangan bo'lsa development uchun URL `http://127.0.0.1:54321` yoki `http://localhost:54321`, ref `local`, public anon/publishable key va `ALLOW_LOCAL_HTTP=true` mumkin. LAN/remote HTTP, boshqa port va staging/production HTTP rad qilinadi. Bu task local Supabase/Docker boshlamadi.

Mobile `mobile/.env.example` asosida ignored `.env.local`ni sozlaydi, EXPO_PUBLIC_APP_ENV=development va mos URL/ref/public key. Production qiymatli mavjud `mobile/.env`ga fall back bo'lmaydi; resolved qiymatlar to'liq/mos bo'lmasa export/startup fail qiladi. Haqiqiy local faylni agent o'zgartirmagan: operator explicit targetni o'zi tanlaydi.

Konfiguratsiya o'zgarsa Vite/Expo serverini qayta boshlang yoki artifactni qayta build qiling. Brauzer/project picker orqali runtime'da muhit almashtirish yo'q. __DEV__ faqat dev feature gate, environment tanlovi emas.

## 4. Admin staging/production

| Nomi | Ma'nosi |
| --- | --- |
| `APP_ENV` | development/staging/production; Vite mode bilan bir xil |
| `SUPABASE_URL` | Shu environment hosted HTTPS URL |
| `SUPABASE_PROJECT_REF` | Expected hosted project-ref, URL bilan aynan mos |
| `SUPABASE_PUBLISHABLE_KEY` | Public publishable yoki mos anon JWT; nomiga qaramay ikkala public format qo'llanadi |
| `ALLOW_LOCAL_HTTP` | Faqat development loopback uchun opt-in |

Staging template: `admin/.env.staging.example` → ignored `admin/.env.staging.local`; real staging public qiymatlar operator tomonidan to'ldiriladi. `cd admin` → `npm.cmd run build:staging`. Staging dev server: `npm.cmd run dev -- --mode staging`. Production uchun `admin/.env.production.example` → private deployment environment; APP_ENV=production va `npm.cmd run build`. Har mode uchun Vite base `.env`/`.env.local`ni ham o'qishi mumkin; missing field hech qachon koddagi production value bilan to'ldirilmaydi, project pin/mode mismatch fail qiladi. Shell/provider qiymatlari ustun kelishi mumkin: deploy config human review shart.

Vite `transformIndexHtml` har ikkala shipped HTMLga faqat allowlisted public config inject qiladi. `/environment.js` shared validatorni Vite dev middleware yoki build asset sifatida beradi; Auth uni synchronous ishlatadi. Classic script uchun Vite build warning bor, lekin asset emit bo'lishi va ikkala page mavjudligi artifact testida tekshirildi. Label `STAGING · project-ref`, `PRODUCTION · project-ref` yoki `DEVELOPMENT · project-ref`; static raw source label `CONFIG REQUIRED`. Badge server authorization o'rnini bosmaydi.

`admin/src/` alternate React panels ham mavjud `window.inglyAuth` helperga tayanadi; alohida fixed Supabase client topilmadi. Dashboard/Finance shared service shu environment clientidan RPC qiladi; `admin-accounts` invoke URL ham SDK targetidan hosil bo'ladi. Connection modal qiymatlari read-only, JWT'ni foydalanuvchi kiritgan URLga yuborish yo'q.

Raw `admin/index.html`ni file:// yoki oddiy static source sifatida ochish supported configured workflow emas va Auth client yaratilmaydi. Netlify endi `admin/dist`ni publish qilish uchun build configga ega; Vercel ham APP_ENV bilan mode tanlaydi. Provider environment variable va deploy ruxsati hali bajarilmagan.

## 5. Expo mobile staging/production

| Public variable | Ma'nosi |
| --- | --- |
| `EXPO_PUBLIC_APP_ENV` | Explicit target; export NODE_ENV uni almashtirmaydi |
| `EXPO_PUBLIC_SUPABASE_URL` | Target URL |
| `EXPO_PUBLIC_SUPABASE_PROJECT_REF` | URL target pin |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public publishable/anon key |
| `EXPO_PUBLIC_ALLOW_LOCAL_HTTP` | Development-only loopback opt-in |
| `EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS` | Existing __DEV__ gate; production true konfiguratsiya rad qilinadi |

Staging/production placeholder template'lar `mobile/.env.staging.example`, `mobile/.env.production.example`. Expo `.env.staging`ni APP_ENV asosida avtomatik tanlaydi deb o'ylamang; **NODE_ENV bilan target almashtirmang**. Eng aniq build yo'li: operator targetdagi public variable'larni process environment'da to'liq belgilaydi va `EXPO_NO_DOTENV=1` orqali eski `.env` yuklanishini o'chiradi, keyin local Expo commandni ishga tushiradi. Yoki development uchun standard `.env.local`dan foydalanadi va resolved targetni tekshiradi. EXPO_PUBLIC qiymatlar bundle ichida ochiq; secret bo'lmasligi kerak.

`mobile/src/services/environment.js` statik `process.env.EXPO_PUBLIC_*` dot notation ishlatadi; Expo inlining bilan mos. `app.config.js` build/export vaqtida ham contractni tekshiradi. Production `com.ingly.app`/Ingly saqlanadi; staging `com.ingly.app.staging`/Ingly (STAGING), development alohida suffix bilan. Native staging/production app yonma-yon o'rnatilishi mumkin; haqiqiy signing/install/device tekshiruvi hali kerak. `metro.config.js` faqat shared folderni root tashqarisidan ko'rishga qo'shadi; monorepo umumiy scan yoki yangi dependency yo'q.

## 6. Session, cache, outbox va moslik

Storage physical prefix:

| Target | Prefix |
| --- | --- |
| Production, reviewed project | `''` — oldingi namespace o'z joyida |
| Staging | `@ingly_env:staging:<project-ref>:` |
| Development | `@ingly_env:development:<project-ref-or-local>:` |

Prefix ostida mavjud `@ingly_account:<Auth UUID>:` logical namespace va Phase 3 journal/pages/outbox/sequence/epoch saqlanadi. Bu barcha AsyncStorage/local web adapter get/set/remove yo'llariga qo'llanadi: SDK session, account profile/progress/favorites/custom vocabulary/translation cache, global settings/language/dismissed announcements va mock local state. Orphan cleanup getAllKeys faqat tanlangan prefixni ko'radi; boshqa environment byteslarini o'chirmaydi. Production va staging'da bir xil UUID bo'lsa ham ma'lumot almashmaydi.

SDK logical `ingly_supabase_auth_v2` va `-user` key'lari o'zgarmadi, **authStorage fizik scope qiladi**. `sessionCache` va logout ham shu scoped adapterdan foydalanadi; staging production SDK cache'ini o'qimaydi. Admin SDK sessionStorage hamda barcha shipped HTML localStorage access'lari shared scoped browser adapter orqali. Existing forged role sessionlardan huquq olinmaydi. Account generation/stale response/receipt-ack logic o'zgarmagan.

Legacy production account-prefixed journal/queue o'z joyida va oldingi Phase 3 upgrade bilan o'qiladi. Staging/development'da unscoped old data/sessionga fallback/automatic migration yo'q. Ular keyin productionda ishlab chiqqan token/profile deb qabul qilinmaydi. Old buildlar manual non-production overrides bilan bir namespace ishlatgan bo'lsa, tarixiy bytes provenance aniq emas: private backup va operator review qilmasdan cross-project transfer/replay qilmang. Avtomatik barcha key rename/delete yozilmadi.

Client environment build/runtime uchun immutable; almashtirish yangi app/server restart/artifact talab qiladi. Cross-environment storage isolation Supabase Auth/RLS o'rnini bosmaydi, cached UI joriy server revocationni isbotlamaydi.

## 7. Env templates va gitignore

Hamma committed template placeholders only; haqiqiy email/password/service-role/JWT signing secret/DB credential yo'q. Root `.env.example` eski default-admin qiymatlaridan tozalandi; admin/mobile template'lariga yo'naltiradi. `.gitignore` `.env.*`ni ham ignore qiladi, `.env.example` va `.env.*.example`ni ataylab track qilishga ruxsat beradi. Real `.env`, staging/production `.local` va local migration plan outputs ignored ekanligi `git check-ignore` bilan tekshirildi. Existing real local env fayllarini o'zgartirish/print qilish bajarilmadi.

## 8. PLAN ONLY migration vositasi

Repo rootdan lokal reja chiqarish (REF placeholderni kelajakdagi real staging ref bilan operator almashtiradi):

```powershell
node backend/scripts/prepare-staging-plan.cjs --environment staging --project-ref YOUR_STAGING_PROJECT_REF --baseline existing
```

Bo'sh yangi loyiha uchun baseline `fresh`. Template literal placeholder valid hosted ref emas, shuning uchun to'ldirilmaguncha command rad etiladi. Tool explicit staging va 20-character non-production ref talab qiladi; unknown/apply/deploy flaglarni rad qiladi. Faqat local fayllarni o'qib, tartib va SHA-256 bilan JSONni stdoutga chiqaradi; filesystem output, DB/network/subprocess yoki credentials ishlatmaydi. `planOnly=true`, `targetVerifiedRemotely=false`, `executionApproved=false` yozilgan. Testda child process bilan faqat shu lokal plan CLI flag rad etilishi tekshirildi; toolning o'zi process bajarmaydi.

Existing baseline: preflight → Phase 2 → verifier → Phase 3 → phase-aware verifier → Admin Real Data → ikkala final verifier. Fresh baseline: schema.sql (Phase 2 embedded) → shu verifiers/Phase 3/Admin Real Data. First-admin operator script deploy/migration step sifatida avtomatik qo'shilmaydi.

Fayl dependency order SQL'dan qayta tekshirildi. Migration source nomlari o'zgartirilmadi. Duplicate date prefix uchun **kelajakdagi** unique mapping:

| Existing source | Taklif qilinadigan unique version |
| --- | --- |
| Phase 2 `20261005_security_phase2.sql` | `20261005000100` |
| Phase 3 `20261005_repair_phase3_offline_sync.sql` | `20261005000200` |
| Admin `20261006_admin_real_data.sql` | `20261006000100` |
| Fresh `schema.sql` baseline, faqat yangi DB | `20261005000000` |

Bu CLI history'ga yozilmadi va fayllar rename qilinmadi. Kelajakda owner history'ni tekshirib unique copies/mappingni alohida tayyorlaydi; fresh pathda Phase 2 qayta apply qilinmaydi. Mixed/raw `db push` yoki filename sortga ishonish mumkin emas. Manifest checksum fizik fayl byteslariga bog'liq; clone/EOL o'zgarsa deployment artifact uchun qayta hisoblanadi va review qilinadi.

## 9. REQUIRES MANUAL STAGING ACTION: kelajakdagi aniq workflow

1. Alohida staging loyiha/connection egasi tomonidan tayyorlanadi; bu task loyiha yaratmadi. Productiondan private user/Auth ma'lumotini ko'chirmang. Fresh baseline va zarur bo'lsa reviewed/sanitized legacy-shape baseline alohida sinalsin.
2. Dashboard project-ref, client expected ref va connection host mosligini tekshiring. Known production ref rad qilinsin; deploy target credentials hech qachon productiondan reuse qilinmasin.
3. DB connection uchun trusted direct `db.<staging-ref>.supabase.co`, TLS `verify-full` va zarur CA/role sozlamasi operator tomonidan tekshirilsin. Pooler ishlatilsa shared hostning o'zi yetarli emas: Dashboard connection va project-bound username tekshiriladi. Connection URL/password repo'ga yoki client configga qo'yilmaydi.
4. Local manifest **actual remote DB targetni isbotlamaydi**. `current_database()` odatda postgres, IP yoki session setting bilan project identityni isbotlab bo'lmaydi. Preflight read-only connection evidence qo'shildi; target fingerprint uchun Dashboard/host va operator check majburiy. SQL Editor'da ishlansa loyiha header/refini har bosqichda tasdiqlang.
5. Existing schema uchun preflight inventory, schema/constraints/grants/unknown SECURITY DEFINER/policy/trigger/legacy unique conflict review; backup/snapshot va restore rejasi. Fresh empty baseline uchun existing-table preflightni baseline oldidan bajarmang: u hali yo'q jadvallarni talab qiladi.
6. Migrationlar bittadan manifest tartibida, successful checksum/history qaydi va stop-on-error. Har fayl o'z BEGIN/COMMIT'iga ega; tashqi transactionga yana o'ramang. psql ishlatilsa `-X -v ON_ERROR_STOP=1`. Admin Real Data once-only; Phase 2ni Phase 3dan keyin yolg'iz qayta bajarmang.
7. Verifierlar va PostgREST schema cache/signature refresh tekshiruvi; failure bo'lsa productionga o'tmang. Oldingi committed migrationlar keyingi fayl fail qilishi bilan avtomatik rollback bo'lmaydi.
8. Faqat staging trusted Auth orqali normal test identity → profile trigger → RLS/user isolation. Keyin real staging operator email → confirmation/password setup → UUID/profile → approved operator first-admin bootstrap. Script default ROLLBACK, committed copy faqat alohida ruxsatlangan operator sessionda.
9. Staging-only `admin-accounts` Edge Function zarur bo'lsa alohida deploy; API host/function host/artifact label staging ekanini tekshiring. Normal/editor/moderator/super_admin haqiqiy token matrix; finance/analytics/configuration; offline-sync/session/device acceptance.
10. Hammasi PASS bo'lgach alohida production rollout/backup/client compatibility rejasini ko'rib chiqish. Hozir production migration/bootstrap/deploy uchun tasdiq yo'q.

Rollback: failing transaction ROLLBACK; unsafe eski anonymous/custom-auth grantlarini qaytarmang. Receipts/ledger/audit yoki user ID'larni ko'r-ko'rona delete/drop qilish yo'q. Forward correction yoki isolated staging restore; legacy mapping va backupdan keyingi yozuvlarni saqlash alohida operator qarori. To'liq failure tahlili oldingi readiness reportda.

## 10. Edge Functions va staging test data

Hozir repository'da bitta function: **admin-accounts**. Kelajakda alohida staging projectga explicit project-ref bilan deploy qilinadi; bu task deploy qilmadi. Server secret/config nomlari: **SUPABASE_URL**, **SUPABASE_SERVICE_ROLE_KEY** (hosted Supabase runtime). Clientga faqat shu projectning public key'i beriladi. No additional merchant/password/JWT secret talab qiladigan integration yozilmadi. Handler barcha bearerlarni getUser orqali tekshiradi; verify_jwt=false gateway settingi permission bypass emas.

Birinchi admin endpointdan yaratilmaydi: u mavjud adminni talab qiladi. `backend/operator_first_super_admin.sql` preserved: already verified email Auth UUID, matching unblocked profile, operator-only transaction, optional exact ownership-reviewed legacy admin row UUID, bitta authorization, audit va ROLLBACK default. Public make-admin RPC/default user/first-signup grant yo'q. `Joji` faqat manually verified display identity.

Test data strategy: faqat staging'da approved synthetic learners/progress va test/mock ledger entries, referencesga staging-test prefix, finance `environment=test|mock`. Development mock gate productionda true bo'lmaydi. Mock/manual transaction trusted provider purchase hisoblanmaydi; server totals environment va completed/source/is_purchase bo'yicha ajratilgan. Staging project ichidagi `environment=production` ledger branchini acceptance test bilan tekshirish mumkin, lekin bu alohida staging DB ichida va fixture rollback/clear strategiyasi bilan; haqiqiy production projectga yozish emas.

Existing `backend/tests/admin_real_data.sql` transaction-local synthetic Auth/finance fixtures va ROLLBACK qiladi. Uni faqat approved staging operator bajaradi; bu task bajarilmadi, real Auth signup/JWT REST testini almashtirmaydi. Production private data importi, real revenue yoki Click/Payme callback integration yo'q.

## 11. Staging acceptance matrix

| Sinov | PASS talabi |
| --- | --- |
| Config/artifact host | Missing/mismatched target rad; badge/config/actual Auth+REST+functions host staging; no production fallback/private key |
| Auth/profile | Real email/password/confirmation va kerak bo'lsa invite password setup; bitta matching UUID profil; normal signup admin emas; unique-conflict failure tushunarli |
| RLS/permissions | Anon/normal foydalanuvchiga admin/finance yo'q; A↔B privacy; blocked/inactive rad; editor/moderator explicit permission; super_admin authorized |
| Bootstrap | Existing confirmed UUID; operator ownership; dry run rollback; bitta linked active role; rerun rad; no public callable privilege grant |
| Phase 3 | Offline persistence/process kill, account switch, same-token owner changes, replay/receipt idempotency, old epoch/reset conflict, mid-batch atomik rollback |
| Analytics/config | Real Auth-linked population, canonical words, Uzbekistan day/week boundaries, honest unavailable, permission checks |
| Finance/mock | test/mock vs production environment totals ajratilgan; duplicate request/provider replay; void audit; unauthorized mutation rad; mock prod entitlement yo'q |
| Session/cache | Production/staging SDK/profile/outbox/settings/caches va two-stage-project izolatsiyasi; local logout tegishli namespace; stale responses boshqa accountga yozmaydi |
| Device/TLS | Android/iOS install identities, real HTTPS, airplane/slow/flapping internet, refresh/expired JWT/logout, termination/restart va queue integrity |

## 12. Lokal validation natijalari

| Check | Natija |
| --- | --- |
| Phase 1 regressions | PASS, mavjud assertions |
| Security Phase 2 | PASS, 9 guruh, JS/JSX/direct import/named-export checks ham |
| Repair Phase 3 | PASS, 31 case |
| Admin Real Data | PASS, 28 case |
| Readiness/bootstrap | PASS, 11 case |
| Environment isolation | PASS, 16 case, actual staging HTML/artifact tekshiruvi bilan |
| Node syntax / inline admin JSX | PASS |
| Admin `npm.cmd run build:staging` | PASS, ikkala HTML + validator/SDK helper/assets |
| Android Expo offline staging export | PASS, 665 modules, Hermes bundle 3.2 MB |
| iOS Expo offline staging export | PASS, 667 modules, Hermes bundle 3.2 MB |
| Admin HTML va ikkala Hermes artifact URL scan | PASS, fixture staging URL bor; known production URL yo'q |
| `git diff --check` | PASS; LF/CRLF Windows notices |
| Real remote SQL/Auth/RLS/Edge/browser/device | BAJARILMADI; manual staging acceptance |

Build/export uchun faqat public dummy fixture config process environment'da ishlatildi; haqiqiy staging loyiha/key yaratilmadi yoki ishlatilmadi. EXPO_NO_DOTENV=1 va offline mode bilan real `.env` import qilinmadi. Artifacts ignored lokal output, publish/install/deploy emas. Bundle size eski Phase 3 bilan rounded darajada bir xil; measured performance improvement claim qilinmaydi.

Boshlang'ich yangi testdagi ikkinchi staging fixture ref 21-character bo'lib qoldi; 20-character fixture bilan tuzatildi. Vite config bundlerining CJS dynamic fs importi createRequire boundary bilan, Metro shared file visibility watchFolders bilan tuzatildi; yakuniy build/export PASS. Existing suite assertions olib tashlanmadi: faqat yangi environment dependency uchun explicit offline mock fixture va browser storage property qo'shildi.

## 13. Fayllar va saqlangan scope

Ushbu staging taskda existing o'zgarganlar: `.env.example`, `.gitignore`, `admin/index.html`, `admin/preview.html`, `admin/public/auth.js`, `admin/vite.config.js`, `admin/package.json`, `mobile/.env.example`, `mobile/src/services/storage.js`, `mobile/src/services/supabaseClient.js`, `netlify.toml`, `vercel.json`, `backend/supabase_migration_preflight.sql`, `tests/security-phase2.cjs`, `tests/repair-phase3.cjs`, `tests/supabase-readiness.cjs`, admin/mobile/backend README va oldingi readiness reportga current-guide havolasi.

New: `shared/environment.cjs`; `mobile/src/services/environment.js`; `mobile/app.config.js`; `mobile/metro.config.js`; `admin/scripts/environment-config.cjs`; admin 3 env templates va mobile 2 env templates; `backend/scripts/prepare-staging-plan.cjs`; `tests/helpers/environment.cjs`; `tests/environment-isolation.cjs`; ushbu report.

Oldingi readiness taskdan kelgan migration/verifier/bootstrap/report fayllari saqlandi. Uch migration SQL, first-admin bootstrap va Edge handler ushbu taskda o'zgartirilmadi; preflightga read-only connection evidence qo'shildi. Auth credential/role protocol, RLS, Phase 3 sync engine/journal algorithm, account generation, payment server boundary saqlandi. Full Cinema/SRS/performance/UI redesign, dependencies install, production data yoki environment file rewrite yo'q.

## 14. Holat va keyingi qadam

**CONFIRMED IN CODE:** explicit environment contract, known-production guard, HTTPS boundary, mode/build validation, isolated browser/mobile SDK and local storage, preserved production legacy queue, separate staging native identifiers, no secret serialization, plan-only ordered checksum workflow, safe existing first-admin bootstrap va passing local suites/build/exports.

**REQUIRES MANUAL STAGING ACTION:** isolated project/connection va real public configuration, actual migration compile/constraints/grants, email/SMS/SMTP/redirect setup, verified owner/Auth UUID/bootstrap, staging Edge deploy, real JWT/RLS/finance/sync/browser/device acceptance. API public keyning haqiqiyligi, remote DB target, persisted historical data provenance va hosted secret ownership lokal resolver bilan isbotlanmaydi.

**PRODUCTION UNCHANGED:** remote production DB/Auth/functions/static hosting o'zgartirilmadi; real env fayllari saqlandi. Repository production build yo'li endi explicit konfiguratsiya talab qiladi, lekin ishlab turgan production deploymentga bu kod yuborilmadi. Ruxsatlangan production releaseni ko'rib chiqishdan oldin staging hamma gate'dan o'tishi kerak.

Keyingi aniq qadam: operator alohida staging loyiha/refini tasdiqlab, private public config templatesni to'ldiradi; target hostni tekshirib **read-only preflight + backup review** bilan kelajakdagi approved staging ishini boshlaydi. Ushbu tayyorgarlik task shu yerda tugaydi; deploy boshlanmaydi.

## 15. Rasmiy texnik manbalar

- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/): EXPO_PUBLIC statik dot notation, public bundle qiymatlari va export/NODE_ENV farqi.
- [Vite env and mode](https://vite.dev/guide/env-and-mode.html): mode-specific env va process precedence; runtime target mode bilan bir xil tushuncha emas.
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets): hosted server-only runtime secret nomlari; clientga service-role yuborilmaydi.
