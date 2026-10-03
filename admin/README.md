# Ingly Web Admin Panel

"Ingly - 4000 Essential English Words" loyihasining boshqaruv tizimi (Web Admin Panel).

## 🚀 Texnologiyalar
- **React.js** (Vite)
- **TailwindCSS** (Ingly Design System tokenlari bilan)
- **Lucide Icons**
- **Supabase / PostgreSQL** integratsiyasiga tayyor

## 🎨 Dizayn Tizimi (Design System)
Barcha ranglar `../shared/theme.js` faylidan olinadi:
- **Primary (Royal Indigo):** `#5B4DFF`
- **Accent (Sky Blue):** `#38BDF8`
- **Background:** `#F8FAFC`
- **Card Surface:** `#FFFFFF`
- **Yodlandi (Mastered):** `#22C55E`
- **Takrorlash (Review):** `#0EA5E9`
- **Qiyin (Hard):** `#EF4444`
- **Streak (Olovcha):** `#F97316`

## 📂 Arxitektura va Bo'limlar
1. **Dashboard:** DAU, jami foydalanuvchilar, kitoblar (Book 1-6) bo'yicha progress va tizim ko'rsatkichlari.
2. **So'zlar boshqaruvi (Words):** 4000 ta so'z CRUD amallari, IPA transkripsiya, o'zbekcha tarjima, audio tinglash, kinolardan 3-5 soniyalik hissiy video lavhalar (Friends, Harry Potter va h.k.).
3. **Foydalanuvchilar (Users):** Foydalanuvchilarni ko'rish, bloklash (Ban/Unban switch), parolni yangilash, VIP maqomini berish.
4. **Monetizatsiya va Feature Flags:** Google AdMob switch (ON/OFF), Ingly VIP switch (ON/OFF), bepul kitoblar konfiguratsiyasi (boshida 100% bepul).
5. **Adminlar va Rollar (RBAC):** Super Admin, Moderator, Kontent menejer rollari va ruxsatlar boshqaruvi.
6. **Smart Push Bildirishnomalar:** TZ.txt 4.6 bo'yicha kreativ xabar shablonlari va telefon ekranidagi jonli ko'rinishi.

## 💻 O'rnatish va Ishga tushirish
```bash
# Admin papkasiga o'tish
cd admin

# Paketlarni o'rnatish
npm install

# Dasturchi rejimida ishga tushirish (Localhost: 3000)
npm run dev

# Ishlab chiqarish uchun yig'ish (Production Build)
npm run build
```
