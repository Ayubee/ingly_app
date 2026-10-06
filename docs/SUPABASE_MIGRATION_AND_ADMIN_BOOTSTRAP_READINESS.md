# Supabase migratsiyalari va birinchi Super Admin: tayyorgarlik auditi

> Keyingi repository-side staging preparation explicit environment/config/storage modelini qo'shdi. Ushbu auditdagi oldingi fixed-production client taxminlari uchun [joriy staging report](STAGING_ENVIRONMENT_PREPARATION.md) ustuvor. Migration tartibi va operator bootstrap guardlari saqlangan; remote deployment hanuz bajarilmagan.

Holat: **repository tayyorlash; deploy uchun ruxsat emas**. Production yoki staging Supabase'ga ushbu ish davomida ulanilmadi. Hisob yaratilmagan, parol so'ralmagan, remote SQL bajarilmagan. Commit/push qilinmagan. Quyidagi remote amallar faqat kelajakdagi alohida ruxsatlangan operator ishidir.

## 1. Hozirgi holat va login sababi

Foydalanuvchi bildirgan Dashboard holati: production Authentication → Users bo'limida **0 hisob**. Bu agent tomonidan qayta so'ralgan remote natija emas. Shunday holatda eski `Joji` admini uchun Supabase Auth email/parol identifikatori mavjud emas va `Invalid login credentials` kutilgan natija.

`admin/index.html` va `admin/preview.html` → `admin/public/auth.js` → `signInWithPassword({email,password})` → server `getUser()` → `get_my_admin_access()` → panel. Auth xatosi rol tekshiruvigacha yuz beradi. Keyingi bosqichda RPC/profil/rol mavjud bo'lmasa `Admin authorization denied.` chiqadi va lokal Auth sessiyasi yopiladi. Faqat migratsiya bajarish Auth hisobini yaratmaydi.

Email/parol Supabase Auth tomonidan tekshiriladi. Legacy `password_hash`, `Joji` username, brauzerdagi rol yoki eski sessiya kirish huquqini bermaydi. `Joji` faqat tasdiqlangan display/username bo'lib qolishi mumkin.

## 2. SQL bo'yicha aniq tartib

### Mavjud Ingly bazasi (production nusxasi bilan staging)

1. Operator backup va schema/grant/function/trigger inventarini tekshiradi. `backend/supabase_migration_preflight.sql` — faqat o'qish, migration emas.
2. `backend/migrations/20261005_security_phase2.sql`.
3. `backend/verify_security_phase2.sql` — Phase 2 holatining faqat o'qish tekshiruvi.
4. `backend/migrations/20261005_repair_phase3_offline_sync.sql`.
5. `backend/migrations/20261006_admin_real_data.sql`.
6. `backend/verify_security_phase2.sql` va `backend/verify_migration_readiness.sql` — barcha bosqichlardan keyin.
7. Tasdiqlangan real Auth identity va birinchi admin bootstrap; haqiqiy JWT bilan staging testlari.

Har bir migration o'z `BEGIN`/`COMMIT` tranzaksiyasiga ega. Bittadan, xatoda darhol to'xtaydigan operator vositasi bilan bajaring; uch faylni yana bitta tashqi tranzaksiyaga o'ramang. Staging tasdiqlanganda `psql` ishlatilsa `-X -v ON_ERROR_STOP=1` kerak. Bajarilgan fayl nomi, revision/checksum va natijani tashqi deploy qaydida saqlang.

### Bo'sh yangi Supabase staging bazasi

1. `backend/schema.sql` — bazaviy obyektlar/seeds va ichiga kiritilgan aynan shu Phase 2 SQL.
2. Alohida Phase 2 faylini yana bajarish kerak emas.
3. Phase 3 → Admin Real Data → ikkala verifier → Auth/bootstrap va JWT testlari.

`schema.sql` yangi bo'sh baza uchun. Mavjud bazada qayta bajarish settings/kitoblarni seed bilan qayta yozishi, namunaviy so'zlarni ko'paytirishi va oldingi siyosatlarni qayta yaratishi mumkin. U production upgrade/rollback vositasi emas.

Fayllar `backend/migrations` ichida; Supabase CLI standart `supabase/migrations` deploy to'plami avtomatik sozlanmagan. Ikki migration prefiksi bir xil `20261005`. Ularni Supabase CLI'ga ko'r-ko'rona ko'chirish/`db push` qilish mumkin emas: avval noyob version identifikatorlari, aniq tartib va mavjud migration history bilan mapping kelajakda alohida tayyorlanadi. Hozir nomlar o'zgartirilmadi.

## 3. Bog'liqliklar va sxema taxminlari

| Bosqich | Oldindan kerak bo'lgan obyektlar | Yaratadi/o'zgartiradi |
| --- | --- | --- |
| Phase 2 | Supabase `auth.users`, `auth.uid()`, Auth rollari; PostgreSQL 15+; `users`, `admins`, `admin_audit_logs`, `user_progress`, `user_streaks`, `app_settings`, `books`, `units`, `words`; `v_user_stats`, `trigger_set_timestamp()`, uch content serial sequence | Auth UUID bog'lanishlari, identity CHECK, private authorization helpers, `get_my_admin_access`, profil/contact triggerlari; eski signature'larni olib tashlash; RLS/grantlarni qayta o'rnatish, private Realtime publication'dan chiqarish |
| Phase 3 | Phase 2 `ingly_private.active_account()`, Auth-linked profil, progress/streak/users/words; Phase 2 eski RPC signature'lari revocation uchun | To'rtta `learning_sync_*` jadval, `merge_learning_state`, `read_learning_sync`, `sync_learning_operations`; eski progress/activity RPC client ruxsatlarini bekor qiladi |
| Admin Real Data | Phase 2 `has_permission`; Phase 3 `learning_sync_entities` va `learning_sync_receipts`; users/admins/Auth/progress/settings/audit bazasi | Catalog, activity days/state, finance ledger/audit; receipts trigger; dashboard/configuration/finance RPC'lari, service-only provider helper |

Muhim bazaviy contract: `users.id`, `admins.id` UUID; `users.password_hash` nullable; admin legacy hash ustuni mavjud (Phase 2 nullable qiladi); `users.username`, kontaktlar va `admins.username`/email unique; progress `(user_id,word_id)` va streak `user_id` unique; `daily_goal` CHECK 5..100; normal boolean/defaultlar; profile/progress/audit ustunlari checked-in schema bilan mos. Faqat jadval nomi mavjudligi yetarli emas. Preflight required ustun/turlarni tekshiradi va barcha constraint/defaultlarni operatorga ko'rsatadi. Schema drift avtomatik tuzatilmaydi.

Fresh schema to'liq 3600 DB so'zlarini import qilmaydi. Admin catalog esa mobil bundle'dagi 1..3600 ID xaritasidan tuzilgan. Haqiqiy DB content ID ↔ bundle mosligini staging'da tekshiring; noto'g'ri mavjud word ID legacy mirror/statistikaga noto'g'ri mos tushishi mumkin. Phase 3 DB'da yo'q word FK uchun sync entity'ni saqlaydi, mirror'ni o'tkazib yuboradi.

## 4. Qayta bajarish va migration xavflari

| Xavf | Amaldagi holat va xavfsiz yo'l |
| --- | --- |
| Phase 2 qayta bajarilishi | Ko'p obyektlar `IF NOT EXISTS`/`CREATE OR REPLACE`; siyosatlar o'chirib qayta yaratiladi. Ammo Phase 3'dan keyin Phase 2 yolg'iz qayta bajarilsa eski non-idempotent RPC client ruxsatlari yana beriladi. Qayta qo'llash oddiy xavfsiz retry emas; aniq bosqich/history va Phase 3 yakuniy ruxsatlari tekshirilsin. |
| Mavjud `auth_user_id` ustuni | `ADD COLUMN IF NOT EXISTS` mavjud ustunning turini, UNIQUE yoki FK'sini tuzatmaydi. Preflight constraint inventari va final verifier orqali haqiqiy UUID/UNIQUE/Auth FK tekshiriladi. Yetishmasa deploy to'xtaydi; alohida ko'rib chiqilgan correction kerak. |
| Legacy identity CHECK | `NOT VALID` eski qatorlarni darhol tekshirmaydi, yangi/tahrirlangan qatorlarni tekshiradi. `id<>auth_user_id` qatorlar staging gate hisoblanadi. CHECK definition ham ko'rib chiqilsin: nomning o'zi to'g'ri qoida kafolati emas. Tasdiqlangan mapping tozalangach, operator alohida `VALIDATE CONSTRAINT` rejalaydi. |
| Legacy unique kontakt/username | Yangi Auth INSERT profil triggerida mavjud username/email/phone bilan to'qnashishi mumkin. Trigger xatosi Auth yaratishni ham to'xtatadi. Oldindan ownership va collision inventari; avtomatik merge/delete yo'q. |
| Eski user UUID | `public.users.id` tasodifiy legacy UUID bo'lsa, faqat `auth_user_id` qo'shish identity CHECK'ga zid. FK'lar `ON DELETE CASCADE`, oddiy ID almashtirish uchun `ON UPDATE CASCADE` yo'q. Ownership tasdiqlangan alohida data mapping kerak. |
| Phase 3 qayta bajarilishi | To'rtta jadval `IF NOT EXISTS`; function replace va policy recreation bor. Shu audit column grantlarni ham bekor qiladi va barcha additive policy'larni olib, owned policy'ni qayta yaratadi. Bu noma'lum mavjud table shape/constraintni tuzatmaydi; reviewed staging schema talab qilinadi. |
| Admin Real Data qayta bajarilishi | Qasddan once-only: `CREATE TABLE`, `CREATE INDEX`, `CREATE FUNCTION`, `CREATE TRIGGER` bor. Bajarilgan faylni takrorlash duplicate object bilan yiqiladi. Barcha obyektlarni `IF NOT EXISTS` qilish xatoni yashirishi mumkin; bunday o'zgartirish qilinmadi. |
| Noma'lum SECURITY DEFINER | Phase 2 faqat beshta ma'lum eski signature'ni olib tashlaydi. Boshqa overload/remote RPC qolishi mumkin. Preflight va verifier barcha public/private privileged function'larni inventar qiladi; noma'lum function/grant/owner operator tomonidan tekshirilmaguncha production gate yopiq. |
| Grants/default privileges | Phase 2 default privilege'lari uni bajaruvchi owner'ga tegishli. Boshqa owner/default grantlar yoki inherited role'lar audit qilinadi. `PUBLIC EXECUTE` function defaultidir; explicit REVOKE va haqiqiy effective grants majburiy. |
| Policy/publication o'chirilishi | Phase 2 mavjud 9 jadval siyosatlari/grantlarini almashtiradi va private realtime jadval subscription'larini to'xtatadi. Policy DROP ma'lumot DELETE emas, lekin eski clientlarni buzishi mumkin. Noma'lum integratsiyalar inventory qilinsin. |
| DROP FUNCTION dependencies | Ma'lum eski functionga boshqa obyekt bog'langan bo'lsa, migration CASCADE ishlatmasdan xato beradi. Xato yashirilmaydi; dependencies staging'da yechiladi. |

Uch migrationda top-level `DROP TABLE`, `TRUNCATE`, bulk ma'lumot DELETE yoki auth/account seed yo'q. Phase 3 reset RPC ichidagi DELETE faqat tekshirilgan caller hisobining learning/progress/streak ma'lumotlari uchun; bu migration paytida bajariladigan delete emas. Receipt/version dedup ma'lumotlarini rollback bahonasida o'chirmang.

## 5. Security Phase 2 identity va sessiya

`auth.users.id = public.users.id = public.users.auth_user_id = public.admins.auth_user_id`.

**`public.admins.id` alohida PK**, uni Auth UUID'ga almashtirmang. `admin_audit_logs.admin_id` unga bog'langan. Admin display username Auth login emas.

`get_my_admin_access()` caller `auth.uid()` bo'yicha mos profilga JOIN qiladi, active admin va unblocked user talab qiladi. `has_permission` super_admin'ga rol orqali huquq beradi; boshqa rollarda aniq JSON array permission tekshiriladi; `manage_admins` faqat super_admin uchun. Oddiy client profil/admin/entitlement yozuvini o'zi yarata olmaydi, privileged ustunlarni o'zgartira olmaydi. RLS va cheklangan column grants serverda qo'llanadi. Content/public settings allowlist va caller-owned progress alohida.

Profil yaratish triggeri `NEW.id` bilan mos oddiy user yaratadi, **admin yaratmaydi**. User metadata'dagi `role`, `is_premium`, admin talablaridan huquq olinmaydi. Contact sync Auth kontaktidan keladi. Eski hashlar aktiv Auth yo'li emas; mavjud bazadagi hash saqlanishi alohida backup/retention masalasi, bu vazifada hash ko'chirilmaydi/yangi hash yaratilmaydi.

Admin SDK sessiyasi `sessionStorage` va `ingly_admin_auth_v2` kalitida; eski admin/user credential cache'lari tozalanadi. Rol localStorage orqali tasdiqlanmaydi. SDK `getUser` va RPC huquq manbai. `signOut({scope:'local'})` joriy browser sessiyasini tugatadi; barcha boshqa qurilmalar/global token revocation kafolati emas. Auth o'zgarishlari panelni qayta tekshiradi. Account-switch/stale response himoyasi existing Phase 2/3/real-data testlarida saqlangan.

## 6. Birinchi legitimate Super Admin: kelajakdagi operator tartibi

1. Faqat tasdiqlangan staging'da baseline/migrations/verifierlar o'tgach boshlang. `admin-accounts` endpointi avvaldan admin talab qiladi; u **birinchi** adminni bootstrap qila olmaydi va buning uchun o'zgartirilmaydi.
2. Egasi nazorat qiladigan real email uchun **bitta** Supabase Auth hisobini Dashboard Authentication vositalari yoki alohida tasdiqlangan Auth jarayoni orqali yarating/taklif qiling. `auth.users`ga qo'lda INSERT yozmang. Parolni egasi faqat ishonchli Supabase/password setup oqimida belgilaydi; agentga, SQL'ga, repository'ga bermaydi.
3. Invite yo'li tanlansa email yetkazilishi, Site URL/redirect allowlist va ishlaydigan password setup oqimi oldindan tekshirilsin. Hozirgi admin login formasida invite/recovery password o'rnatish UI'si yo'q. Invite yuborishning o'zi email+password login tayyor degani emas; bu yo'l testdan o'tmaguncha tayyor deb hisoblanmaydi. Confirmation flag'ni bevosita SQL bilan soxtalashtirmang.
4. Ishonchli Dashboard/Auth mexanizmidan UUID oling va operatorning email ownership'ini tasdiqlang. `email_confirmed_at`, Auth ban/delete holati va password provider login qobiliyati tekshirilsin. Username/email mosligi yolg'iz ownership dalili emas.
5. Trigger `public.users.id=auth_user_id=Auth UUID` bilan bitta profil yaratganini, email Auth bilan mosligini va `is_blocked=false` ekanini tekshiring. Profil yo'q bo'lsa bootstrap **to'xtaydi**: trigger error/log/default/unique conflictni tuzating. Triggerdan oldingi Auth uchun faqat ishonchli operator ownership asosida mos profilni alohida ko'rib chiqilgan transactionda provision qiladi; random legacy UUID'ni ko'r-ko'rona linklamaydi.
6. `backend/operator_first_super_admin.sql`ning **private operator nusxasida** `verified_auth_uuid := NULL`ni tasdiqlangan UUID bilan almashtiring. Yangi admin authorization uchun legacy ID NULL qoladi; ownership tekshirilgan eski Super Admin saqlansa uning aniq `admins.id` UUID'si beriladi. Haqiqiy email source'ga kiritilmaydi; SQL emailni verified Auth yozuvidan oladi.
7. Shablon faqat `postgres` DB operatorini qabul qiladi, public RPC yaratmaydi, linked Super Admin yoki shu identity admini mavjud bo'lsa to'xtaydi. Admin jadvaliga lock, confirmed/unblocked/matching identity guardlari, unique conflict abort va audit bir transaction ichida. Legacy admin ID/display va audit FK saqlanadi. Standart yakun **ROLLBACK**, demak copy o'zgarishsiz sinab ko'rish ham permanent grant bermaydi.
8. Staging dry run va operator ko'rigi o'tgach, faqat alohida ruxsatlangan private nusxada yakuniy ROLLBACK → COMMIT qilinadi. Shablon migration papkasiga/deploy avtomatiga ko'chirilmaydi. Keyingi ishga tushirish linked Super Admin sababli fail qiladi; recovery boshqa operator protsedurasi talab qiladi. Permanent bootstrap function/backdoor qolmaydi.
9. Owner panelda **real email + Supabase Auth parol** bilan kiradi. `getUser` UUID va `get_my_admin_access` natijasi shu identity uchun `super_admin`, active/unblocked bo'lishi kerak. Operator SQL ichida auth.uid claims'ini soxtalashtirib tekshirish haqiqiy Auth login o'rnini bosmaydi.

Bu shablon Auth hisobini/profilni yaratmaydi, password/hashga yozmaydi, tekshirilmagan identity'ni avtomatik tanlamaydi. **Ownership operator tomonidan SQL'dan oldin tasdiqlanadi**; scriptning UUID guardi shaxsning o'zini mustaqil isbotlamaydi.

## 7. Legacy `Joji` va ma'lumotlarni saqlash

Remote legacy qatorlar o'qilmadi; aniq mavjudligi/soni/owner'i tasdiqlanmagan. `Joji` seed yaratilmaydi. `admins`da legitimate eski Super Admin bo'lsa, ownership tekshirilib, aynan row UUID bo'yicha auth_user_id link qilinadi; admin PK va audit tarixini saqlash yangi duplicate authorizationdan afzal. Eski username/password login qaytmaydi.

Legacy `public.users` boshqa UUID bilan mavjud bo'lsa yangi Auth profilidan alohida qoladi. Progress/streak va boshqa FK'larni yo'qotmaslik uchun backup + to'liq FK inventory + ownership mapping + conflict reconciliation asosidagi **alohida tasdiqlangan data migration** kerak. Bu vazifada avtomatik rekey/merge/delete yo'q. Username/email/phone unique collision'ini oldindan operator ko'rib chiqadi: kontaktni shunchaki o'chirish, boshqa odamga tegishli profilni egallash yoki username bo'yicha privilege berish mumkin emas. Mapping dalillari/backup haqiqiy PII bilan bo'lsa private operator tizimida saqlanadi, repo'ga qo'yilmaydi.

## 8. Kodda xavfsiz tuzatishlar

- Ikkala shipped HTML login: `type=email`, `inputMode=email`, credential autofill, Uzbek invalid-format xabari va eski username qo'llanmasligi haqida qisqa izoh. Auth xatolari account existence lookup bilan almashtirilmadi.
- Phase 2 read-only verifier endi Phase 3 borligini tekshiradi va retired RPC'lar ruxsati **bekor qilingan** bo'lishini talab qiladi; qisman Phase 3 holatini rad etadi.
- Phase 3 migration reviewed rerun'da column grantlar va additive policy'lar qolishiga yo'l qo'ymaydi. `daily_goal` clamp 1..500 o'rniga schema CHECK'iga mos **5..100**: valid 10/20/30 behavior saqlanadi; out-of-range preference butun sync transactionni CHECK error bilan buzmaydi. Offline-sync protokoli/receipts/reset/idempotency o'zgarmagan.
- Operator read-only preflight va barcha migrationdan keyingi read-only verifier; rollback-default first-admin operator template; local lexical/static/mocked testlar qo'shildi.

## 9. Deploy checklist: aniq chegaralar

### A. Lokal bajarish xavfsiz

- Ushbu report, SQL diff va yangi operator shablonini review qilish; existing regressiyalar, readiness suite, JS/import/HTML JSX parsing, admin build va diff whitespace checks.
- Staging uchun alohida artifact/release konfiguratsiyasini rejalash. Joriy admin `auth.js` URL/key production projectiga fixed; HTML'da ham shu project constants bor. Connection modal ishonchli client projectini o'zgartirmaydi. Hozirgi build bilan staging login **qilmang**.
- Kelajak staging artifactida `auth.js` URL/public key va ikkala HTML fixed display/deployment constants mos staging values bo'lsin; mobile `EXPO_PUBLIC_SUPABASE_URL`/public key aniq staging bo'lsin. Private isolated copy/build ishlating, production source/config'ni almashtirmang. DevTools'da REST/Auth/Function request hostlari faqat staging ekanini tekshirmasdan account/login test boshlanmaydi. Service-role/JWT hech qachon client artifactga kiritilmaydi.

### B. Staging Supabase (alohida ruxsat talab qiladi)

- Production'dan ajratilgan loyiha yoki reviewed/sanitized snapshot; Auth/config/extensions/roles/PostgreSQL versiyasi va operators tekshirilsin. Schema-only staging bilan fresh path ham, legacy snapshot bilan existing path ham sinalsin; production foydalanuvchi PII/secrets staging'ga ko'r-ko'rona ko'chirilmasin.
- Preflight: existing schema types/defaults/constraints/FKs, legacy duplicates, identity mismatch, unknown privileged functions/triggers/grants/publications va migration history review.
- Har migrationni aniq tartibda bittadan apply; xatoda to'xtash, rollback holati; final verifierlar; PostgREST yangi signature/schema cache va Edge Function configuration review.
- Tasdiqlangan staging rolloutda `admin-accounts` Edge Function kerak bo'lsa alohida deploy. Birinchi login uchun u shart emas; hisob boshqaruvi va finance/analytics permission allowlist amallari uchun yangi versiya kerak. SMTP/email confirmation/redirect/password setup jarayoni tekshirilsin.

### C. Manual first-admin provisioning

- 6-bo'limdagi real email Auth → confirmed UUID → matching profile → trusted operator dry run → approved commit → real email/password login tartibi.
- Normal signup uchun admin row **yaratilmasligi** tekshirilsin. Moderator/editor provisioning faqat first-admin tasdiqlanganidan keyingi staging rol matritsasi uchun; hozir hech qanday fixture/hisob yaratilmadi.

### D. Staging tekshiruvlarining qabul mezonlari

| Tekshiruv | Kutilgan natija |
| --- | --- |
| SQL compile/objects | Fresh va existing path to'liq o'tadi; trigger bodylar ham ishlatilganda xatosiz; type/unique/FK/CHECK/RLS/grants expected; Admin Real Data retry to'g'ri history bilan to'xtaydi |
| Auth creation/confirmation | Bitta operator email identity, bitta matching profil; trigger failure Auth creationni ham abort qiladi; normal signup admin bo'lmaydi; invite/password flow testdan o'tgan |
| RLS/private data | Anon profile/admin/audit/finance/learning ma'lumotini ololmaydi; A boshqa B profil/progress/entity/receiptni o'qiy olmaydi; privileged column writes rad etiladi |
| Admin role lookup | Oddiy real JWT uchun get_my_admin_access bo'sh/denied va panel yopiq; haqiqiy Super Admin tasdiqlanadi; inactive/blocked account rad qilinadi |
| Editor/moderator | Rol nomiga emas, explicit permissionsga muvofiq RPC/endpoint; manage_admins faqat super_admin; unauthorized analytics/settings/finance va admin password/delete amallari rad qilinadi |
| RPC permissions | PUBLIC/anon execute yo'q; private trigger/helper arbitrary client RPC emas; provider ingestion faqat trusted service server; forged JWT/browser role foydasiz |
| Phase 3 | Bounded caller-owned batches; identical replay/drop-response idempotency; altered replay rad; same-device stale sequence overwrite yo'q; reset epochs/conflict queue retention; mid-batch entities/mirrors/receipts/activity atomik rollback; valid preference CHECK bounds |
| Admin aggregates | Auth-linked learners/admin exclusion; 3600 canonical content; mastery unique; Uzbekistan day/week boundaries va zero growth; yangi receipt asosida DAU; no-history holatida honest zero/unavailable |
| Finance | Direct table write/read deny; view/manage permission; manual reference/request replay; void+audit saqlanishi; pending/failed/cancelled exclusion; production/test/mock aralashmasligi; manual income verified purchase hisoblanmasligi |
| Mock payments | Mock flow prod entitlement/ledger yozmaydi; card data saqlanmaydi; client service-only provider RPC'ni chaqira olmaydi; Click/Payme integration bu vazifaga kirmaydi |
| Session/account switch | A→B→A stale response/queue/PII isolation; local logout panelni yopadi; same-owner token change stale handlerni bekor qiladi; Auth expiry/refresh va blocked profile server rejection |
| Sekin internet | Haqiqiy Android/iOS'da offline startup, airplane-mode, timeout, intermittent internet, process kill/restart va Uzbekistan mobil tarmog'ida queue durability; cache Auth authority bo'lib qolmaydi |

`backend/tests/admin_real_data.sql` — oldindan mavjud rollback-only staging integration test. U **Auth fixture INSERT** qiladi va claims simulyatsiya qiladi; production'da yoki ushbu vazifa davomida bajarilmaydi. U actual Supabase Auth signup/token/REST testlari o'rnini bosmaydi. Local Node testlar ham SQL bajarishni tasdiqlamaydi.

### E. Faqat staging to'liq o'tgach production rejasi

- Alohida deployment/account/data-mapping ruxsati, operator/egasi tasdiqi, maintenance/client rollout oynasi, release artifact hostlarini tekshirish va qayta tiklash mashqi.
- To'liq DB backup (schema/data/constraints/policies/functions/triggers/grants/ownership/publications), Auth identity/config va zarur Storage/Edge config inventory. Managed auth secrets/backup operatorning xavfsiz vositalarida, repository'da emas.
- Legacy contact/UUID mapping va settings/entitlement/history saqlanishini rejalash. Phase 3 eski RPC'ni bekor qiladi: eski mobile clientlar navbatini saqlab authorization failure olishi mumkin; current mobile bilan coordinated server/client rollout majburiy.
- Deploymentdan oldin yangi SQL revision/checksumlar, old RPC grantlari va migration order review. Production first-admin alohida real identity tasdig'i bilan; staging UUID'ni production'ga ko'chirmang.
- Migration va first-admin success alohida isbotlanadi. Runtime Auth/RLS/ledger/client QA o'tmagan holat **NOT YET SAFE FOR PRODUCTION**.

## 10. Failure va rollback rejasi

- Migration xato bersa shu faylning ochiq transactionini ROLLBACK qilib, error/object/dependency'ni yozib oling. Oldingi muvaffaqiyatli migrationlar allaqachon committed; butun zanjir avtomatik rollback bo'lgan deb aytmang. Error'dan keyin psql davom etmasligi kerak.
- Staging fail qilganda production'ga o'tmang. Reproduction + xavfsiz forward correction yoki disposable staging'ni tasdiqlangan baseline'dan qayta tiklash; oldin saqlangan local offline queues/DB receiptlarni yo'qotmang.
- Function body/grant/policy/trigger/view/publication change texnik jihatdan qayta o'rnatiladi, lekin eski anonymous/custom auth huquqlarini qaytarish xavfsiz rollback emas. Kerak bo'lsa access'ni yopish/maintenance va oldingi **xavfsiz** artifact bilan fail-closed holat saqlansin.
- Jadval/ustun qo'shishni keyin DROP qilish ichidagi user/finance/sync ma'lumotini yo'qotishi mumkin. Ledger/audit/activity va receipts/sequence/epoch state saqlanadi. Bootstrap row unlink/delete yoki Auth delete bilan ko'r-ko'rona teskari qilinmaydi: ON DELETE CASCADE profil/progressni yo'qotishi mumkin.
- Legacy UUID transfer, conflict reconciliation, constraint validation va finance import oddiy reversible DDL emas. Bular alohida mapping/backups/reconciliation talab qiladi; historical transactions_data importi bu vazifada yo'q.
- Full backup restore tanlansa backupdan keyingi write/loss oynasi, Auth profil/admin/sync UUID mosligi va hosted Auth/Storage/config qayta tiklanishi operator tomonidan kelishiladi. Destructive rollback script yaratilmadi.

## 11. Lokal test natijalari va cheklovlar

| Tekshiruv | Natija |
| --- | --- |
| `node tests/repair-phase1.cjs` | PASS, barcha mavjud assertions |
| `node tests/security-phase2.cjs` | PASS, 9 guruh; JS/JSX/import va hash replay/admin/security checks |
| `node tests/repair-phase3.cjs` | PASS, 31 case |
| `node tests/admin-real-data.cjs` | PASS, 28 case |
| `node tests/supabase-readiness.cjs` | PASS, 11 case |
| JS syntax + ikkala inline HTML JSX parse | PASS |
| `npm.cmd run build` (admin) | PASS, ikkala entrypoint |
| `git diff --check` | PASS; faqat Windows LF/CRLF ogohlantirishlari |
| PostgreSQL compile/migrations/Auth/RLS | BAJARILMADI: psql/Docker/Supabase CLI/parser bu muhitda yo'q; remote ishlatilmadi |
| Native device/real network QA | BAJARILMADI; scope staging/device acceptance |

Yangi local suite SQL statement/quote/dollar-body chegaralari, transaction/order, explicit revoke/search_path/caller guards, read-only inventories, first-admin operator guards, normal signup privileges va mocked Auth-to-role flow'ni tekshiradi. **Bu PostgreSQL grammar parser yoki SQL execution emas.** Boshlang'ich yangi testda DO ichidagi `SELECT * FROM (VALUES...)` metadata ro'yxati credential output deb noto'g'ri belgilandi; check qaytariladigan top-level SELECTlarga aniqlashtirildi. Mavjud testlar o'zgartirilmadi, failures yashirilmadi.

## 12. O'zgargan fayllar

Existing: `admin/index.html`, `admin/preview.html`, `backend/verify_security_phase2.sql`, `backend/migrations/20261005_repair_phase3_offline_sync.sql`, `backend/README.md` (shu reportga yo'naltirish).

New: `backend/supabase_migration_preflight.sql`, `backend/verify_migration_readiness.sql`, `backend/operator_first_super_admin.sql`, `tests/supabase-readiness.cjs`, ushbu report. Migration Phase 2 va uning embedded fresh-schema nusxasi hamda Admin Real Data SQL o'zgartirilmadi. Mobile/Auth/Edge Function/payment/session kodlari o'zgartirilmadi. Build output ignored lokal artifact; deploy emas.

## 13. Tasdiqlangan va hali tasdiqlanmagan holatlar

**CONFIRMED IN CODE:** email-only admin flow; no automatic legacy link/admin signup grant; exact UUID ownership; server roles/RLS/grants; Phase 3 queue/idempotency/reset protokoli saqlangan; narrow SQL hardening/preference bounds; read-only phase-aware verification; rollback-default one-time trusted bootstrap va barcha lokal regressiyalar.

**REQUIRES STAGING VERIFICATION:** actual remote schema/data/constraints/unknown overloads, SQL compilation va trigger invocation, effective role inheritance/grants, real email/password/invite, matching profile, actual JWT/RLS denial/allow, sync transactions, ledger/environment isolation, real browser/session va device QA. Preflight outputga human review shart; uning o'zi security proof emas.

**NOT YET SAFE FOR PRODUCTION:** bu gate'lar o'tmaguncha migration, Auth creation, bootstrap commit, legacy mapping, Edge/static deploy yoki real payment integration boshlanmaydi. User bildirgan 0 Auth holati bundan mustasno emas; staging o'tmasdan first-adminni production'da yaratish tavsiya qilinmaydi.

Keyingi aniq qadam: alohida ruxsatlangan **izolyatsiyalangan staging** va production'ga ulanmaydigan client artifact tayyorlab, existing-schema preflight review va migration compilation bilan boshlash. Ushbu vazifa shu yerda to'xtaydi.

## 14. Rasmiy manbalar

- [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data): Auth primary key bog'lanishlari va profile trigger xatosi signupni to'xtatishi.
- [Supabase Users](https://supabase.com/docs/guides/auth/users) va [Password Auth](https://supabase.com/docs/guides/auth/passwords): invite confirmation/account setup va password login jarayoni.
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls): email confirmation/recovery uchun allowlisted redirect va Site URL.
- [PostgreSQL 15 Privileges](https://www.postgresql.org/docs/15/ddl-priv.html): function uchun PUBLIC EXECUTE defaulti va explicit revoke zarurati.
