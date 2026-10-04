/**
 * Ingly Mobile App - Smart Translator Service
 * 
 * Foydalanuvchi kiritgan so'z yoki iborani o'zbekchadan inglizchaga (yoki inglizchadan o'zbekchaga)
 * bir zumda tarjima qilish va kartochka parametrlarini tayyorlash.
 * 
 * 1. Birinchi navbatda 'all_words.json' mahalliy 4000 ta so'zlar bazasidan qidiradi (oflayn).
 * 2. Agar topilmasa, Google GTX Translate API orqali tarjima qiladi (avtomatik til aniqlash).
 * 3. Internet bo'lmaganda yoki xatolikda MyMemory API zaxira shlyuziga murojaat qiladi.
 */

import allWordsData from '../data/all_words.json';

/**
 * Mahalliy 4000 ta so'zdan qidirish
 */
function searchInLocalDictionary(query) {
  if (!query || !Array.isArray(allWordsData)) return null;
  const clean = query.trim().toLowerCase();

  // 1. Inglizcha so'z bo'yicha aniq moslik
  const enMatch = allWordsData.find(w => (w.word || '').toLowerCase() === clean);
  if (enMatch) {
    return {
      original: enMatch.word,
      translated: enMatch.uzbek || '',
      phonetic: enMatch.phonetic || '',
      pos: enMatch.pos || '',
      definition: enMatch.definition || '',
      example: enMatch.example || '',
      source: 'local_en'
    };
  }

  // 2. O'zbekcha tarjima bo'yicha qidirish
  const uzMatch = allWordsData.find(w => {
    const uz = (w.uzbek || '').toLowerCase();
    return uz === clean || uz.split(/[,;\/]/).map(s => s.trim()).includes(clean);
  });
  if (uzMatch) {
    return {
      original: clean,
      translated: uzMatch.word || '',
      phonetic: uzMatch.phonetic || '',
      pos: uzMatch.pos || '',
      definition: uzMatch.definition || '',
      example: uzMatch.example || '',
      source: 'local_uz'
    };
  }

  return null;
}

/**
 * Asosiy tarjima funksiyasi
 * @param {string} text Tarjima qilinadigan so'z yoki ibora
 * @param {string} forcedTarget 'en' | 'uz' | 'auto'
 */
export async function translateText(text, forcedTarget = 'auto') {
  if (!text || !text.trim()) {
    return { success: false, error: 'Matn kiritilmadi' };
  }

  const clean = text.trim();

  // 1. Mahalliy bazani tekshirish
  const localResult = searchInLocalDictionary(clean);
  if (localResult) {
    return {
      success: true,
      ...localResult,
      isLocal: true,
    };
  }

  // 2. Google GTX Translate API orqali onlayn tarjima
  try {
    const targetLang = forcedTarget === 'auto' ? 'en' : forcedTarget;
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(clean)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(gtxUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0] && data[0][0]) {
        let translatedText = data[0].map(item => item[0]).join('').trim();
        const detectedLang = data[2] || 'uz';

        // Agar foydalanuvchi inglizcha yozgan bo'lsa va avto-rejimlarda target 'en' bo'lib qolgan bo'lsa:
        if (detectedLang === 'en' && forcedTarget === 'auto' && translatedText.toLowerCase() === clean.toLowerCase()) {
          // Demak, bu inglizcha so'z, uni o'zbekchaga tarjima qilish kerak!
          const uzRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=uz&dt=t&q=${encodeURIComponent(clean)}`);
          if (uzRes.ok) {
            const uzData = await uzRes.json();
            if (Array.isArray(uzData) && uzData[0] && uzData[0][0]) {
              return {
                success: true,
                original: clean,
                translated: uzData[0].map(item => item[0]).join('').trim(),
                langFrom: 'en',
                langTo: 'uz',
                phonetic: '',
                source: 'gtx_en_to_uz'
              };
            }
          }
        }

        return {
          success: true,
          original: clean,
          translated: translatedText,
          langFrom: detectedLang,
          langTo: targetLang,
          phonetic: '',
          source: 'gtx'
        };
      }
    }
  } catch (gtxErr) {
    console.warn('[Translator] Google GTX xatosi:', gtxErr?.message || gtxErr);
  }

  // 3. Fallback: MyMemory API
  try {
    const pair = forcedTarget === 'uz' ? 'en|uz' : 'uz|en';
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=${pair}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const mmRes = await fetch(myMemoryUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (mmRes.ok) {
      const mmData = await mmRes.json();
      if (mmData && mmData.responseData && mmData.responseData.translatedText) {
        return {
          success: true,
          original: clean,
          translated: mmData.responseData.translatedText.trim(),
          source: 'mymemory'
        };
      }
    }
  } catch (mmErr) {
    console.warn('[Translator] MyMemory xatosi:', mmErr?.message || mmErr);
  }

  // 4. Hech qaysi tarjima ishlamasa (masalan, to'liq oflayn bo'lsa)
  return {
    success: false,
    original: clean,
    error: 'Internet mavjud emas yoki tarjima xizmatiga ulanib bo\'lmadi. So\'z va tarjimani qo\'lda kiritishingiz mumkin.'
  };
}
