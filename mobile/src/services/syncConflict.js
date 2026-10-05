import { STORAGE_KEYS, transactLocal, activityDay, learningFields } from './storage.js';
const max = (a, b) => Math.max(Number(a) || 0, Number(b) || 0);
export function mergeLearning(local = {}, remote = {}) {
  remote = learningFields(remote);
  const result = {
    ...local,
    ...remote
  };
  for (const k of ['totalWordsLearned', 'reviewedWordsCount', 'hardWordsCount']) result[k] = max(local[k], remote[k]);
  for (const k of ['bookProgress', 'bookLearnedCounts']) {
    result[k] = {
      ...local[k]
    };
    for (const [id, value] of Object.entries(remote[k] || {})) result[k][id] = max(result[k][id], value);
  }
  result.completedUnits = {
    ...local.completedUnits,
    ...remote.completedUnits
  };
  if ((local.lastActiveDate || '') > (remote.lastActiveDate || '')) {
    result.lastActiveDate = local.lastActiveDate;
    result.wordsLearnedToday = local.wordsLearnedToday;
    result.streakDays = local.streakDays;
  } else if (local.lastActiveDate === remote.lastActiveDate) {
    result.wordsLearnedToday = max(local.wordsLearnedToday, remote.wordsLearnedToday);
    result.streakDays = max(local.streakDays, remote.streakDays);
  }
  return result;
}
export async function mergeRemoteSnapshot(snapshot, owner) {
  if (!snapshot || typeof snapshot.epoch !== 'string' || !Number.isSafeInteger(snapshot.revision) || !Array.isArray(snapshot.entities)) throw Object.assign(new Error('Invalid sync snapshot.'), {
    code: 'INVALID_ACK'
  });
  return transactLocal(s => {
    const resetting = s.outbox.some(op => op.action === 'reset');
    if (snapshot.epoch !== s.epoch && !resetting) {
      if (s.outbox.length) throw Object.assign(new Error('Another device reset progress; pending changes retained.'), {
        code: 'EPOCH_CONFLICT'
      });
      s.epoch = snapshot.epoch;
      s.values[STORAGE_KEYS.WORD_PROGRESS] = {};
      s.values[STORAGE_KEYS.FAVORITES] = [];
      const p = s.values[STORAGE_KEYS.USER_PROFILE] || {};
      for (const key of ['totalWordsLearned', 'reviewedWordsCount', 'hardWordsCount', 'wordsLearnedToday', 'streakDays', 'accuracy']) p[key] = 0;
      p.bookProgress = {};
      p.bookLearnedCounts = {};
      p.completedUnits = {};
      p.lastActiveDate = null;
      s.values[STORAGE_KEYS.USER_PROFILE] = p;
    }
    const pending = new Set(s.outbox.flatMap(op => Object.keys(op.changes)));
    const words = s.values[STORAGE_KEYS.WORD_PROGRESS] ||= {};
    let p = s.values[STORAGE_KEYS.USER_PROFILE] || {
      id: s.owner,
      isLoggedIn: true
    };
    for (const row of snapshot.entities) {
      const key = row.entity_key,
        value = row.payload;
      if (typeof key !== 'string' || !value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('Invalid server entity.'), {
        code: 'INVALID_ACK'
      });
      if (resetting && !key.startsWith('custom:') && key !== 'preferences') continue;
      if (key.startsWith('word:')) {
        const id = key.slice(5),
          old = words[id] || {};
        words[id] = {
          ...old,
          ...(pending.has(key) ? {} : value),
          completed: !!old.completed || old.status === 'mastered' || !!value.completed,
          review_count: max(old.review_count, value.review_count)
        };
      } else if (key === 'learning') {
        p = mergeLearning(p, pending.has(key) ? { ...value, accuracy: p.accuracy } : value);
      } else if (pending.has(key)) continue;
      else if (key === 'lesson' || key === 'preferences') {
        const allowed = key === 'lesson' ? ['activeBook', 'activeUnit'] : ['name', 'avatar', 'dailyGoal', 'reminderTime', 'notificationsEnabled', 'soundEnabled'];
        p = {
          ...p,
          ...Object.fromEntries(Object.entries(value).filter(([k]) => allowed.includes(k)))
        };
      } else if (key.startsWith('custom:')) {
        const id = key.slice(7),
          list = s.values[STORAGE_KEYS.CUSTOM_WORDS] || [];
        s.values[STORAGE_KEYS.CUSTOM_WORDS] = value.deleted ? list.filter(w => w.id !== id) : [{
          ...value,
          id
        }, ...list.filter(w => w.id !== id)];
      }
    }
    const counts = {}, unitCounts = {};
    let completed = 0,
      todayCompleted = 0;
    for (const item of Object.values(words)) if (item.completed || item.status === 'mastered') {
      completed++;
      if (item.completed_day === activityDay()) todayCompleted++;
      if (item.book) counts[item.book] = (counts[item.book] || 0) + 1;
      if (item.book && item.unit) {
        const unit = `${item.book}:${item.unit}`;
        unitCounts[unit] = (unitCounts[unit] || 0) + 1;
      }
    }
    p.totalWordsLearned = max(p.totalWordsLearned, completed);
    if (todayCompleted) {
      p.wordsLearnedToday = max(p.lastActiveDate === activityDay() ? p.wordsLearnedToday : 0, todayCompleted);
      p.lastActiveDate = activityDay();
    }
    p.bookLearnedCounts = {
      ...p.bookLearnedCounts
    };
    p.bookProgress = {
      ...p.bookProgress
    };
    p.completedUnits = { ...p.completedUnits };
    for (const [unit, count] of Object.entries(unitCounts)) if (count >= 20) p.completedUnits[unit] = true;
    for (const [book, count] of Object.entries(counts)) {
      p.bookLearnedCounts[book] = max(p.bookLearnedCounts[book], count);
      p.bookProgress[book] = max(p.bookProgress[book], Math.min(100, Math.round(count / 600 * 100)));
    }
    s.values[STORAGE_KEYS.USER_PROFILE] = p;
    s.values[STORAGE_KEYS.FAVORITES] = Object.values(words).filter(w => w.is_favorite).map(w => w.word_id);
    s.cursor = snapshot.revision;
    return p;
  }, owner, false, true);
}
