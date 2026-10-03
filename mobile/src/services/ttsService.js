/**
 * Ingly Mobile App - Text-to-Speech (TTS) & Pronunciation Audio Service
 * 
 * So'zlar va misol gaplarni to'g'ri inglizcha talaffuzda eshittirish.
 * 1. Birinchi navbatda 'expo-speech' (yoki Web Speech API) orqali qurilmaning o'zida oflayn talaffuz qiladi.
 * 2. Agar mavjud bo'lsa, 'expo-av' orqali professional studiya MP3 audio fayllarini ijro etadi.
 */

let isCurrentlySpeaking = false;
let currentSoundInstance = null;

/**
 * Expo Speech kutubxonasini xavfsiz yuklash
 */
function getExpoSpeech() {
  try {
    return require('expo-speech');
  } catch {
    return null;
  }
}

/**
 * Expo AV Audio kutubxonasini xavfsiz yuklash
 */
function getExpoAudio() {
  try {
    return require('expo-av').Audio;
  } catch {
    return null;
  }
}

/**
 * So'z yoki gapni TTS orqali talaffuz qilish
 * @param {string} text Talaffuz qilinadigan matn
 * @param {Object} options Sozlamalar: { language: 'en-US', rate: 0.85, pitch: 1.0 }
 */
export async function speak(text, options = {}) {
  if (!text || !text.trim()) return false;

  const cleanText = text.replace(/<[^>]*>?/gm, '').trim(); // HTML teglarini olib tashlash
  const speechOptions = {
    language: options.language || 'en-US',
    pitch: options.pitch || 1.0,
    rate: options.rate || 0.85, // Yangi o'rganuvchilar uchun qulay va aniq tezlik
    onStart: () => {
      isCurrentlySpeaking = true;
      if (options.onStart) options.onStart();
    },
    onDone: () => {
      isCurrentlySpeaking = false;
      if (options.onDone) options.onDone();
    },
    onError: (err) => {
      isCurrentlySpeaking = false;
      console.warn('[TTS] Xatolik:', err);
      if (options.onError) options.onError(err);
    },
  };

  // 1. Expo Speech tekshiruvi (Mobil qurilma)
  const expoSpeech = getExpoSpeech();
  if (expoSpeech && typeof expoSpeech.speak === 'function') {
    try {
      await stop();
      expoSpeech.speak(cleanText, speechOptions);
      return true;
    } catch (e) {
      console.warn('Expo speech speak xatosi:', e);
    }
  }

  // 2. Web Speech API (Agar Expo Web yoki brauzerda ochilgan bo'lsa)
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = speechOptions.language;
      utterance.rate = speechOptions.rate;
      utterance.pitch = speechOptions.pitch;
      utterance.onend = () => { isCurrentlySpeaking = false; };
      utterance.onerror = () => { isCurrentlySpeaking = false; };
      
      isCurrentlySpeaking = true;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (webErr) {
      console.warn('Web Speech API xatosi:', webErr);
    }
  }

  console.info(`[TTS Fallback - No Engine] O'qilishi kerak bo'lgan matn: "${cleanText}"`);
  return false;
}

/**
 * Bitta so'zni talaffuz qilish (Aniqroq va sekinroq tezlik)
 */
export async function speakWord(word, options = {}) {
  return await speak(word, { rate: 0.82, ...options });
}

/**
 * Misol gapni talaffuz qilish (Tabiiy jonli muloqot tezligi)
 */
export async function speakSentence(sentence, options = {}) {
  return await speak(sentence, { rate: 0.95, ...options });
}

/**
 * Nutqni to'xtatish
 */
export async function stop() {
  isCurrentlySpeaking = false;

  const expoSpeech = getExpoSpeech();
  if (expoSpeech && typeof expoSpeech.stop === 'function') {
    try {
      expoSpeech.stop();
    } catch {}
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  if (currentSoundInstance) {
    try {
      await currentSoundInstance.stopAsync();
      await currentSoundInstance.unloadAsync();
      currentSoundInstance = null;
    } catch {}
  }
}

/**
 * Serverdagi original studiya MP3 audiosini ijro etish (Agar rasm/audio URL mavjud bo'lsa)
 */
export async function playAudioUrl(audioUrl) {
  if (!audioUrl) return false;

  await stop();

  // 1. Expo AV Audio orqali ijro etish
  const Audio = getExpoAudio();
  if (Audio) {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      currentSoundInstance = sound;
      isCurrentlySpeaking = true;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          isCurrentlySpeaking = false;
        }
      });
      return true;
    } catch (avErr) {
      console.warn('Expo Audio ijro etish xatosi:', avErr);
    }
  }

  // 2. Web brauzer Audio elementi
  if (typeof window !== 'undefined' && window.Audio) {
    try {
      const audio = new window.Audio(audioUrl);
      audio.play();
      return true;
    } catch {}
  }

  return false;
}

/**
 * Hozir ovoz yangrayaptimi?
 */
export function isSpeaking() {
  return isCurrentlySpeaking;
}
