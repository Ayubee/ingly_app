/**
 * Ingly Mobile App - Words Data & Content Management Service
 * 
 * "4000 Essential English Words" (Book 1 - Book 6) uchun markaziy ma'lumotlar servisi.
 * Internetsiz to'liq oflayn ishlaydi. 
 * Foydalanuvchining shaxsiy o'rganish progressi (storage.js) bilan avtomatik birlashtiriladi.
 */

import { getAllProgress, getFavorites, getWordProgress, captureStorageSession, isStorageSessionCurrent } from './storage';
import bundledWords from '../data/all_words.json';
const bundledIndex = new Map(bundledWords.map(word => [Number(word.id), word]));

// 6 ta kitobning umumiy konfiguratsiyasi
export const BOOKS_METADATA = [
  {
    id: 1,
    book_number: 1,
    title: '4000 Essential English Words 1',
    level: 'Beginner (A1-A2)',
    description: 'Ingliz tilini endi boshlaganlar uchun eng zarur va faol 600 ta asosiy soʻzlar.',
    total_units: 30,
    words_per_unit: 20,
    total_words: 600,
    is_free: true,
    color_gradient: ['#3B82F6', '#4F46E5'], // Blue -> Indigo
    accent_color: '#4F46E5',
    icon: 'book-open-outline',
  },
  {
    id: 2,
    book_number: 2,
    title: '4000 Essential English Words 2',
    level: 'Elementary (A2)',
    description: 'Kundalik muloqot va oʻqish uchun moʻljallangan 600 ta yangi soʻzlar.',
    total_units: 30,
    words_per_unit: 20,
    total_words: 600,
    is_free: true,
    color_gradient: ['#10B981', '#0D9488'], // Emerald -> Teal
    accent_color: '#0D9488',
    icon: 'school-outline',
  },
  {
    id: 3,
    book_number: 3,
    title: '4000 Essential English Words 3',
    level: 'Pre-Intermediate (B1)',
    description: 'Oʻrta darajaga oʻtish, boyroq gap tuzish va fikrni erkin bayon qilish soʻzlari.',
    total_units: 30,
    words_per_unit: 20,
    total_words: 600,
    is_free: true,
    color_gradient: ['#F59E0B', '#EA580C'], // Amber -> Orange
    accent_color: '#EA580C',
    icon: 'trophy-outline',
  },
  {
    id: 4,
    book_number: 4,
    title: '4000 Essential English Words 4',
    level: 'Intermediate (B1-B2)',
    description: 'Murakkab matnlar va ilmiy tushunchalarni oʻz ichiga olgan 600 ta soʻz.',
    total_units: 30,
    words_per_unit: 20,
    total_words: 600,
    is_free: true,
    color_gradient: ['#F43F5E', '#E11D48'], // Rose -> Crimson
    accent_color: '#E11D48',
    icon: 'rocket-outline',
  },
  {
    id: 5,
    book_number: 5,
    title: '4000 Essential English Words 5',
    level: 'Upper-Intermediate (B2)',
    description: 'Akademik ingliz tili, IELTS/CEFR tayyorgarligi va rasmiy muloqot soʻzlari.',
    total_units: 30,
    words_per_unit: 20,
    total_words: 600,
    is_free: true,
    color_gradient: ['#8B5CF6', '#7C3AED'], // Violet -> Purple
    accent_color: '#7C3AED',
    icon: 'medal-outline',
  },
  {
    id: 6,
    book_number: 6,
    title: '4000 Essential English Words 6',
    level: 'Advanced (C1)',
    description: 'Eng yuqori darajadagi boy adabiy, professional va ilmiy lugʻat boyligi.',
    total_units: 30,
    words_per_unit: 20,
    total_words: 600,
    is_free: true,
    color_gradient: ['#6366F1', '#1E293B'], // Indigo -> Slate
    accent_color: '#4338CA',
    icon: 'diamond-outline',
  },
];

// Oflayn so'zlar bazasi (Dastlabki to'liq boyitilgan leksika)
// Book 1, Unit 1 va boshqa unitlar uchun namunaviy boyitilgan ma'lumotlar
const PRELOADED_CORE_WORDS = [
  // Book 1, Unit 1
  {
    id: 1,
    book: 1,
    unit: 1,
    word: 'afraid',
    phonetic: '/əˈfreɪd/',
    pos: 'adjective',
    uzbek: 'qoʻrqqan, xavfsiragan',
    definition: 'When someone is afraid, they feel fear.',
    definition_uz: 'Biror kimsa qoʻrqqanda, u xavf yoki vahimani his qiladi.',
    example: 'The woman was afraid of what she saw.',
    example_uz: 'Ayol koʻrgan narsasidan qoʻrqib ketdi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/afraid.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/afraid.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/afraid_clip.mp4',
  },
  {
    id: 2,
    book: 1,
    unit: 1,
    word: 'agree',
    phonetic: '/əˈɡriː/',
    pos: 'verb',
    uzbek: 'rozi boʻlmoq, fikriga qoʻshilmoq',
    definition: 'To agree is to have the same opinion or belief.',
    definition_uz: 'Rozi boʻlmoq — bir xil fikrda boʻlish yoki maʼqullashni bildiradi.',
    example: 'The students agreed that they have too much homework.',
    example_uz: 'Talabalar uy vazifasi juda koʻp ekanligiga rozilik bildirishdi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/agree.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/agree.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/agree_clip.mp4',
  },
  {
    id: 3,
    book: 1,
    unit: 1,
    word: 'angry',
    phonetic: '/ˈæŋɡri/',
    pos: 'adjective',
    uzbek: 'jahli chiqqan, dargʻazab',
    definition: 'When someone is angry, they want to speak loudly or fight.',
    definition_uz: 'Kimningdir jahli chiqqanda, u baqirib gapirishni yoki janjallashishni xohlaydi.',
    example: 'She didn’t do her homework, so her father was angry.',
    example_uz: 'U uy vazifasini qilmadi, shu sababli otasining jahli chiqdi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/angry.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/angry.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/angry_clip.mp4',
  },
  {
    id: 4,
    book: 1,
    unit: 1,
    word: 'arrive',
    phonetic: '/əˈraɪv/',
    pos: 'verb',
    uzbek: 'yetib kelmoq, kelmoq',
    definition: 'To arrive is to get to or reach some place.',
    definition_uz: 'Yetib kelmoq — biron bir joyga borish yoki yetib borish.',
    example: 'The bus always arrives at the corner of my street at 4:00.',
    example_uz: 'Avtobus har doim koʻchamizning burchagiga soat 4:00 da yetib keladi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/arrive.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/arrive.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/arrive_clip.mp4',
  },
  {
    id: 5,
    book: 1,
    unit: 1,
    word: 'attack',
    phonetic: '/əˈtæk/',
    pos: 'verb',
    uzbek: 'hujum qilmoq',
    definition: 'To attack is to try to fight or to hurt.',
    definition_uz: 'Hujum qilmoq — urushishga yoki jarohat yetkazishga urinish.',
    example: 'The man with the sword attacked the other man first.',
    example_uz: 'Qilich ushlagan odam birinchi boʻlib ikkinchisiga hujum qildi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/attack.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/attack.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/attack_clip.mp4',
  },
  {
    id: 6,
    book: 1,
    unit: 1,
    word: 'bottom',
    phonetic: '/ˈbɒtəm/',
    pos: 'noun',
    uzbek: 'tagi, osti, tubi',
    definition: 'The bottom is the lowest part of something.',
    definition_uz: 'Tagi — biron narsaning eng pastki qismi.',
    example: 'The bottom of my shoe has a hole in it.',
    example_uz: 'Poyabzalimning tagida teshik bor.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/bottom.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/bottom.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/bottom_clip.mp4',
  },
  {
    id: 7,
    book: 1,
    unit: 1,
    word: 'clever',
    phonetic: '/ˈklevər/',
    pos: 'adjective',
    uzbek: 'aqlli, ziyrak, uddaburon',
    definition: 'When someone is clever, they solve a problem quickly.',
    definition_uz: 'Ziyrak inson muammolarni tez va oson hal qiladi.',
    example: 'The clever boy thought of a good idea.',
    example_uz: 'Ziyrak bola ajoyib bir fikrni oʻylab topdi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/clever.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/clever.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/clever_clip.mp4',
  },
  {
    id: 8,
    book: 1,
    unit: 1,
    word: 'cruel',
    phonetic: '/ˈkruːəl/',
    pos: 'adjective',
    uzbek: 'shafqatsiz, zolim',
    definition: 'When someone is cruel, they do bad things to hurt others.',
    definition_uz: 'Shafqatsiz odam boshqalarga ozor yetkazish uchun yomon ishlar qiladi.',
    example: 'The cruel man yelled at his sister.',
    example_uz: 'Shafqatsiz odam singlisiga baqirdi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/cruel.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/cruel.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/cruel_clip.mp4',
  },
  {
    id: 9,
    book: 1,
    unit: 1,
    word: 'finally',
    phonetic: '/ˈfaɪnəli/',
    pos: 'adverb',
    uzbek: 'nihoyat, oxir-oqibat',
    definition: 'If something happens finally, it happens after a long time.',
    definition_uz: 'Nihoyat — uzoq kutilgan vaqt yoki harakatdan keyin sodir boʻlgan holat.',
    example: 'He finally crossed the finish line after five hours of running.',
    example_uz: 'U besh soat yugurgandan soʻng, nihoyat marra chizigʻini kesib oʻtdi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/finally.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/finally.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/finally_clip.mp4',
  },
  {
    id: 10,
    book: 1,
    unit: 1,
    word: 'hide',
    phonetic: '/haɪd/',
    pos: 'verb',
    uzbek: 'yashirmoq, yashirinmoq',
    definition: 'To hide is to try not to let others see you.',
    definition_uz: 'Yashirinmoq — boshqalar koʻrmaydigan joyga bekinish.',
    example: 'The other children will hide while you count to 100.',
    example_uz: 'Sen 100 gacha sanaguningcha boshqa bolalar yashirinadi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/hide.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/hide.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/hide_clip.mp4',
  },
  {
    id: 11,
    book: 1,
    unit: 1,
    word: 'hunt',
    phonetic: '/hʌnt/',
    pos: 'verb',
    uzbek: 'ov qilmoq, qidirmoq',
    definition: 'To hunt is to look for or search for an animal to kill.',
    definition_uz: 'Ov qilmoq — hayvonlarni tutish yoki ovlash maqsadida qidirish.',
    example: 'Long ago, people hunted with bows and arrows.',
    example_uz: 'Qadimda odamlar kamon va oʻqlar bilan ov qilishgan.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/hunt.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/hunt.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/hunt_clip.mp4',
  },
  {
    id: 12,
    book: 1,
    unit: 1,
    word: 'lot',
    phonetic: '/lɒt/',
    pos: 'noun',
    uzbek: 'koʻp, juda koʻp miqdor',
    definition: 'A lot means a large number or amount of people, animals, or things.',
    definition_uz: 'Koʻp — odamlar, narsalar yoki hayvonlarning katta miqdori.',
    example: 'There are a lot of apples in the basket.',
    example_uz: 'Savatda juda koʻp olmalar bor.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/lot.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/lot.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/lot_clip.mp4',
  },
  {
    id: 13,
    book: 1,
    unit: 1,
    word: 'middle',
    phonetic: '/ˈmɪdəl/',
    pos: 'noun',
    uzbek: 'oʻrtasi, markazi',
    definition: 'The middle of something is the center or halfway point.',
    definition_uz: 'Oʻrtasi — biron narsaning markazi yoki teng yarmi.',
    example: 'The Canadian flag has a maple leaf in the middle of it.',
    example_uz: 'Kanada bayrogʻining oʻrtasida chinor bargi bor.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/middle.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/middle.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/middle_clip.mp4',
  },
  {
    id: 14,
    book: 1,
    unit: 1,
    word: 'moment',
    phonetic: '/ˈməʊmənt/',
    pos: 'noun',
    uzbek: 'lahza, on, daqiqa',
    definition: 'A moment is a second or a very short time.',
    definition_uz: 'Lahza — sekund yoki juda qisqa vaqt oraligʻi.',
    example: 'I was only a few moments late for the meeting.',
    example_uz: 'Men uchrashuvga atigi bir necha lahza kechikdim.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/moment.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/moment.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/moment_clip.mp4',
  },
  {
    id: 15,
    book: 1,
    unit: 1,
    word: 'pleased',
    phonetic: '/pliːzd/',
    pos: 'adjective',
    uzbek: 'mamnun, xursand',
    definition: 'When someone is pleased, they are happy.',
    definition_uz: 'Mamnun — xursand boʻlgan va qanoat hosil qilgan holat.',
    example: 'She was pleased with her phone exam results.',
    example_uz: 'U imtihon natijalaridan juda mamnun boʻldi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/pleased.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/pleased.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/pleased_clip.mp4',
  },
  {
    id: 16,
    book: 1,
    unit: 1,
    word: 'promise',
    phonetic: '/ˈprɒmɪs/',
    pos: 'verb',
    uzbek: 'vaʼda bermoq',
    definition: 'To promise is to say you will definitely do something for sure.',
    definition_uz: 'Vaʼda bermoq — biror ishni albatta bajarishini aytish.',
    example: 'He promised to return my book tomorrow.',
    example_uz: 'U ertaga kitobimni qaytarib berishga vaʼda berdi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/promise.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/promise.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/promise_clip.mp4',
  },
  {
    id: 17,
    book: 1,
    unit: 1,
    word: 'reply',
    phonetic: '/rɪˈplaɪ/',
    pos: 'verb',
    uzbek: 'javob bermoq, javob qaytarmoq',
    definition: 'To reply is to give an answer or say back to someone.',
    definition_uz: 'Javob bermoq — berilgan savolga javob aytish.',
    example: 'She asked him what time his plane arrived, but he did not reply.',
    example_uz: 'U samolyot qachon kelishini soʻradi, lekin u javob bermadi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/reply.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/reply.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/reply_clip.mp4',
  },
  {
    id: 18,
    book: 1,
    unit: 1,
    word: 'safe',
    phonetic: '/seɪf/',
    pos: 'adjective',
    uzbek: 'xavfsiz, bexatar',
    definition: 'When a person is safe, they are not in danger.',
    definition_uz: 'Xavfsiz — xavf-xatardan yiroq boʻlgan holat.',
    example: 'Put on your seat belt to be safe in the car.',
    example_uz: 'Mashinada xavfsiz boʻlish uchun xavfsizlik kamarini taqing.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/safe.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/safe.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/safe_clip.mp4',
  },
  {
    id: 19,
    book: 1,
    unit: 1,
    word: 'trick',
    phonetic: '/trɪk/',
    pos: 'noun',
    uzbek: 'hiyla, nayrang, fokus',
    definition: 'A trick is something you do to fool another person.',
    definition_uz: 'Hiyla — boshqa odamni aldash yoki chalgʻitish uchun qilinadigan harakat.',
    example: 'His card trick really surprised all of us.',
    example_uz: 'Uning karta bilan koʻrsatgan fokusi barchamizni hayratda qoldirdi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/trick.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/trick.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/trick_clip.mp4',
  },
  {
    id: 20,
    book: 1,
    unit: 1,
    word: 'well',
    phonetic: '/wel/',
    pos: 'adverb',
    uzbek: 'yaxshi, aʼlo darajada',
    definition: 'You use well to say that something was done in a good way.',
    definition_uz: 'Yaxshi — biror ish namunali va toʻgʻri bajarilganini bildiradi.',
    example: 'The couple can dance quite well together.',
    example_uz: 'Bu juftlik birgalikda juda yaxshi raqsga tushishadi.',
    image_url: 'https://storage.ingly.uz/words/book1/unit1/well.webp',
    audio_url: 'https://storage.ingly.uz/words/book1/unit1/well.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book1/unit1/well_clip.mp4',
  },

  // Book 2, Unit 1 Namunaviy
  {
    id: 601,
    book: 2,
    unit: 1,
    word: 'anxious',
    phonetic: '/ˈæŋkʃəs/',
    pos: 'adjective',
    uzbek: 'xavotirli, bezovta',
    definition: 'When a person is anxious, they worry that something bad will happen.',
    definition_uz: 'Inson xavotirda boʻlganda, yomon narsa yuz berishidan qoʻrqadi.',
    example: 'She was anxious about not making her appointment on time.',
    example_uz: 'U uchrashuviga oʻz vaqtida yetib borolmasligidan xavotirda edi.',
    image_url: 'https://storage.ingly.uz/words/book2/unit1/anxious.webp',
    audio_url: 'https://storage.ingly.uz/words/book2/unit1/anxious.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book2/unit1/anxious_clip.mp4',
  },
  {
    id: 602,
    book: 2,
    unit: 1,
    word: 'awful',
    phonetic: '/ˈɔːfəl/',
    pos: 'adjective',
    uzbek: 'juda yomon, daxshatli',
    definition: 'When something is awful, it is very bad.',
    definition_uz: 'Juda yomon — yoqimsiz va past sifatli.',
    example: 'Her performance last night was awful.',
    example_uz: 'Kecha kechqurun uning chiqishi juda yomon boʻldi.',
    image_url: 'https://storage.ingly.uz/words/book2/unit1/awful.webp',
    audio_url: 'https://storage.ingly.uz/words/book2/unit1/awful.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book2/unit1/awful_clip.mp4',
  },
  {
    id: 603,
    book: 2,
    unit: 1,
    word: 'consist',
    phonetic: '/kənˈsɪst/',
    pos: 'verb',
    uzbek: 'iborat boʻlmoq',
    definition: 'To consist of is to be made of parts or things.',
    definition_uz: 'Iborat boʻlmoq — biror qismlardan yoki tarkibdan tashkil topish.',
    example: 'The team consists of four students.',
    example_uz: 'Jamoa toʻrtta talabadan iborat.',
    image_url: 'https://storage.ingly.uz/words/book2/unit1/consist.webp',
    audio_url: 'https://storage.ingly.uz/words/book2/unit1/consist.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book2/unit1/consist_clip.mp4',
  },
  {
    id: 604,
    book: 2,
    unit: 1,
    word: 'desire',
    phonetic: '/dɪˈzaɪər/',
    pos: 'verb',
    uzbek: 'orzu qilmoq, qattiq xohlamoq',
    definition: 'To desire is to want something strongly.',
    definition_uz: 'Qattiq xohlamoq — biror narsaga erishishni chin dildan istamoq.',
    example: 'My sister desires a big house and lots of books.',
    example_uz: 'Singlim katta uy va koʻplab kitoblarni orzu qiladi.',
    image_url: 'https://storage.ingly.uz/words/book2/unit1/desire.webp',
    audio_url: 'https://storage.ingly.uz/words/book2/unit1/desire.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book2/unit1/desire_clip.mp4',
  },
  {
    id: 605,
    book: 2,
    unit: 1,
    word: 'eager',
    phonetic: '/ˈiːɡər/',
    pos: 'adjective',
    uzbek: 'ishtiyoqmand, intiq',
    definition: 'When a person is eager, they are excited to do something.',
    definition_uz: 'Ishtiyoqmand — biror ishni boshlashga qiziqishi yuqori boʻlgan.',
    example: 'The man was eager to talk about the good news.',
    example_uz: 'Kishi xushxabarni aytishga intiq edi.',
    image_url: 'https://storage.ingly.uz/words/book2/unit1/eager.webp',
    audio_url: 'https://storage.ingly.uz/words/book2/unit1/eager.mp3',
    video_clip_url: 'https://storage.ingly.uz/words/book2/unit1/eager_clip.mp4',
  },
];

// Oflayn xotiradagi barcha so'zlar kesh jadvali
const wordsCache = new Map();

// Boshlang'ich so'zlarni xotiraga joylash
PRELOADED_CORE_WORDS.forEach((w) => wordsCache.set(Number(w.id), w));

/**
 * Deterministik ravishda boshqa unitlar uchun zaxira so'zlarni yaratish
 * (4000 ta so'z strukturasini to'liq saqlash va internetsiz ham bo'sh qolmasligi uchun)
 */
function getOrGenerateWord(bookNum, unitNum, wordIndex) {
  const bundled = bundledIndex.get((bookNum - 1) * 600 + (unitNum - 1) * 20 + wordIndex);
  if (bundled) return { ...bundled, phonetic: bundled.ipa || bundled.phonetic || '', definition: bundled.desc || '', example: bundled.exam || '' };

  const globalId = (bookNum - 1) * 600 + (unitNum - 1) * 20 + wordIndex;

  if (wordsCache.has(globalId)) {
    return wordsCache.get(globalId);
  }

  // Zaxira so'z obyekti (Offline fallback)
  const fallbackWord = {
    id: globalId,
    book: bookNum,
    unit: unitNum,
    word: `Word ${globalId}`,
    phonetic: `/wɜːd/`,
    pos: 'vocabulary',
    uzbek: `Soʻz ${globalId} (Tarjima)`,
    definition: `This is vocabulary item #${globalId} from Book ${bookNum}, Unit ${unitNum}.`,
    definition_uz: `Bu Book ${bookNum}, Unit ${unitNum} darsining ${wordIndex}-soʻzidir.`,
    example: `Practice using this word in Book ${bookNum} Unit ${unitNum}.`,
    example_uz: `Ushbu soʻzni ${bookNum}-kitob ${unitNum}-darsda qoʻllashni mashq qiling.`,
    image_url: `https://storage.ingly.uz/words/book${bookNum}/unit${unitNum}/${globalId}.webp`,
    audio_url: `https://storage.ingly.uz/words/book${bookNum}/unit${unitNum}/${globalId}.mp3`,
    video_clip_url: `https://storage.ingly.uz/words/book${bookNum}/unit${unitNum}/${globalId}_clip.mp4`,
  };

  wordsCache.set(globalId, fallbackWord);
  return fallbackWord;
}

// =============================================================================
// ASOSIY EXPORT FUNKSIYALARI (PUBLIC API)
// =============================================================================

/**
 * 6 ta kitob ro'yxatini foydalanuvchining umumiy progressi bilan olish
 */
export async function getBooks(owner = captureStorageSession()) {
  const allProgress = await getAllProgress(owner);

  return BOOKS_METADATA.map((b) => {
    let masteredCount = 0;
    let reviewCount = 0;
    let hardCount = 0;

    // Ushbu kitobga tegishli barcha so'zlar ID oralig'i:
    const startId = (b.book_number - 1) * 600 + 1;
    const endId = b.book_number * 600;

    for (let id = startId; id <= endId; id++) {
      const p = allProgress[String(id)];
      if (p) {
        if (p.completed || p.status === 'mastered') masteredCount++;
        else if (p.status === 'review') reviewCount++;
        else if (p.status === 'hard') hardCount++;
      }
    }

    const totalLearned = masteredCount + reviewCount + hardCount;
    const progressPercent = Math.min(100, Math.round((masteredCount / b.total_words) * 100));

    return {
      ...b,
      mastered_words: masteredCount,
      review_words: reviewCount,
      hard_words: hardCount,
      total_learned: totalLearned,
      progress_percent: progressPercent,
    };
  });
}

/**
 * Bitta kitob tafsilotini olish
 */
export async function getBook(bookNumber, owner = captureStorageSession()) {
  const books = await getBooks(owner);
  if (!isStorageSessionCurrent(owner)) return null;
  return books.find((b) => b.book_number === Number(bookNumber)) || books[0];
}

/**
 * Kitobdagi barcha 30 ta dars (unitlar) ro'yxatini olish
 */
export async function getUnits(bookNumber, owner = captureStorageSession()) {
  const bNum = Number(bookNumber);
  const allProgress = await getAllProgress(owner);
  const units = [];

  for (let u = 1; u <= 30; u++) {
    const startId = (bNum - 1) * 600 + (u - 1) * 20 + 1;
    const endId = startId + 19;

    let mastered = 0;
    let reviewing = 0;
    let hard = 0;

    for (let wid = startId; wid <= endId; wid++) {
      const prog = allProgress[String(wid)];
      if (prog) {
        if (prog.completed || prog.status === 'mastered') mastered++;
        else if (prog.status === 'review') reviewing++;
        else if (prog.status === 'hard') hard++;
      }
    }

    const isCompleted = mastered === 20;

    units.push({
      unit_number: u,
      book_number: bNum,
      title: `Unit ${u}`,
      description: `Book ${bNum} - ${u}-dars (20 ta soʻz)`,
      total_words: 20,
      mastered_count: mastered,
      reviewing_count: reviewing,
      hard_count: hard,
      is_completed: isCompleted,
      progress_percent: Math.round((mastered / 20) * 100),
    });
  }

  return units;
}

/**
 * Berilgan kitob va darsdagi 20 ta so'zni foydalanuvchi progressi bilan olish
 * (Supabase bulut bazasidagi eng so'nggi yangilangan so'zlarni ham avtomatik tortadi)
 */
export async function getUnitWords(bookNumber, unitNumber, owner = captureStorageSession()) {
  const bNum = Number(bookNumber);
  const uNum = Number(unitNumber);
  const allProgress = await getAllProgress(owner);
  const favorites = new Set((await getFavorites(owner)).map(Number));

  // Bundled content is immediately available; opening a lesson needs no network round trip.
  const words = [];
  for (let i = 1; i <= 20; i++) {
    // Agar Supabase bazasida admin kiritgan so'z bo'lsa uni olamiz, aks holda oflayn bazadan
    const wordObj = getOrGenerateWord(bNum, uNum, i);
    const prog = allProgress[String(wordObj.id)] || null;

    words.push({
      ...wordObj,
      status: prog ? prog.status : null,
      is_mastered: !!prog?.completed || prog?.status === 'mastered',
      is_hard: prog?.status === 'hard',
      is_review: prog?.status === 'review',
      review_count: prog ? prog.review_count || 0 : 0,
      is_favorite: favorites.has(Number(wordObj.id)) || !!prog?.is_favorite,
      last_reviewed_at: prog ? prog.last_reviewed_at : null,
    });
  }

  return isStorageSessionCurrent(owner) ? words : [];
}

/**
 * ID bo'yicha bitta so'z ma'lumotini olish
 */
export async function getWordById(wordId, owner = captureStorageSession()) {
  const idNum = Number(wordId);
  const prog = await getWordProgress(idNum, owner);
  const favorites = new Set((await getFavorites(owner)).map(Number));

  // Qaysi kitob va unitdaligini hisoblash
  const bookNum = Math.floor((idNum - 1) / 600) + 1;
  const remainderInBook = (idNum - 1) % 600;
  const unitNum = Math.floor(remainderInBook / 20) + 1;
  const wordIndex = (remainderInBook % 20) + 1;

  const baseWord = getOrGenerateWord(bookNum, unitNum, wordIndex);

  if (!isStorageSessionCurrent(owner)) return null;
  return {
    ...baseWord,
    status: prog ? prog.status : null,
    is_mastered: !!prog?.completed || prog?.status === 'mastered',
    is_hard: prog?.status === 'hard',
    is_review: prog?.status === 'review',
    review_count: prog ? prog.review_count || 0 : 0,
    is_favorite: favorites.has(idNum) || !!prog?.is_favorite,
  };
}

/**
 * So'zlarni qidirish (Inglizcha so'z, O'zbekcha tarjima yoki ta'rif bo'yicha)
 */
export async function searchWords(query, limit = 50, owner = captureStorageSession()) {
  if (!query || !query.trim()) return [];

  const q = query.trim().toLowerCase();
  const allProgress = await getAllProgress(owner);
  const results = [];

  // Avval xotiradagi barcha mavjud so'zlar bo'ylab qidiramiz
  for (const word of wordsCache.values()) {
    const matchWord = word.word && word.word.toLowerCase().includes(q);
    const matchUzbek = word.uzbek && word.uzbek.toLowerCase().includes(q);
    const matchDef = word.definition && word.definition.toLowerCase().includes(q);

    if (matchWord || matchUzbek || matchDef) {
      const prog = allProgress[String(word.id)];
      results.push({
        ...word,
        status: prog?.status || null,
        is_favorite: prog?.is_favorite || false,
      });

      if (results.length >= limit) break;
    }
  }

  return isStorageSessionCurrent(owner) ? results : [];
}

/**
 * O'rganish statusi bo'yicha so'zlar ro'yxatini olish ('hard', 'review', 'mastered')
 */
export async function getWordsByStatus(status, owner = captureStorageSession()) {
  const allProgress = await getAllProgress(owner);
  const matchingWords = [];

  for (const [idStr, prog] of Object.entries(allProgress)) {
    if (prog.status === status) {
      const wordObj = await getWordById(Number(idStr), owner);
      matchingWords.push(wordObj);
    }
  }

  return isStorageSessionCurrent(owner) ? matchingWords : [];
}

/**
 * Barcha sevimli so'zlar ro'yxatini olish
 */
export async function getFavoriteWords(owner = captureStorageSession()) {
  const favIds = await getFavorites(owner);
  const words = [];

  for (const id of favIds) {
    const wordObj = await getWordById(id, owner);
    if (wordObj) words.push(wordObj);
  }

  return isStorageSessionCurrent(owner) ? words : [];
}

/**
 * Foydalanuvchining butun ilova bo'yicha umumiy statistikasi
 */
export async function getOverviewStats(owner = captureStorageSession()) {
  const allProgress = await getAllProgress(owner);
  let mastered = 0;
  let review = 0;
  let hard = 0;

  Object.values(allProgress).forEach((item) => {
    if (item.completed || item.status === 'mastered') mastered++;
    else if (item.status === 'review') review++;
    else if (item.status === 'hard') hard++;
  });

  return {
    total_words: 3600,
    mastered,
    review,
    hard,
    total_learned: mastered + review + hard,
    percent_overall: Math.round((mastered / 3600) * 100),
  };
}
