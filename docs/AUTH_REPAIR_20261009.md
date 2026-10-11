# Ingly auth tekshiruvi — 2026-10-09, Asia/Tashkent

**Natija:** kod va lokal konfiguratsiya tuzatildi, lekin haqiqiy backend bilan muvaffaqiyatli ro‘yxatdan o‘tish/kirish hali tasdiqlanmadi. Production backendda telefon auth o‘chiq va klient talab qiladigan auth schema/RPC yo‘q. Backendga SQL/Auth boshqaruv ulanishi berilmagan; hech qanday migration yoki Auth provider sozlamasi qo‘llanmadi.

## Dalil bilan aniqlangan sabablar

| Muammo | Kuzatilgan dalil | Oqimga ta’siri |
|---|---|---|
| Telefon orqali ro‘yxatdan o‘tish | Production `GET /auth/v1/settings` → 200, `external.phone=false`; haqiqiy `AuthScreen` submit kodi → o‘rnatilgan SDK → `POST /auth/v1/signup` → **400 `phone_provider_disabled`**, `userCreated=false` | Auth akkaunt yaratilishidan oldin so‘rov rad etiladi. Buni RLS yoki parol validatsiyasi bilan tuzatib bo‘lmaydi. |
| Profil schema klientga mos emas | Production `GET /rest/v1/users?select=id,auth_user_id&limit=0` → **400 `42703`**, `users.auth_user_id` mavjud emas | `fetchUserRemoteStatus()` so‘rovi bajarilmaydi. Profil yaratish triggeri, mavjud Auth/profil bog‘lanishlari va RLS holati SQL orqali tekshirilishi kerak. |
| Admin schema va authorization RPC yo‘q | `admins`ning `auth_user_id` ustunini so‘rash → **400 `42703`**; `POST /rest/v1/rpc/get_my_admin_access` → **404 `PGRST202`** | To‘g‘ri Auth email/parol bilan kirilgan taqdirda ham amaldagi admin kodining huquq tekshiruvi ishlay olmaydi. Bu hisob paroli noto‘g‘riligini isbotlamaydi. |
| Build muhitlari turlicha | Ish boshlanishida `admin/dist/index.html` ichida staging `dkyrpciabqtnluitpafx`; mobil `.env` va oldingi production Hermes fayllarida `lbsqxownrjfmjoojdsfk` | Ikki klient bir xil backendga bormagan. Staging hostga haqiqiy so‘rovlar **DNS `ENOTFOUND`** bilan tugadi. Bu loyiha o‘chirilganini qat’iy isbotlamaydi, ammo ushbu muhitdan unga ulanib bo‘lmadi. |
| Profil yo‘qligi sessiya yo‘qligiga tenglashtirilgan | `UserContext.applySession()` profil `null` yoki ID bog‘lanishi mos bo‘lmaganda `logout()` chaqirgan; HTTP/schema xatolari `catch {}` ichida yashirilgan | Mavjud Auth sessiyasi bilan login ekraniga qaytish yoki bo‘sh profilni sababsiz ko‘rish mumkin bo‘lgan. Lokal regression testda qayta hosil qilindi. |
| Expo `.env` yuklash tartibi | Odatiy `expo export` → `APP_ENV must explicitly be development, staging or production`, garchi `mobile/.env` to‘ldirilgan bo‘lsa ham | Dynamic config dotenv yuklanishidan oldin tekshirilgan. `@expo/env.loadProjectEnv` qo‘shilgach shu buyruq muvaffaqiyatli o‘tdi. |
| Loading/xatolar va eski auth javoblari | Mobil submitda takroriy so‘rov cheklovi yo‘q; admin RPC xatolari umumiy denialga aylantirilgan; admin listener faqat kechiktirilgan callbackda tekshiruvni yangilagan | Xatoni tashxislash qiyin; eski authorization javobi logout paytida UIga qaytishi mumkin. Nazoratli network testlari bilan tekshirildi. |

Oldingi “tuzatildi” hisobotlari dalil sifatida ishlatilmadi. Yangi dalillar: `auth-backend-production-20261009.json`, `auth-backend-staging-20261009.json`, `auth-live-probe-20261009.json`.

## Tuzatilgan fayllar

- `mobile/src/services/authService.js`: telefon/email, username, ism uzunligi va bo‘sh parol validatsiyasi; xavfsiz o‘zbekcha Auth xabarlari; SMS resend; OTP formatini tekshirish. Username orqali parol tekshirish qo‘shilmadi: mavjud UI telefon/email talab qiladi, username profil nomi bo‘lib qoladi.
- `mobile/src/services/supabaseClient.js`: SDK `processLock`; HTTP so‘rovining o‘zini 15 soniyada abort qilish. Token, parol va kalitlar log qilinmaydi.
- `mobile/src/context/UserContext.js`: profil xatosini Auth sessiyasidan ajratish; profil xatosi va retry; transient SDK network xatosida mavjud sessiyani saqlash; AppState bilan auto refresh start/stop; logout cleanup tugasa ham busy holatini bo‘shatish. Haqiqiy bloklangan profil uchun logout saqlangan.
- `mobile/src/screens/AuthScreen.js`: takroriy submit cheklovi, loading, aniq validatsiya, tasdiqlash kutish xabari, SMS kodini qayta yuborish.
- `mobile/App.js`: profil xatosi, qayta yuklash va chiqish amallari ko‘rinadi. SDK sessiyasi tiklanganligi public profil muvaffaqiyatli yuklandi degani sifatida ko‘rsatilmaydi.
- `mobile/app.config.js`, `mobile/package.json`, `mobile/package-lock.json`: explicit dotenv konfiguratsiyasi tekshiruvdan oldin yuklanadi; `@expo/env` aniq `2.4.3` versiyada. Shell/EAS qiymatlari ustun, `EXPO_NO_DOTENV=1` staging izolyatsiyasini saqlaydi.
- `admin/public/auth.js`: Auth va admin huquqi xatolarini alohida ko‘rsatish; email normalizatsiyasi; tan olingan admin role tekshiruvi; network timeout; login mutex; logout generation bilan eski authorization javobini rad etish. Oddiy foydalanuvchi rad etilganda signout qilinadi. Vaqtinchalik backend RPC xatosi Auth sessiyasini yo‘q qilmaydi, ammo panelga ruxsat bermaydi.
- `admin/index.html`, `admin/preview.html`: loading va o‘zbekcha xatolar; auth event kelganda pending tekshiruv darhol bekor qilinadi; hisob o‘zgarsa private admin UI ma’lumotlari tozalanadi. Browser Supabase SDK tekshirilgan `2.117.2` versiyasiga mahkamlandi.
- `admin/package.json`, `admin/.env.production.example`: explicit production dev/check/build buyruqlari va amaldagi production ref shabloni.
- **Lokal, Gitga kirmaydigan** `admin/.env.production.local`: mavjud mobil production public qiymatlaridan tuzildi. Service role yoki boshqa maxfiy server credential qo‘shilmadi. Staging fayllari o‘zgartirilmadi.
- `scripts/auth-backend-check.cjs`: public key bilan read-only HTTP preflight; env mosligi, provider, schema/RPC mavjudligi; foydalanuvchi qatorlari olinmaydi. `ready=true` ham haqiqiy authenticated login/RLS testi degani emas.
- `scripts/auth-disabled-phone-probe.cjs`: actual forma submit kodi va actual SDK bilan haqiqiy HTTP diagnostikasi. Telefon provider yoqilgan bo‘lsa, bu diagnostika signupni umuman bajarmaydi.
- `tests/auth-regression.cjs`, `tests/helpers/auth-harness.cjs`: 12 ta xulq regression testi; native control rendering headless, lokal suite network/storage javoblari nazoratli.
- `tests/repair-phase1.cjs`, `tests/supabase-readiness.cjs`: eski fixturelar yangi loading va error-code contractiga moslandi; rad etish assertionlari saqlangan.

Ish boshlanishidayoq o‘zgargan `mobile/.expo/dev/logs/start.log` foydalanuvchi o‘zgarishi sifatida qoldirildi. Mavjud foydalanuvchilar, rollar yoki ma’lumotlar o‘zgartirilmadi.

## Tekshiruv natijalari

| Talab | Lokal/nazoratli test | Haqiqiy backend/device |
|---|---|---|
| 1. Formadan signup va profil yaratilishi | **PASS** — forma → normalizatsiya → signup; sessiyasiz confirmation holati | **FAIL** — haqiqiy signup `400 phone_provider_disabled`; test akkaunt/profil yaratilmagan. Native device UI **BLOCKED**. |
| 2. Tasdiqlashdan so‘ng kirish | **PASS** — resend/verifyOtp `sms`, sessiya talabi | **BLOCKED** — provider sozlanmagan, SMS yuborilmagan; kod so‘rash bosqichiga yetilmadi. |
| 3. Mavjud foydalanuvchi va profil | **PASS** — profil yuklanishi, missing/schema/RLS xatosi, retry | **BLOCKED** — tekshiriladigan account credentiali va kerakli backend schema yo‘q. |
| 4. Ilova qayta ochilganda sessiya | **PASS** — SDK cache, provider restart, expired/profile-only cache rad etilishi; AppState refresh | **BLOCKED** — haqiqiy sessiya/device yaratilmagan. Bu provider restart testi haqiqiy telefonni yopib ochish testi emas. |
| 5. Logout va qayta login | **PASS** — logout/cache cleanup/relogin; oldingi generationdan javob rad etilishi | **BLOCKED** — haqiqiy account/session yo‘q. |
| 6. Vakolatli admin kirishi | **PASS** — Auth identity + mos RPC role; logout race | **BLOCKED** — foydalanuvchi test admin yo‘qligini aytdi; yaratish uchun boshqaruv ulanishi yo‘q. |
| 7. Oddiy foydalanuvchi admin panelga kiritilmasligi | **PASS** — role yo‘q/identity mos emas → denial + signout; server handler permission fixturelari | **BLOCKED** — haqiqiy oddiy akkaunt/JWT va amaldagi RPC yo‘q. Anon RPC diagnostikasi ushbu authenticated test o‘rniga olinmadi. |
| 8. Noto‘g‘ri parol/internet xabari | **PASS** — `invalid_credentials`, network, timeout, loadingdan chiqish | **PASS (cheklangan)** — mobil forma va admin auth moduli orqali haqiqiy `/auth/v1/token` → `400 invalid_credentials`, o‘zbekcha xabar. Mavjud akkauntdagi atay noto‘g‘ri parol alohida **BLOCKED**; haqiqiy internet uzilishi/device testi **BLOCKED**. Stagingdagi haqiqiy DNS xatosi qayd etildi. |

Actual signup probe native `View/TextInput` komponentlari o‘rniga headless rendering ishlatadi, ammo `AuthScreen` submit/validatsiya kodi, `authService`, o‘rnatilgan Supabase SDK va HTTP haqiqiy. Diagnostic signupda ishlatilgan yetib bormaydigan raqam haqiqiy test akkaunti yaratildi degani emas. Noto‘g‘ri login tekshiruvida mavjud foydalanuvchi ma’lumoti ishlatilmadi. Admin Auth xatosida role bosqichiga so‘rov yuborilmagani ham qayd etildi.

**Barcha 9 lokal test fayli PASS:**

```text
node tests/admin-real-data.cjs        — 28 PASS
node tests/auth-regression.cjs        — 12 PASS
node tests/environment-isolation.cjs — 16 PASS
node tests/repair-phase1.cjs           — PASS
node tests/repair-phase3.cjs           — 31 PASS
node tests/security-phase2.cjs        — PASS
node tests/staging-payments.cjs       — 3 PASS
node tests/staging-readiness.cjs      — 10 PASS
node tests/supabase-readiness.cjs     — 11 PASS
```

Bu suitelardagi SQL invariant tekshiruvlari statik; PostgreSQLda migration compile/RLS runtime bajarildi degani emas.

**Build/export:** admin `npm.cmd run build -- --mode production`, Android va iOS `expo export --clear` — **PASS**. Admin HTML va ikkala yangi Hermes artifact ichida `https://lbsqxownrjfmjoojdsfk.supabase.co` topildi. Oldingi staging Hermes artifactlari staging manzilida qolgan; ular production exportga almashtirilmadi. Serverga deploy, APK/IPA o‘rnatish yoki App Store build bajarilmadi.

Typecheck uchun loyihada `tsconfig`/alohida typecheck script yo‘q. JS/JSX syntax, import va export tekshiruvlari **PASS**. Edge Function native Deno typecheck va DB/runtime testlari **BLOCKED**. Build muvaffaqiyati login ishlashiga dalil sifatida olinmadi.

## Backendga qo‘llanmagan ishlar

1. Production **existing** baza sifatida avval `backend/supabase_migration_preflight.sql` bilan read-only inventarizatsiya qilinadi. `schema.sql`ni mavjud baza ustidan ko‘r-ko‘rona qayta ishga tushirish kerak emas.
2. `backend/migrations/20261005_security_phase2.sql` talab qiladigan `auth_user_id`, profile trigger, admin RPC/grant/RLS amaldagi backendda yo‘q yoki to‘liq emas. Migration holati DB katalogidan tekshiriladi va mavjud ma’lumotlar bilan moslashtiriladi. Mavjud Auth foydalanuvchilari uchun faqat INSERT trigger yetmaydi: mavjud profillar/IDlar va ularga bog‘langan progress/audit yozuvlari alohida tekshiriladi. Email/telefon o‘xshashligiga qarab avtomatik bog‘lash yoki eski IDlarni yo‘qotish bajarilmadi.
3. Mobil sync va admin ma’lumotlari uchun `20261005_repair_phase3_offline_sync.sql`, keyin `20261006_admin_real_data.sql`ning amaldagi holati tekshiriladi. Bu sessiyada ular qo‘llanmadi; SQL historyga kirishsiz ularning live holati haqida qat’iy da’vo yo‘q. `backend/verify_migration_readiness.sql` va `backend/tests`dagi SQL sinovlari hali live bajarilmadi.
4. Phone provider va haqiqiy SMS yuborish provider credentiallari sozlanadi. Telefon/email confirmation o‘chirilmaydi. Email tasdiqlash va redirect URL allowlistning xususiy sozlamalari boshqaruv ulanishisiz tekshirilmadi; public settings email/phone confirmation talabini ko‘rsatadi. Google ham public settingsda o‘chiq, u ushbu ta’mirda yoqilmadi.
5. Boshqaruv ulanishi berilgach, foydalanuvchi ruxsat bergan **alohida** tasdiqlangan test admin yaratiladi. Oddiy test akkauntga admin huquqi berilmaydi. `admins.auth_user_id`, ruxsat etilgan role, `is_active=true` va matching unblocked profil tekshiriladi. First-super-admin operator fayli faqat birinchi admin uchun; uni mavjud super-admin bo‘lsa qayta ishlatish kerak emas.

## Davom ettirish uchun foydalanuvchidan kerak

- `lbsqxownrjfmjoojdsfk` loyihasiga scoped SQL/Auth boshqaruv ulanishi: ulangan Supabase plugin/MCP yoki xavfsiz lokal operator ulanishi. Supabase plugin topildi, ammo o‘rnatilmagan/ulanmagan; browser runtime ham `sandbox setup refresh` xatosi sabab ochilmadi. Parol/service-role/PATni chatga yozish kerak emas.
- Oddiy signup testi uchun SMS qabul qiladigan alohida test telefon raqami; admin uchun tasdiqlash mumkin bo‘lgan alohida test email. Zarur SMS kodi/email tasdiqlashi faqat so‘rov muvaffaqiyatli yuborilgandan keyin so‘raladi.
- Native UI va real app restartni tekshirish uchun ulangan test qurilma/emulator yoki ishlaydigan browser test muhiti.

Test admin yaratishga ruxsat allaqachon berilgan; qayta ruxsat so‘rash talab qilinmaydi. Hozirgi to‘siq — backendga amaliy boshqaruv ulanishining yo‘qligi.

Qayta tekshirish:

```powershell
node scripts/auth-backend-check.cjs production
node scripts/auth-backend-check.cjs staging
node scripts/auth-disabled-phone-probe.cjs production
npm.cmd --prefix admin run build:production:checked
```

Hozir birinchi/staging preflight va checked production build backend tayyor emasligi sabab non-zero bilan to‘xtashi kutiladi. Disabled-phone probe xatoning muvaffaqiyatli qayta hosil qilinganini exit 0 bilan bildiradi; bu signup PASS degani emas. Provider yoqilgach u xavfsizlik uchun signup probe yuborishni to‘xtatadi, keyingi qadam haqiqiy test kontakt bilan tasdiqlangan oqim bo‘ladi.

Rasmiy manbalar: [Supabase phone provider sozlash](https://supabase.com/docs/guides/auth/phone-login), [React Native sessiya/refresh](https://supabase.com/docs/guides/auth/quickstarts/react-native), [Auth listener](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [Monitoring/debugging](https://supabase.com/docs/guides/monitoring-and-debugging), [Data API grants o‘zgarishi](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically). Live sabablar yuqoridagi o‘z backendimiz HTTP dalillariga asoslangan.
