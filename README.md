# 📱 INGLY — 4000 Essential English Words & Cinema Learning Ecosystem

<p align="center">
  <img src="https://img.shields.io/badge/Platform-React%20Native%20%7C%20Expo-5B4DFF?style=for-the-badge&logo=react" alt="React Native Expo" />
  <img src="https://img.shields.io/badge/Admin%20Panel-React%2018%20%7C%20Vite%20%7C%20Tailwind-38BDF8?style=for-the-badge&logo=vite" alt="React 18 Vite" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Supabase-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase PostgreSQL" />
  <img src="https://img.shields.io/badge/FinTech-Click%20%7C%20Payme%20%7C%20Uzcard%20%7C%20Humo-0073FF?style=for-the-badge" alt="Uzbek FinTech" />
  <img src="https://img.shields.io/badge/Security-SHA--256%20%7C%20RLS%20Hardened-22C55E?style=for-the-badge" alt="Security Hardened" />
</p>

---

## 📖 Loyiha Haqida (Project Overview)

**Ingly** — Paul Nation'ning butun dunyoga mashhur **"4000 Essential English Words"** (Book 1 – Book 6) metodologiyasiga asoslangan, ingliz tilini Gollivud filmlari lavhalari (Cinema Context), sun'iy intellektli avto-tarjima va interaktiv kartochkalar yordamida o'rgatuvchi zamonaviy EdTech ekotizimi.

Loyiha ikkita asosiy platformadan iborat:
1. 📱 **Ingly Mobile App (iOS & Android)**: React Native (Expo) da yaratilgan, kino konteksti, shaxsiy lug'at, faol xotira (active recall), testlar va milliy to'lovlar bilan boyitilgan mobil ilova.
2. 💻 **Ingly Web Admin Panel**: React 18, Vite va Tailwind CSS asosida yaratilgan, foydalanuvchilar nazorati, ro'yxatdan o'tgan sanalar tahlili, so'zlar CRUD boshqaruvi va dinamik monetizatsiya sozlamalariga ega boshqaruv paneli.

---

## ✨ Asosiy Imkoniyatlar (Key Features)

### 1. 🎬 Gollivud Kinolari Bilan O'rganish (Cinema Context)
- Har bir so'z uchun Gollivud filmlari (Friends, Harry Potter, Iron Man va h.k.) va seriallaridan 3–5 soniyalik hissiy kontekst video kliplari.
- So'zlarning real hayotdagi jonli talaffuzi va qo'llanishini o'rganish.

### 2. ✍️ Shaxsiy Lug'at & Aqlli Kartochkalar (MyWordsScreen)
- **Tezkor Avto-Tarjima**: Foydalanuvchi istalgan o'zbekcha yoki inglizcha so'z/iborani kiritishi bilan tizim uni Google GTX, MyMemory va 4000 Words bazasi orqali bir zumda aniq tarjima qiladi.
- **Yashirin Tarjima (Active Recall)**: Kartochka ochilganda faqat so'z ko'rinadi, tarjima dastlab yashiringan bo'ladi. "👁️ Tarjimani ko'rish" bosilgandagina tarjima, transkripsiya va audio talaffuz ochiladi.
- **Aqlli Saralash**:
  - `✅ Yodladim` — so'zni "Yodlanganlar" bo'limiga o'tkazadi va kunlik streak/progressni oshiradi.
  - `❌ Yodlamadim` — so'zni "Yodlanmaganlar" bo'limida qoldiradi va qayta takrorlashga qo'yadi.
- **3 Xil Bo'lim & Qidiruv**: "⏳ Yodlanmaganlar", "✅ Yodlanganlar", "📑 Barchasi" hamda ketma-ket takrorlash (Study Session) seansi.

### 3. 💳 Milliy FinTech Integratsiyasi (Click, Payme, Uzcard & Humo)
- **Click Up**: 1 bosish orqali Click ilovasiga o'tib tezkor xarid qilish.
- **Payme Web Checkout**: Milliy Payme to'lov shlyuzi orqali to'lov.
- **To'g'ridan-to'g'ri Bank Kartalari**: Uzcard (8600) va Humo (9860) karta raqamini kiritib xavfsiz to'lash.
- **Zero-Visibility Bepul Rejim**: Tizim bepul holatda bo'lganda (`premium_mode: false`) foydalanuvchiga hech qanday narxlar yoki to'lov tugmalari ko'rinmaydi.
- **Dinamik Narxlar (Remote Config)**: VIP oylik obuna va bitta kitob xarid narxlari Admin paneldan istalgan payt o'zgartiriladi va mobil ilovaga darhol aks etadi.

### 4. 🎮 Gamifikatsiya & Motivatsiya
- **Daily Streak (Olovcha)**: Har kuni so'z yodlaganda kunlik ketma-ketlik oshib boradi.
- **Kunlik Maqsad Aylanasi (Circular Progress)**: 20 ta so'zli maqsad va foizli indikator.
- **Quiz & Test Imtihoni**: 4 variantli, taymerli, tezkor natija hisoblagichli test tizimi.

### 5. 🛡️ Bank Standartidagi Kiberxavfsizlik (Security Hardened)
- **Parol Shifrlash**: Barcha parollar tuzlangan (Salted) SHA-256 kriptografik heshlar orqali saqlanadi. Hech qachon ochiq matnda uzatilmaydi.
- **Supabase RLS (Row Level Security)**: Baza darajasida ruxsatsiz kirish (IDOR) va in'yeksiyalardan to'liq himoyalangan.
- **6 Oylik Parol Yangilash Siyosati**: Foydalanuvchi ilovaga kirishi bilanoq bezovta qilinmaydi — faqat ro'yxatdan o'tgan yoki paroli o'zgartirilgan kundan boshlab **kamida 180 kun (6 oy)** to'liq o'tgandagina eslatma ko'rsatiladi.

### 6. 💻 Web Admin Boshqaruv Paneli
- **Foydalanuvchilar Tahlili**: Foydalanuvchilarning ro'yxatdan o'tgan aniq sanasi (`📅 YYYY-MM-DD HH:mm`) va "Bugun / Kecha / X kun oldin / >6 oy" nishonlari.
- **Hisoblarni Boshqarish**: Foydalanuvchini bloklash (Ban/Unban switch), parolini xavfsiz yangilash va VIP statusini berish.
- **4000 So'z CRUD**: Kitoblar va unitlar bo'yicha so'zlarni qo'shish, o'chirish, tahrirlash va audio/video biriktirish.
- **Monetizatsiya & Reklama**: Google AdMob va VIP obuna kalitlarini ilovani qayta reliz qilmasdan yoqish/o'chirish (Feature Flags).

---

## 📁 Loyiha Strukturasi (Repository Structure)

```text
ingly_app/
├── admin/                     # Web Admin Panel (React 18 + Vite + TailwindCSS)
│   ├── public/                # Statik fayllar (all_words.json va h.k.)
│   ├── src/                   # Admin panel komponentlari va xizmatlari
│   ├── index.html             # Asosiy boshqaruv paneli (Standalone & Vite)
│   ├── preview.html           # Foydalanuvchilar va sozlamalar ko'rinishi
│   ├── vite.config.js         # Vite konfiguratsiyasi
│   └── vercel.json            # Vercel deploy sozlamalari
├── backend/                   # Ma'lumotlar bazasi va xavfsizlik arxitekturasi
│   ├── schema.sql             # PostgreSQL / Supabase to'liq bazasi sxemasi
│   ├── security_hardening.sql # RLS qoidalari va xavfsizlik mustahkamlamasi
│   └── README.md              # Baza sozlash qo'llanmasi
├── mobile/                    # React Native (Expo) Mobil Ilovasi
│   ├── src/
│   │   ├── components/        # UI komponentlar (BottomNav, PaymentModal va h.k.)
│   │   ├── context/           # UserContext (Streak, 6-oy parol, VIP obuna)
│   │   ├── screens/           # Home, Learn, Flashcards, Quiz, MyWords, Profile
│   │   ├── services/          # Supabase, Translator, Storage, TTS, UserService
│   │   ├── theme.js           # Dizayn tokenlari va ranglar palitrasi
│   │   └── utils/             # Kriptografiya (SHA-256) va yordamchilar
│   ├── App.js                 # Asosiy mobil marshrutizator
│   └── package.json           # Mobil ilova qaramliklari
├── data/                      # 4000 so'z JSON ma'lumotlar bazasi (Book 1 - Book 6)
├── shared/                    # Umumiy mavzular va dizayn konstantalari (theme.js)
├── vercel.json                # Ildiz darajasidagi Vercel deploy konfiguratsiyasi
├── app_presentation.html      # 9 sahifali yuqori sifatli vizual taqdimot
├── Ingly_App_Prezentatsiya.pdf# Rasmiy PDF taqdimot hujjati
└── README.md                  # Ushbu qo'llanma
```

---

## 🚀 Ishga Tushirish (Quick Start)

### 1. Mobil Ilova (React Native / Expo)
```bash
# Mobile papkasiga o'ting
cd mobile

# Bog'liqliklarni o'rnating
npm install

# Expo serverini ishga tushiring
npx expo start
```
*Ilovani telefoningizda Expo Go orqali QR-kodni skanerlab ko'rishingiz mumkin.*

### 2. Web Admin Panel (Vite / Static)
```bash
# Admin papkasiga o'ting
cd admin

# Bog'liqliklarni o'rnating
npm install

# Dasturchi rejimida ishga tushirish (Localhost: 3000)
npm run dev

# Yoki statik server orqali ishga tushirish
npx serve -l 3000 admin
```

### 3. Vercel'ga Deploy Qilish
Loyiha Vercel'ga to'liq moslashtirilgan:
- GitHub repozitoriyangizni Vercel'ga ulang.
- **Root Directory**: `admin` (yoki `./`).
- **Build Command**: `vite build`.
- **Output Directory**: `dist`.

---

## 🔐 Xavfsizlik va Maxfiylik (Security Notice)

- Loyihada xavfsizlik birinchi o'ringa qo'yilgan.
- **Barcha shaxsiy kalitlar, Supabase Service Role kalitlari va ma'muriy parollar repozitoriyda saqlanmaydi.**
- Tizimga kirish uchun xavfsiz heshlangan parollardan foydalaniladi va ma'muriy huquqlar (RBAC) ma'lumotlar bazasining maxsus himoyalangan jadvallarida boshqariladi.
- Haqiqiy ishlab chiqarish (production) muhitida API kalitlari `.env` fayli yoki Vercel Environment Variables orqali kiritiladi.

---

## 📄 Hujjatlar va Taqdimot

- 📑 **Rasmiy PDF Taqdimot**: [`Ingly_App_Prezentatsiya.pdf`](./Ingly_App_Prezentatsiya.pdf) — Har bir ekran va bo'limning iPhone mockup rasmlari va batafsil tushuntirishlari bilan 9 sahifali taqdimot.
- 🛡️ **Kiberxavfsizlik Auditi**: [`SECURITY_AUDIT_REPORT.md`](./SECURITY_AUDIT_REPORT.md)
- 🧪 **QA & Test Hisoboti**: [`QA_BUGS_REPORT.txt`](./QA_BUGS_REPORT.txt)

---

## 👨‍💻 Muallif & Litsenziya

- **Buyurtmachi va Muallif**: inglyJon
- **Litsenziya**: Ushbu loyiha mualliflik huquqlari bilan himoyalangan.
