/**
 * Ingly Mobile App - Smart Translator Service (v4.0)
 * 
 * Foydalanuvchi kiritgan so'z yoki iborani o'zbekchadan inglizchaga (yoki inglizchadan o'zbekchaga)
 * bir zumda tarjima qilish, imlo xatolarini avtomatik to'g'rilash va kartochka parametrlarini tayyorlash.
 * 
 * Imkoniyatlar:
 * 1. Foydalanuvchi so'zni xato (typo: 'aple', 'computr', 'freind', 'techer') yozganda:
 *    - To'g'ri o'zbekcha tarjimasi aniqlanadi.
 *    - Imlo xatosi to'g'rilanib, to'g'ri inglizcha shakli olinadi ('aple' -> 'apple').
 *    - Kartochkaga to'g'ri so'z va to'g'ri tarjima saqlanadi.
 * 2. 4000 Essential English Words oflayn bazasidan bir zumda qidiruv.
 * 3. O'zbekcha so'z kiritilganda inglizchaga ('kitob' -> 'book'), inglizcha kiritilganda o'zbekchaga ('book' -> 'kitob').
 * 4. Google Chrome Extension Shlyuzi: yuqori tezlik, bepul va hech qanday cheklovlarsiz.
 */

import allWordsData from '../data/all_words.json';
import { getStorageItem, setStorageItem, captureStorageSession, isStorageSessionCurrent } from './storage.js';
const CACHE_KEY = '@ingly_translation_cache';

/**
 * Matnni tozalash va apostroflarni standartlashtirish
 */
export function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[ʻʼ`‘’]/g, "'")
    .replace(/\s+/g, ' ');
}

/**
 * Mahalliy 4000 ta so'z bazasidan tezkor qidirish (Oflayn)
 */
export function searchInLocalDictionary(rawQuery) {
  if (!rawQuery || !Array.isArray(allWordsData)) return null;
  const clean = normalizeText(rawQuery);
  if (!clean) return null;

  // 1. Aniq inglizcha so'z mosligi
  const exactEn = allWordsData.find(w => normalizeText(w.word) === clean);
  if (exactEn) {
    return {
      wordEn: exactEn.word,
      wordUz: exactEn.uzbek,
      phonetic: exactEn.ipa || exactEn.phonetic || '',
      pos: exactEn.pos || '',
      definition: exactEn.desc || exactEn.definition || '',
      example: exactEn.exam || exactEn.example || '',
      correctedFrom: null,
      source: 'local_exact_en'
    };
  }

  // 2. Aniq o'zbekcha tarjima mosligi
  const exactUz = allWordsData.find(w => {
    const uz = normalizeText(w.uzbek);
    if (uz === clean) return true;
    const parts = uz.split(/[,;\/]/).map(s => normalizeText(s));
    return parts.includes(clean);
  });
  if (exactUz) {
    return {
      wordEn: exactUz.word,
      wordUz: exactUz.uzbek,
      phonetic: exactUz.ipa || exactUz.phonetic || '',
      pos: exactUz.pos || '',
      definition: exactUz.desc || exactUz.definition || '',
      example: exactUz.exam || exactUz.example || '',
      correctedFrom: null,
      source: 'local_exact_uz'
    };
  }

  return null;
}

/**
 * Google Translate Shlyuzi
 */
async function fetchGoogle(word, sl, tl) {
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(word)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      if (Array.isArray(data[0])) return { text: data[0][0], detected: data[0][1] };
      if (typeof data[0] === 'string') return { text: data[0], detected: sl };
    }
    return null;
  } catch (e) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Asosiy aqlli tarjima funksiyasi
 * @param {string} text Tarjima qilinadigan so'z yoki ibora
 */
async function translateUncached(text) {
  if (!text || !text.trim()) {
    return { success: false, error: 'Iltimos, so\'z yoki ibora kiriting!' };
  }

  const rawClean = text.trim();

  // 1. Mahalliy 4000 ta so'zlar bazasidan qidirish (Oflayn)
  const localResult = searchInLocalDictionary(rawClean);
  if (localResult) {
    return {
      success: true,
      ...localResult,
      isLocal: true,
    };
  }

  // 2. Onlayn aqlli tarjima va imlo to'g'rilash (Google Smart Engine)
  try {
    // 2.1 Tilni avtomatik aniqlash uchun zond so'rov
    const probe = await fetchGoogle(rawClean, 'auto', 'uz');
    if (probe && probe.text) {
      // Agar o'zbek tili deb aniqlangan bo'lsa (masalan 'kitob', 'maktab', 'salom')
      if (probe.detected === 'uz') {
        const enRes = await fetchGoogle(rawClean, 'uz', 'en');
        const finalEn = enRes && enRes.text ? enRes.text : probe.text;

        return {
          success: true,
          wordUz: rawClean,
          wordEn: finalEn,
          phonetic: '',
          pos: '',
          definition: '',
          example: '',
          correctedFrom: null,
          source: 'google_uz_to_en'
        };
      } else {
        // Agar ingliz tili (yoki imlo xatosi bilan yozilgan so'z) bo'lsa:
        // Masalan: 'aple', 'computr', 'freind', 'techer', 'apple'
        const uzRes = await fetchGoogle(rawClean, 'en', 'uz');
        const finalUz = uzRes && uzRes.text ? uzRes.text : probe.text;

        // O'zbekcha tarjimadan to'g'ri inglizcha imlo shaklini qayta tekshirish (Typo Correction)
        let fixedEn = rawClean;
        if (finalUz) {
          try {
            const enCheck = await fetchGoogle(finalUz, 'uz', 'en');
            if (enCheck && enCheck.text) {
              let f = enCheck.text.trim();
              // "the world" kabi artiklni olib tashlash
              if (f.toLowerCase().startsWith('the ') && !rawClean.toLowerCase().startsWith('the ')) {
                f = f.substring(4).trim();
              }
              if (f.toLowerCase() !== rawClean.toLowerCase()) {
                fixedEn = f;
              }
            }
          } catch (e) {}
        }

        const wasCorrected = fixedEn.toLowerCase() !== rawClean.toLowerCase();

        return {
          success: true,
          wordEn: fixedEn,
          wordUz: finalUz,
          phonetic: '',
          pos: '',
          definition: '',
          example: '',
          correctedFrom: wasCorrected ? rawClean : null,
          source: 'google_en_to_uz'
        };
      }
    }
  } catch (err) {
    console.warn('[SmartTranslator] Tarjima xatosi:', err);
  }

  // 3. Fallback: MyMemory API (Zaxira)
  try {
    const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(rawClean)}&langpair=en|uz`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    let mmRes;
    try { mmRes = await fetch(mmUrl, { signal: controller.signal }); }
    finally { clearTimeout(timeout); }
    if (mmRes.ok) {
      const mmData = await mmRes.json();
      if (mmData && mmData.responseData && mmData.responseData.translatedText) {
        const transText = mmData.responseData.translatedText.trim();
        if (!transText.includes('MYMEMORY WARNING') && !transText.includes('HTTP ERROR')) {
          return {
            success: true,
            wordEn: rawClean,
            wordUz: transText,
            phonetic: '',
            pos: '',
            definition: '',
            example: '',
            correctedFrom: null,
            source: 'mymemory'
          };
        }
      }
    }
  } catch (mmErr) {}

  return {
    success: false,
    error: 'Internetga ulanib bo\'lmadi yoki so\'z tarjima qilinmadi. Iltimos, internetingizni tekshiring.'
  };
}

export async function translateText(text, session = captureStorageSession()) {
  const local = searchInLocalDictionary(text);
  if (local) return { success: true, ...local, isLocal: true };
  const query = normalizeText(text);
  let cached = [];
  try { cached = await getStorageItem(CACHE_KEY, [], session); } catch {}
  if (!Array.isArray(cached)) cached = [];
  const hit = cached.find(item => item.query === query);
  if (hit) return { ...hit.result, isCached: true };
  const result = await translateUncached(text);
  if (result.success && isStorageSessionCurrent(session)) {
    await setStorageItem(CACHE_KEY, [{ query, result }, ...cached.filter(item => item.query !== query)].slice(0, 80), session);
  }
  return result;
}

export default {
  translateText,
  searchInLocalDictionary,
  normalizeText,
};
