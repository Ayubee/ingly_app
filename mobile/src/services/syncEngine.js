import { supabase } from './supabaseClient';
import { getSyncQueue, clearSyncQueue, markSyncAttempt, captureStorageSession, isStorageSessionCurrent, onLocalStateChange, getSyncCursor } from './storage';
import { mergeRemoteSnapshot } from './syncConflict.js';
import { subscribeSyncEvents } from './networkEvents.js';
let processing = false,
  active = false,
  paused = false,
  timer = null,
  unsubscribe = null,
  failures = 0,
  blocked = null;
let lastSync = null,
  lastError = null,
  nextRetry = null,
  controller = null,
  needsPull = true,
  requested = false;
const listeners = new Set();
export function onSyncStateChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(type, extra = {}) {
  listeners.forEach(cb => {
    try {
      cb({
        type,
        ...extra
      });
    } catch {}
  });
}
function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
  nextRetry = null;
}
function classify(error) {
  if (error?.code === 'SESSION_CHANGED') return 'session';
  if (error?.code === 'EPOCH_CONFLICT') return 'conflict';
  if (error?.code === 'P0001' && String(error.message).includes('EPOCH_CONFLICT')) return 'conflict';
  if (error?.code === 'LOCAL_CORRUPT') return 'local';
  if ([401, 403].includes(error?.status) || ['PGRST301', 'PGRST302', '42501'].includes(error?.code)) return 'auth';
  if (error?.code === 'INVALID_ACK' || ['22023', '22003', '22P02', '22007', '22008', '23503', '23514'].includes(error?.code) || error?.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) return 'permanent';
  return 'transient';
}
function schedule(delay = 800) {
  if (!active || paused || blocked || timer) return;
  nextRetry = Date.now() + delay;
  timer = setTimeout(() => {
    timer = null;
    nextRetry = null;
    syncOfflineProgress().catch(() => {});
  }, delay);
}
export function requestSync(reason = 'mutation') {
  if (reason === 'manual' && blocked === 'permanent') blocked = null;
  if (reason !== 'mutation' && reason !== 'drain') {
    failures = 0;
    if (blocked === 'auth' || blocked === 'transient') blocked = null;
    needsPull = true;
  }
  if (processing) {
    requested = true;
    return;
  }
  schedule(reason === 'mutation' ? 2500 : 0);
}
function recover(reason) {
  paused = false;
  requestSync(reason);
}
export function startAutoSync() {
  if (active) return requestSync('session');
  active = true;
  paused = false;
  needsPull = true;
  const offLocal = onLocalStateChange(event => {
    if (event.mutation) requestSync();
  });
  const offNetwork = subscribeSyncEvents(() => recover('network'), () => recover('foreground'), () => {
    paused = true;
    clearTimer();
    controller?.abort();
  });
  unsubscribe = () => {
    offLocal();
    offNetwork();
  };
  requestSync('session');
}
export function stopAutoSync() {
  active = false;
  clearTimer();
  unsubscribe?.();
  unsubscribe = null;
  controller?.abort();
  blocked = null;
  failures = 0;
  lastError = null;
  lastSync = null;
  requested = false;
  needsPull = true;
}
export async function getSyncStatus() {
  try {
    return {
      is_syncing: processing,
      pending_count: (await getSyncQueue()).length,
      last_sync_at: lastSync,
      last_error: lastError,
      blocked_reason: blocked,
      next_retry_at: nextRetry,
      paused
    };
  } catch {
    return {
      is_syncing: false,
      pending_count: null,
      last_sync_at: lastSync,
      last_error: 'LOCAL_CORRUPT',
      blocked_reason: 'local',
      next_retry_at: null,
      paused
    };
  }
}
async function withTimeout(work, abort) {
  let timeout;
  const expired = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      abort.abort();
      reject(Object.assign(new Error('Sync timed out.'), {
        code: 'TIMEOUT'
      }));
    }, 20000);
  });
  try {
    return await Promise.race([work, expired]);
  } finally {
    clearTimeout(timeout);
  }
}
export async function syncOfflineProgress() {
  // Acquire before the first await, including queue reads and SDK session restoration.
  if (processing) return {
    success: false,
    reason: 'sync_already_in_progress'
  };
  const token = captureStorageSession();
  if (!isStorageSessionCurrent(token)) return {
    success: false,
    reason: 'unauthenticated'
  };
  if (paused) return {
    success: false,
    reason: 'paused'
  };
  processing = true;
  clearTimer();
  requested = false;
  controller = new AbortController();
  const abort = controller;
  let succeeded = false,
    remaining = 0;
  try {
    let queue = await getSyncQueue(token);
    if (!queue.length && !needsPull) {
      succeeded = true;
      return {
        success: true,
        synced_count: 0
      };
    }
    const {
      data: identity,
      error: authError
    } = await withTimeout(supabase.auth.getSession(), abort);
    if (!isStorageSessionCurrent(token)) throw Object.assign(new Error('Session changed.'), {
      code: 'SESSION_CHANGED'
    });
    const session = identity?.session;
    if (authError) throw authError;
    if (session?.user?.id !== token.owner || !session.access_token) throw Object.assign(new Error('Authentication required; queue retained.'), {
      status: 401
    });
    emit('sync_started', {
      pending_count: queue.length
    });
    const rpc = async (name, body) => {
      if (!isStorageSessionCurrent(token)) throw Object.assign(new Error('Session changed.'), {
        code: 'SESSION_CHANGED'
      });
      let query = supabase.rpc(name, body).setHeader('Authorization', 'Bearer ' + session.access_token);
      if (query.abortSignal) query = query.abortSignal(abort.signal);
      const result = await withTimeout(query, abort);
      if (!isStorageSessionCurrent(token)) throw Object.assign(new Error('Session changed.'), {
        code: 'SESSION_CHANGED'
      });
      if (result.error) throw Object.assign(result.error, {
        status: result.status || result.error.status
      });
      return result.data;
    };
    if (needsPull) {
      const cursor = await getSyncCursor(token);
      const snapshot = await rpc('read_learning_sync', {
        p_after_revision: cursor
      });
      await mergeRemoteSnapshot(snapshot, token);
      needsPull = false;
      queue = await getSyncQueue(token);
    }
    const batch = [];
    let bytes = 0;
    for (const op of queue) {
      // Four bytes per UTF-16 character is a conservative UTF-8 upper bound.
      const cost = JSON.stringify(op).length * 4;
      if (batch.length && (batch.length >= 32 || bytes + cost > 196608)) break;
      if (cost > 196608) throw Object.assign(new Error('Operation too large; original retained.'), {
        code: '22023'
      });
      batch.push(op);
      bytes += cost;
    }
    if (batch.length) {
      await markSyncAttempt(batch, token);
      const data = await rpc('sync_learning_operations', {
        p_operations: batch
      });
      // No success/count fallback: missing, invented or partial acknowledgements retain the batch.
      const sent = new Set(batch.map(op => `${op.id}|${op.sequence}`));
      if (data?.success !== true || !Array.isArray(data.acknowledged) || data.acknowledged.length !== batch.length || new Set(data.acknowledged.map(op => `${op.id}|${op.sequence}`)).size !== batch.length || !data.acknowledged.every(op => typeof op.id === 'string' && Number.isSafeInteger(op.sequence) && sent.has(`${op.id}|${op.sequence}`))) throw Object.assign(new Error('Invalid acknowledgement; queue retained.'), {
        code: 'INVALID_ACK'
      });
      remaining = (await clearSyncQueue(data.acknowledged, token)).length;
    }
    failures = 0;
    blocked = null;
    lastError = null;
    lastSync = new Date().toISOString();
    succeeded = true;
    emit('sync_completed', {
      synced_count: batch.length,
      pending_count: remaining
    });
    return {
      success: true,
      synced_count: batch.length
    };
  } catch (error) {
    const reason = classify(error);
    // Stale work cannot publish another session's sync state or schedule retries.
    if (isStorageSessionCurrent(token)) {
      lastError = reason;
      emit('sync_failed', {
        reason
      });
      if (reason === 'transient') {
        failures++;
        if (failures <= 5) schedule(Math.min(120000, 3000 * 2 ** (failures - 1)) * (0.85 + Math.random() * 0.3));else blocked = 'transient';
      } else if (reason !== 'session') blocked = reason;
    }
    return {
      success: false,
      reason
    };
  } finally {
    processing = false;
    if (controller === abort) controller = null;
    if (isStorageSessionCurrent(token) && (succeeded && remaining || requested) && !blocked) schedule(succeeded ? 800 : 3000);else if (!isStorageSessionCurrent(token) && active && !paused) schedule(0);
  }
}
