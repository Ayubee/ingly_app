import { isolateStorage } from './environment.js';
// One atomic account journal: learning state and its pending operations commit together.
export const STORAGE_KEYS = {
  WORD_PROGRESS: '@ingly_word_progress',
  SYNC_QUEUE: '@ingly_sync_queue',
  USER_STREAKS: '@ingly_user_streaks',
  FAVORITES: '@ingly_favorites',
  APP_SETTINGS: '@ingly_app_settings',
  USER_PROFILE: '@ingly_user_profile',
  REGISTERED_USERS: '@ingly_registered_users',
  CUSTOM_WORDS: '@ingly_custom_words',
  SAVED_CARDS: '@ingly_saved_cards',
  DISMISSED_ANNOUNCEMENTS: '@ingly_dismissed_announcements'
};
export const JOURNAL_KEY = '@ingly_local_v3';
const privateKeys = new Set([...Object.values(STORAGE_KEYS).filter(k => k !== STORAGE_KEYS.APP_SETTINGS), 'ingly_transactions', 'ingly_cached_leaderboard', 'ingly_mock_entitlements', '@ingly_translation_cache']);
function adapter() {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    if (typeof window !== 'undefined' && window.localStorage) return {
      getItem: async k => window.localStorage.getItem(k),
      setItem: async (k, v) => window.localStorage.setItem(k, v),
      removeItem: async k => window.localStorage.removeItem(k)
    };
    // A volatile fallback must never claim that learning has been durably saved.
    return {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('Durable storage unavailable.');
      },
      removeItem: async () => {}
    };
  }
}
const nativeStorage = isolateStorage(adapter());
let accountId = null,
  generation = 0,
  sessionMarker;
const locks = new Map(),
  listeners = new Set();
const cleanedGeneration = new Map();
const clone = v => JSON.parse(JSON.stringify(v));
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const uid = () => `${Date.now().toString(36)}-${Array.from({
  length: 4
}, () => Math.random().toString(36).slice(2)).join('-')}`;
const accountKey = (id, key) => `@ingly_account:${id}:${key}`;
const fail = (message, code) => Object.assign(new Error(message), {
  code
});
export function setStorageAccountId(id, marker) {
  id = id || null;
  if (id !== accountId || marker !== undefined && marker !== sessionMarker) generation++;
  accountId = id;
  if (marker !== undefined) sessionMarker = marker;
}
export function getStorageAccountId() {
  return accountId;
}
export function captureStorageSession(owner = accountId) {
  return object(owner) ? owner : {
    owner,
    generation
  };
}
export function isStorageSessionCurrent(t) {
  return !!t?.owner && t.owner === accountId && t.generation === generation;
}
function check(t) {
  if (!isStorageSessionCurrent(t)) throw fail('Account session changed.', 'SESSION_CHANGED');
}
export const authStorage = {
  getItem: k => nativeStorage.getItem(k),
  setItem: (k, v) => nativeStorage.setItem(k, v),
  removeItem: k => nativeStorage.removeItem(k)
};
export async function purgeLegacyCredentials() {
  await nativeStorage.removeItem(STORAGE_KEYS.REGISTERED_USERS);
  await nativeStorage.removeItem(STORAGE_KEYS.SAVED_CARDS);
  const raw = await nativeStorage.getItem(STORAGE_KEYS.USER_PROFILE);
  if (raw) try {
    const old = JSON.parse(raw);
    delete old.password;
    delete old.password_hash;
    old.isLoggedIn = false;
    await nativeStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(old));
  } catch {
    await nativeStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
  }
}
export function onLocalStateChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify(t, mutation) {
  if (isStorageSessionCurrent(t)) listeners.forEach(cb => {
    try {
      cb({
        ...t,
        mutation
      });
    } catch {}
  });
}
function validOperation(op, owner) {
  return object(op) && op.owner === owner && typeof op.id === 'string' && op.id.length > 0 && typeof op.device === 'string' && Number.isSafeInteger(op.sequence) && op.sequence > 0 && typeof op.epoch === 'string' && ['patch', 'reset'].includes(op.action) && object(op.changes) && Number.isSafeInteger(op.attempts) && op.attempts >= 0;
}
export function learningFields(p = {}) {
  const names = ['totalWordsLearned', 'wordsLearnedToday', 'streakDays', 'lastActiveDate', 'reviewedWordsCount', 'hardWordsCount', 'accuracy', 'bookProgress', 'bookLearnedCounts', 'completedUnits'];
  return Object.fromEntries(names.filter(k => p[k] !== undefined).map(k => [k, p[k]]));
}
function enqueue(s, changes, action = 'patch', nextEpoch = null) {
  if (!Object.keys(changes).length && action !== 'reset') return;
  const sequence = ++s.sequence;
  // Compact only an unattempted tail snapshot. Replacement always gets a NEW
  // operation ID: even a processor that already captured the tail cannot ack it.
  const tail = s.outbox.at(-1);
  if (action === 'patch' && tail?.action === 'patch' && tail.epoch === s.epoch && tail.attempts === 0) {
    const combined = {
      ...tail.changes,
      ...changes
    };
    if (Object.keys(combined).length <= 24 && JSON.stringify(combined).length < 24000) {
      changes = combined;
      s.outbox.pop();
    }
  }
  s.outbox.push({
    id: `${s.device}:${sequence}`,
    owner: s.owner,
    device: s.device,
    sequence,
    epoch: s.epoch,
    action,
    changes: clone(changes),
    next_epoch: nextEpoch,
    created_at: new Date().toISOString(),
    attempts: 0,
    last_attempt_at: null
  });
}
async function readJournal(t) {
  const raw = await nativeStorage.getItem(accountKey(t.owner, JOURNAL_KEY));
  check(t);
  if (raw === null) {
    await collectOrphans(t, []);
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw fail('Corrupt local journal; original retained.', 'LOCAL_CORRUPT');
  }
  if (parsed?.format !== 'pages') return raw; // Upgrade the earlier single-key journal safely.
  const prefix = accountKey(t.owner, JOURNAL_KEY) + ':page:';
  if (parsed.owner !== t.owner || !Array.isArray(parsed.parts) || parsed.parts.length > 1024 || !parsed.parts.every(k => typeof k === 'string' && k.startsWith(prefix))) throw fail('Corrupt journal manifest; original retained.', 'LOCAL_CORRUPT');
  let result = '';
  for (const key of parsed.parts) {
    const part = await nativeStorage.getItem(key);
    check(t);
    if (typeof part !== 'string') throw fail('Missing journal page; original retained.', 'LOCAL_CORRUPT');
    result += part;
  }
  if (result.length !== parsed.length) throw fail('Corrupt journal length; original retained.', 'LOCAL_CORRUPT');
  await collectOrphans(t, parsed.parts);
  return result;
}
async function collectOrphans(t, referenced) {
  if (!nativeStorage.getAllKeys || cleanedGeneration.get(t.owner) === t.generation) return;
  const prefix = accountKey(t.owner, JOURNAL_KEY) + ':page:',
    live = new Set(referenced);
  const keys = await nativeStorage.getAllKeys();
  check(t);
  for (const key of keys) if (key.startsWith(prefix) && !live.has(key)) {
    check(t);
    await nativeStorage.removeItem(key);
  }
  cleanedGeneration.set(t.owner, t.generation);
}
async function writeJournal(t, s) {
  // Small pages avoid Android CursorWindow limits. Commit the pointer ONLY after
  // every page exists, so an interrupted write leaves the previous journal valid.
  const key = accountKey(t.owner, JOURNAL_KEY),
    oldRaw = await nativeStorage.getItem(key);
  check(t);
  let old;
  try {
    old = JSON.parse(oldRaw);
  } catch {
    old = null;
  }
  const json = JSON.stringify(s),
    version = uid(),
    parts = [];
  try {
    for (let offset = 0; offset < json.length; offset += 65536) {
      check(t);
      const partKey = `${key}:page:${version}:${parts.length}`;
      await nativeStorage.setItem(partKey, json.slice(offset, offset + 65536));
      parts.push(partKey);
    }
    check(t);
    await nativeStorage.setItem(key, JSON.stringify({
      format: 'pages',
      owner: t.owner,
      parts,
      length: json.length
    }));
    check(t);
  } catch (error) {
    // Delete only pages proven unreferenced. An ambiguous native write outcome
    // retains pages, and the next valid startup collects orphaned pages.
    try {
      const current = JSON.parse(await nativeStorage.getItem(key));
      const live = new Set(current?.format === 'pages' ? current.parts : []);
      for (const partKey of parts) if (!live.has(partKey)) await nativeStorage.removeItem(partKey);
    } catch {}
    throw error;
  }
  if (old?.format === 'pages' && Array.isArray(old.parts)) for (const partKey of old.parts) {
    if (typeof partKey === 'string' && partKey.startsWith(key + ':page:')) try {
      await nativeStorage.removeItem(partKey);
    } catch {}
  }
}
async function load(t) {
  check(t);
  const raw = await readJournal(t);
  check(t);
  if (raw !== null) {
    let s;
    try {
      s = JSON.parse(raw);
    } catch {
      throw fail('Corrupt local journal; original retained.', 'LOCAL_CORRUPT');
    }
    if (!object(s) || s.schema !== 3 || s.owner !== t.owner || !object(s.values) || !Array.isArray(s.outbox) || !s.outbox.every(op => validOperation(op, t.owner)) || typeof s.device !== 'string' || typeof s.epoch !== 'string' || !Number.isSafeInteger(s.sequence) || s.sequence < 0 || s.outbox.some(op => op.sequence > s.sequence) || new Set(s.outbox.map(op => op.id)).size !== s.outbox.length) throw fail('Corrupt local journal; original retained.', 'LOCAL_CORRUPT');
    return s;
  }
  const s = {
    schema: 3,
    owner: t.owner,
    device: uid(),
    sequence: 0,
    epoch: 'initial',
    values: {},
    outbox: [],
    cursor: 0
  };
  // Ownership is knowable only for explicitly account-prefixed Phase 2 keys.
  for (const key of privateKeys) {
    if ([STORAGE_KEYS.REGISTERED_USERS, STORAGE_KEYS.SAVED_CARDS].includes(key)) continue;
    const old = await nativeStorage.getItem(accountKey(t.owner, key));
    check(t);
    if (old !== null) try {
      s.values[key] = JSON.parse(old);
    } catch {
      throw fail('Corrupt legacy private data; original retained.', 'LOCAL_CORRUPT');
    }
  }
  const legacy = s.values[STORAGE_KEYS.SYNC_QUEUE] || [];
  if (!Array.isArray(legacy) || !legacy.every(v => object(v) && Number.isInteger(Number(v.word_id)) && Number(v.word_id) > 0)) throw fail('Corrupt legacy queue; original retained.', 'LOCAL_CORRUPT');
  for (const item of legacy) enqueue(s, {
    [`word:${item.word_id}`]: {
      ...item,
      completed: item.status === 'mastered'
    }
  });
  const progress = s.values[STORAGE_KEYS.WORD_PROGRESS] || {};
  if (!object(progress)) throw fail('Corrupt word progress; original retained.', 'LOCAL_CORRUPT');
  for (const [id, item] of Object.entries(progress)) {
    if (!object(item)) throw fail('Corrupt word progress; original retained.', 'LOCAL_CORRUPT');
    item.completed = !!item.completed || item.status === 'mastered';
    item.book = item.book || Math.floor((Number(id) - 1) / 600) + 1;
    item.unit = item.unit || Math.floor((Number(id) - 1) % 600 / 20) + 1;
    enqueue(s, {
      [`word:${id}`]: item
    });
  }
  delete s.values[STORAGE_KEYS.SYNC_QUEUE];
  const profile = s.values[STORAGE_KEYS.USER_PROFILE];
  if (profile?.id === t.owner) {
    delete profile.password;
    delete profile.password_hash;
    enqueue(s, {
      learning: learningFields(profile)
    });
  }
  const legacyStreak = s.values[STORAGE_KEYS.USER_STREAKS];
  if (object(legacyStreak)) {
    const p = s.values[STORAGE_KEYS.USER_PROFILE] ||= { id: t.owner, isLoggedIn: true };
    if ((legacyStreak.last_activity_date || '') > (p.lastActiveDate || '')) {
      p.lastActiveDate = legacyStreak.last_activity_date;
      p.streakDays = legacyStreak.current_streak || 0;
      p.wordsLearnedToday = legacyStreak.words_learned_today || 0;
    }
    enqueue(s, { learning: learningFields(p) });
  }
  const custom = s.values[STORAGE_KEYS.CUSTOM_WORDS] || [];
  if (!Array.isArray(custom)) throw fail('Corrupt custom vocabulary; original retained.', 'LOCAL_CORRUPT');
  for (const item of custom) enqueue(s, {
    [`custom:${item.id}`]: item
  });
  check(t);
  await writeJournal(t, s);
  check(t);
  return s;
}
async function serialized(t, work) {
  const previous = locks.get(t.owner) || Promise.resolve();
  const job = previous.catch(() => {}).then(async () => {
    check(t);
    return work(await load(t));
  });
  locks.set(t.owner, job);
  try {
    return await job;
  } finally {
    if (locks.get(t.owner) === job) locks.delete(t.owner);
  }
}
export async function transactLocal(change, owner = accountId, mutation = false, notifyUI = false) {
  const t = captureStorageSession(owner);
  return serialized(t, async s => {
    const result = change(s);
    check(t);
    await writeJournal(t, s);
    check(t);
    if (mutation || notifyUI) notify(t, mutation);
    return result;
  });
}
export async function getSyncCursor(owner = accountId) {
  const t = captureStorageSession(owner);
  return serialized(t, s => s.cursor || 0);
}
export async function getLocalMutationState(owner = accountId) {
  const t = captureStorageSession(owner);
  return serialized(t, s => ({
    sequence: s.sequence,
    pendingPreferences: s.outbox.some(op => op.changes.preferences)
  }));
}
export async function getStorageItem(key, fallback = null, owner = accountId) {
  if (!privateKeys.has(key)) {
    try {
      const raw = await nativeStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  const t = captureStorageSession(owner);
  if (!isStorageSessionCurrent(t)) return fallback;
  try {
    return await serialized(t, s => clone(key === STORAGE_KEYS.SYNC_QUEUE ? s.outbox : s.values[key] ?? fallback));
  } catch (e) {
    if (e.code === 'SESSION_CHANGED') return fallback;
    throw e;
  }
}
export async function setStorageItem(key, value, owner = accountId) {
  try {
    if (!privateKeys.has(key)) await nativeStorage.setItem(key, JSON.stringify(value));else {
      if (key === STORAGE_KEYS.SYNC_QUEUE) throw new Error('Exact acknowledgement required.');
      await transactLocal(s => {
        s.values[key] = clone(value);
      }, owner);
    }
    return true;
  } catch {
    return false;
  }
}
export async function removeStorageItem(key, owner = accountId) {
  try {
    if (!privateKeys.has(key)) await nativeStorage.removeItem(key);else await transactLocal(s => {
      delete s.values[key];
    }, owner);
    return true;
  } catch {
    return false;
  }
}
export async function getSyncQueue(owner = accountId) {
  return getStorageItem(STORAGE_KEYS.SYNC_QUEUE, [], owner);
}
export async function addToSyncQueue(item, owner = accountId) {
  return transactLocal(s => {
    enqueue(s, {
      [`word:${item.word_id}`]: item
    });
    return clone(s.outbox);
  }, owner, true);
}
export async function clearSyncQueue(acks, owner = accountId) {
  if (!Array.isArray(acks) || !acks.every(op => object(op) && typeof op.id === 'string' && Number.isSafeInteger(op.sequence))) throw new Error('Exact operation ID and sequence required.');
  return transactLocal(s => {
    const ids = new Set(acks.map(op => `${op.id}|${op.sequence}`));
    s.outbox = s.outbox.filter(op => !ids.has(`${op.id}|${op.sequence}`));
    return clone(s.outbox);
  }, owner);
}
export async function markSyncAttempt(batch, owner = accountId) {
  const ids = new Set(batch.map(op => op.id));
  return transactLocal(s => {
    for (const op of s.outbox) if (ids.has(op.id)) {
      op.attempts++;
      op.last_attempt_at = new Date().toISOString();
    }
  }, owner);
}
export async function getAllProgress(owner = accountId) {
  return getStorageItem(STORAGE_KEYS.WORD_PROGRESS, {}, owner);
}
export async function getWordProgress(id, owner = accountId) {
  return (await getAllProgress(owner))[String(id)] || null;
}
// Uzbekistan has no DST; use Asia/Tashkent calendar days, including while offline.
export function activityDay(date = new Date()) {
  return new Date(date.getTime() + 5 * 3600000).toISOString().slice(0, 10);
}
function dailyProfile(p, count) {
  const today = activityDay(),
    yesterday = activityDay(new Date(Date.now() - 86400000)),
    same = p.lastActiveDate === today;
  return {
    ...p,
    lastActiveDate: today,
    wordsLearnedToday: (same ? p.wordsLearnedToday || 0 : 0) + count,
    streakDays: same ? p.streakDays || 1 : p.lastActiveDate === yesterday ? (p.streakDays || 0) + 1 : 1
  };
}
export function normalizeDailyProfile(p) {
  if (!p) return p;
  const today = activityDay(),
    yesterday = activityDay(new Date(Date.now() - 86400000));
  return {
    ...p,
    wordsLearnedToday: p.lastActiveDate === today ? p.wordsLearnedToday || 0 : 0,
    streakDays: [today, yesterday].includes(p.lastActiveDate) ? p.streakDays || 0 : 0
  };
}
export async function mutateUserProfile(reducer, defaults = {}, changesFor = () => ({}), owner = accountId) {
  return transactLocal(s => {
    const current = {
      ...defaults,
      ...s.values[STORAGE_KEYS.USER_PROFILE],
      id: s.owner,
      isLoggedIn: true
    };
    const next = reducer(current, s);
    delete next.password;
    delete next.password_hash;
    s.values[STORAGE_KEYS.USER_PROFILE] = next;
    enqueue(s, changesFor(next));
    return clone(next);
  }, owner, true);
}
export async function saveWordProgress(wordId, status, options = {}, owner = accountId) {
  if (!Number.isInteger(Number(wordId)) || Number(wordId) <= 0 || !['mastered', 'review', 'hard'].includes(status)) throw new Error('Invalid learning word.');
  return transactLocal(s => {
    const map = s.values[STORAGE_KEYS.WORD_PROGRESS] ||= {},
      old = map[wordId] || {};
    const first = status === 'mastered' && !old.completed && old.status !== 'mastered';
    const next = {
      ...old,
      word_id: Number(wordId),
      status,
      completed: !!old.completed || old.status === 'mastered' || status === 'mastered',
      completed_day: old.completed_day || (first ? activityDay() : null),
      review_count: (old.review_count || 0) + 1,
      last_reviewed_at: new Date().toISOString(),
      is_favorite: options.is_favorite ?? old.is_favorite ?? false,
      next_review_date: options.next_review_date ?? old.next_review_date ?? null,
      book: options.book || old.book || Math.floor((Number(wordId) - 1) / 600) + 1,
      unit: options.unit || old.unit || Math.floor((Number(wordId) - 1) % 600 / 20) + 1
    };
    map[wordId] = next;
    let p = dailyProfile({
      ...options.defaults,
      ...s.values[STORAGE_KEYS.USER_PROFILE],
      id: s.owner,
      isLoggedIn: true
    }, first ? 1 : 0);
    p.totalWordsLearned = (p.totalWordsLearned || 0) + (first ? 1 : 0);
    p.reviewedWordsCount = (p.reviewedWordsCount || 0) + (status === 'review' ? 1 : 0);
    p.hardWordsCount = (p.hardWordsCount || 0) + (status === 'hard' ? 1 : 0);
    const book = next.book || p.activeBook || 1;
    p.bookLearnedCounts = {
      ...p.bookLearnedCounts,
      [book]: (p.bookLearnedCounts?.[book] || 0) + (first ? 1 : 0)
    };
    p.bookProgress = {
      ...p.bookProgress,
      [book]: Math.max(p.bookProgress?.[book] || 0, Math.min(100, Math.round(p.bookLearnedCounts[book] / (options.bookSize || 600) * 100)))
    };
    if (options.unitWordIds?.every(id => map[id]?.completed)) p.completedUnits = {
      ...p.completedUnits,
      [`${book}:${next.unit}`]: true
    };
    s.values[STORAGE_KEYS.USER_PROFILE] = p;
    enqueue(s, {
      [`word:${wordId}`]: next,
      learning: learningFields(p)
    });
    return {
      ...clone(next),
      profile: clone(p)
    };
  }, owner, true);
}
export async function recordLocalQuiz(score, total, defaults, owner = accountId) {
  return mutateUserProfile(p => {
    const percent = Math.round(Math.max(0, Math.min(score, total)) / total * 100),
      next = score > 0 ? dailyProfile(p, 0) : p;
    return {
      ...next,
      accuracy: p.accuracy ? Math.round((p.accuracy + percent) / 2) : percent
    };
  }, defaults, p => ({
    learning: learningFields(p)
  }), owner);
}
export async function resetLocalProgress(defaults = {}, owner = accountId) {
  return transactLocal(s => {
    const epoch = uid(),
      p = {
        ...s.values[STORAGE_KEYS.USER_PROFILE],
        ...learningFields(defaults),
        totalWordsLearned: 0,
        wordsLearnedToday: 0,
        streakDays: 0,
        reviewedWordsCount: 0,
        hardWordsCount: 0,
        accuracy: 0,
        lastActiveDate: null,
        bookProgress: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 0
        },
        bookLearnedCounts: {},
        completedUnits: {},
        activeBook: 1,
        activeUnit: 1
      };
    s.values[STORAGE_KEYS.USER_PROFILE] = p;
    s.values[STORAGE_KEYS.WORD_PROGRESS] = {};
    s.values[STORAGE_KEYS.FAVORITES] = [];
    s.values[STORAGE_KEYS.USER_STREAKS] = {};
    enqueue(s, {
      learning: learningFields(p),
      lesson: {
        activeBook: 1,
        activeUnit: 1
      }
    }, 'reset', epoch);
    s.epoch = epoch;
    return clone(p);
  }, owner, true);
}
export async function getFavorites(owner = accountId) {
  return getStorageItem(STORAGE_KEYS.FAVORITES, [], owner);
}
export async function toggleFavorite(id, owner = accountId) {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new Error('Invalid word.');
  return transactLocal(s => {
    const list = s.values[STORAGE_KEYS.FAVORITES] || [],
      fav = !list.includes(Number(id));
    s.values[STORAGE_KEYS.FAVORITES] = fav ? [...list, Number(id)] : list.filter(v => v !== Number(id));
    const map = s.values[STORAGE_KEYS.WORD_PROGRESS] ||= {};
    map[id] = {
      ...map[id],
      word_id: Number(id),
      is_favorite: fav
    };
    enqueue(s, {
      [`word:${id}`]: map[id]
    });
    return fav;
  }, owner, true);
}
export async function getUserStreak(owner = accountId) {
  const p = normalizeDailyProfile(await getStorageItem(STORAGE_KEYS.USER_PROFILE, {}, owner));
  return {
    current_streak: p.streakDays || 0,
    max_streak: p.streakDays || 0,
    words_learned_today: p.wordsLearnedToday || 0,
    last_activity_date: p.lastActiveDate || null,
    daily_goal: p.dailyGoal || 20
  };
}
export async function updateUserStreak(data, owner = accountId) {
  return mutateUserProfile(p => ({
    ...p,
    streakDays: Math.max(p.streakDays || 0, data.current_streak || 0)
  }), {}, () => ({}), owner);
}
export async function incrementDailyWordsLearned(count = 1, owner = accountId) {
  return mutateUserProfile(p => dailyProfile(p, count), {}, p => ({
    learning: learningFields(p)
  }), owner);
}
export async function clearAllLocalData(owner = accountId) {
  return resetLocalProgress({}, owner);
}
export async function getCustomWords(owner = accountId) {
  return getStorageItem(STORAGE_KEYS.CUSTOM_WORDS, [], owner);
}
async function changeCustom(id, change, owner) {
  return transactLocal(s => {
    const list = s.values[STORAGE_KEYS.CUSTOM_WORDS] || [],
      next = change(list.find(w => w.id === id));
    if (next && JSON.stringify(next).length * 4 > 30000) throw new Error('Vocabulary card is too large.');
    s.values[STORAGE_KEYS.CUSTOM_WORDS] = next ? [next, ...list.filter(w => w.id !== id)] : list.filter(w => w.id !== id);
    enqueue(s, {
      [`custom:${id}`]: next || {
        deleted: true
      }
    });
    return clone(s.values[STORAGE_KEYS.CUSTOM_WORDS]);
  }, owner, true);
}
export async function addCustomWord(item, owner = accountId) {
  const next = {
    ...item,
    id: item.id || `custom_${uid()}`,
    original: (item.original || '').trim(),
    translated: (item.translated || '').trim(),
    learned: !!item.learned,
    created_at: new Date().toISOString(),
    review_count: 0
  };
  await changeCustom(next.id, () => next, owner);
  return next;
}
export async function setCustomWordLearnedStatus(id, learned, owner = accountId) {
  return changeCustom(id, old => old ? {
    ...old,
    learned: !!learned,
    learned_at: learned ? new Date().toISOString() : null,
    review_count: (old.review_count || 0) + 1
  } : null, owner);
}
export async function deleteCustomWord(id, owner = accountId) {
  return changeCustom(id, () => null, owner);
}
export async function updateCustomWord(id, updates, owner = accountId) {
  const allowed = Object.fromEntries(Object.entries(updates).filter(([key]) => ['original', 'translated', 'phonetic', 'pos', 'definition', 'example'].includes(key)));
  return changeCustom(id, old => old ? {
    ...old,
    ...allowed,
    updated_at: new Date().toISOString()
  } : null, owner);
}
