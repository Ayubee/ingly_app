(() => {
  const url = 'https://lbsqxownrjfmjoojdsfk.supabase.co';
  const anonKey = 'sb_publishable_Kbpya9vZpqll4KuUXQrpHQ_Tq3qcZ1W';
  const client = window.supabase.createClient(url, anonKey, { auth: { storage: sessionStorage, storageKey: 'ingly_admin_auth_v2' } });
  let endingSession = false;
  for (const store of [localStorage, sessionStorage]) {
    for (const key of ['ingly_admin_session','ingly_admin_auth','ingly_admin_user','ingly_admin_list','ingly_users','ingly_supabase_key','ingly_transactions','ingly_card_receiver_number']) store.removeItem(key);
  }
  async function authorize() {
    const { data: identity, error } = await client.auth.getUser();
    if (error || !identity.user) throw new Error('Admin authentication required.');
    const { data, error: roleError } = await client.rpc('get_my_admin_access');
    if (roleError || !data || data.auth_user_id !== identity.user.id) throw new Error('Admin authorization denied.');
    return data;
  }
  async function login(email, password) {
    if (endingSession) throw new Error('Logout is still finishing.');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error?.code === 'email_not_confirmed') {
      await client.auth.resend({ type: 'signup', email });
      throw new Error('Email confirmation required. Check your inbox.');
    }
    if (error) throw error;
    try { return await authorize(); }
    catch (error) { await client.auth.signOut({ scope: 'local' }); throw error; }
  }
  async function logout() {
    endingSession = true;
    try { return await client.auth.signOut({ scope: 'local' }); }
    finally {
      sessionStorage.removeItem('ingly_admin_auth_v2');
      sessionStorage.removeItem('ingly_admin_auth_v2-user');
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
  window.inglyAuth = { client, url, anonKey, authorize, login, logout, manage, getAccessToken };
})();
