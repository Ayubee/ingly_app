# Ingly Mobile App

Paul Nation'ning mashhur "4000 Essential English Words" kitoblar to'plami asosidagi React Native (Expo) mobil ilovasi.

## 📱 Ekranlar va Arxitektura
1. **`HomeScreen.js`** (`assets/ui_home.jpg` ga 100% mos):
   - Foydalanuvchi profili (Sarah J., "Welcome Back!")
   - Kunlik Streak olovchasi (🔥 7 Days, "Keep it up!", "Streak: 7 days")
   - Kunlik Maqsad (Daily Goal 80% doirasi, 80/100 Words)
   - 6 ta kitob (Book 1 - Book 6) darajalari:
     * Book 1: Elementary (100% Completed, yashil belgi va to'liq progress bar)
     * Book 2: Pre-Intermediate (Current Active, binafsha hoshiya, 45% Completed, Unit 14 of 30, "Continue Learning" tugmasi)
     * Book 3 - 6: Intermediate, Upper-Int, Advanced, Mastery (qulflangan qulay kartochkalar)
2. **`FlashcardScreen.js`** (`assets/ui_flashcard.jpg` ga 100% mos):
   - Unit sarlavhasi va progress indikatori (Book 1 - Unit 4: 15/20)
   - Inglizcha so'z ("Adventure") va audio talaffuz karnayi
   - IPA transkripsiyasi ("/ədˈventʃər/") va so'z turkumi ("Noun")
   - Mavzuli illyustratsiya (Tog'dagi sayohat)
   - Inglizcha ta'rif ("An adventure is a fun or exciting thing that you do.")
   - O'zbekcha tarjima ("Sarguzasht") va alohida audio karnay
   - Misol gap ("Climbing Mount Everest was a thrilling adventure for the group." - "adventure" ta'kidlangan fon bilan)
   - Kinodan hissiy lavha (3-5s video context) ochiladigan modal ("The Lord of the Rings / Bilbo Baggins")
   - 3 ta Oraliq Takrorlash (SRS) tugmalari:
     * ✕ **Qiyin** (`#EF4444`, 35%)
     * ↻ **Takrorlash** (`#0EA5E9`, 30%)
     * ✓ **Yodlandi** (`#22C55E`, 35%)
3. **`QuizScreen.js`**:
   - 4 variantli interaktiv test (A, B, C, D)
   - To'g'ri (yashil) va xato (qizil) javoblarni darhol ko'rsatish
   - Ball hisoblagich va yakuniy natijalar oynasi (+XP, aniqlik foizi)
4. **`ProfileScreen.js`**:
   - Foydalanuvchi ma'lumotlari va o'rganish statistikasi
   - Kunlik maqsad sozlamasi (10, 20 yoki 30 ta so'z/kun)
   - Kreativ push bildirishnomalar, audio va Offline Smart Cache switchlari
5. **`LearnScreen.js`**:
   - Kitoblar va 30 tadan unitlar bo'yicha to'liq navigatsiya jadvali
6. **`BottomNavigation.js`**:
   - Dizayndagi 5 ta pastki tab: Home, Learn, Flashcards, Quiz, Profile

## 🎨 Dizayn Tizimi
- Barcha ranglar va o'lchamlar `shared/theme.js` dan olingan.
- Asosiy brend rangi: `#5B4DFF` (Royal Indigo)
- Ikkilamchi rang: `#38BDF8` (Sky Blue)
- Sirt foni: `#F8FAFC`

## 🚀 Ishga tushirish
```bash
# Mobile papkasiga o'tish
cd mobile

# Paketlarni o'rnatish
npm install

# Expo dasturini ishga tushirish
npx expo start
```
