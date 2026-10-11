(() => {
  if (!window.InglyEnvironment || !window.inglyDeployment) throw new Error('Ingly configuration: use an explicitly configured admin build/dev server.');
  const config = window.InglyEnvironment.resolveEnvironment(window.inglyDeployment);
  const url = config.url;
  const anonKey = config.publicKey;
  const local = window.InglyEnvironment.scopeBrowserStorage(localStorage, config);
  const session = window.InglyEnvironment.scopeBrowserStorage(sessionStorage, config);
  const timedFetch = async (url, options = {}) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 15000);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
  };
  const client = window.supabase.createClient(url, anonKey, { global: { fetch: timedFetch }, auth: { storage: session, storageKey: 'ingly_admin_auth_v2' } });
  let endingSession = false;
  let signingIn = false;
  let sessionGeneration = 0;
  function failure(code) { const error = new Error(code); error.code = code; return error; }
  function errorMessage(error) {
    if (error?.code === 'invalid_credentials') return 'Email yoki parol noto‘g‘ri.';
    if (error?.code === 'email_not_confirmed') return 'Email tasdiqlanmagan. Xatingizdagi havolani oching va qayta kiring.';
    if (error?.code === 'admin_access_denied') return 'Bu akkauntda faol admin huquqi yo‘q. Administratorga murojaat qiling.';
    if (error?.code === 'PGRST202' || error?.code === '42703' || error?.code === '42501') return 'Backend admin sxemasi yoki ruxsatlari sozlanmagan. Administratorga murojaat qiling.';
    if (error?.code === 'invalid_email') return 'Supabase Auth admin emailingizni kiriting. Username bilan kirish qo‘llanmaydi.';
    if (error?.code === 'auth_busy') return 'Amal yakunlanishini kuting.';
    if (error?.status === 429) return 'Urinishlar ko‘payib ketdi. Biroz kutib qayta urinib ko‘ring.';
    if (error?.name === 'AuthRetryableFetchError' || /fetch|network|timeout|abort/i.test(error?.message || '')) return 'Serverga ulanib bo‘lmadi. Internetni va loyiha manzilini tekshiring.';
    if (error?.code === 'session_not_found') return 'Sessiya tugagan. Qayta kiring.';
    return 'Kirish bajarilmadi. Administratorga murojaat qiling.';
  }
  for (const store of [local, session]) {
    for (const key of ['ingly_admin_session','ingly_admin_auth','ingly_admin_user','ingly_admin_list','ingly_users','ingly_supabase_key','ingly_transactions','ingly_card_receiver_number']) store.removeItem(key);
  }
  async function authorize() {
    const generation = sessionGeneration;
    const { data: identity, error } = await client.auth.getUser();
    if (error) throw error;
    if (!identity.user) throw failure('session_not_found');
    const { data, error: roleError } = await client.rpc('get_my_admin_access');
    if (roleError) throw roleError;
    if (generation !== sessionGeneration || endingSession) throw failure('session_not_found');
    if (!data || data.auth_user_id !== identity.user.id || !['super_admin','editor','moderator'].includes(data.role)) throw failure('admin_access_denied');
    return data;
  }
  async function login(email, password) {
    if (endingSession || signingIn) throw failure('auth_busy');
    email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw failure('invalid_email');
    signingIn = true;
    const generation = sessionGeneration;
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error?.code === 'email_not_confirmed') {
        const { error: resendError } = await client.auth.resend({ type: 'signup', email });
        if (resendError) throw resendError;
        throw error;
      }
      if (error) throw error;
      try {
        const access = await authorize();
        if (generation !== sessionGeneration || endingSession) throw failure('session_not_found');
        return access;
      }
      catch (error) {
        // Deny access without destroying a valid session on a transient RPC error.
        if (error.code === 'admin_access_denied') await client.auth.signOut({ scope: 'local' });
        throw error;
      }
    } finally { signingIn = false; }
  }
  async function logout() {
    sessionGeneration++;
    endingSession = true;
    try { return await client.auth.signOut({ scope: 'local' }); }
    finally {
      session.removeItem('ingly_admin_auth_v2');
      session.removeItem('ingly_admin_auth_v2-user');
      endingSession = false;
    }
  }
  async function getAccessToken() {
    const access = await authorize();
    const { data, error } = await client.auth.getSession();
    if (error || !data.session || data.session.user.id !== access.auth_user_id) throw new Error('Session unavailable.');
    return data.session.access_token;
  }
  async function manage(action, payload) {
    const { data, error } = await client.functions.invoke('admin-accounts', {
      body: { action, payload }, headers: { Authorization: 'Bearer ' + await getAccessToken() },
    });
    if (error || data?.error) throw new Error(data?.error || 'Account operation failed.');
    if (!data?.data) throw new Error('Server confirmation missing.');
    return data.data;
  }
  window.inglyAuth = { client, url, anonKey, environment: config.environment, projectRef: config.projectRef,
    localStorage: local, authorize, login, logout, manage, getAccessToken, errorMessage };
})();
