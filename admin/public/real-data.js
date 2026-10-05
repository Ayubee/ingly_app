/* Shared admin data boundary. No private browser persistence or demo fallbacks. */
(() => {
  let generation = 0;
  let subscribed = false;
  const listeners = new Set();
  function notify(kind, detail) { for (const fn of listeners) fn(kind, detail); }
  function attachAuth() {
    if (subscribed || !window.inglyAuth?.client) return;
    subscribed = true;
    window.inglyAuth.client.auth.onAuthStateChange(() => {
      generation += 1;
      notify('session');
    });
  }
  async function rpc(name, args = {}) {
    attachAuth();
    const auth = window.inglyAuth;
    if (!auth) throw new Error('Tasdiqlangan admin ulanishi mavjud emas.');
    const turn = generation;
    const controller = new AbortController();
    let timer;
    const work = async () => {
      const { data: sessionData, error: sessionError } = await auth.client.auth.getSession();
      const session = sessionData?.session;
      if (sessionError || !session) throw new Error('Admin sessiyasi talab qilinadi.');
      const access = await auth.authorize();
      if (turn !== generation || controller.signal.aborted || access.auth_user_id !== session.user.id) throw new Error('Admin sessiyasi o‘zgardi yoki so‘rov tugadi.');
      const { data, error } = await auth.client.rpc(name, args)
        .setHeader('Authorization', 'Bearer ' + session.access_token).abortSignal(controller.signal);
      if (turn !== generation) throw new Error('Admin sessiyasi o‘zgardi.');
      if (error) throw new Error(error.message || 'Server so‘rovi bajarilmadi.');
      if (!data || typeof data !== 'object') throw new Error('Server tasdig‘i mavjud emas.');
      return data;
    };
    try {
      return await Promise.race([work(), new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('So‘rov vaqti tugadi. Qayta yuklang.')); }, 20000);
      })]);
    } finally { clearTimeout(timer); }
  }
  const filters = ['all', 'income', 'expense', 'vip', 'book'];
  function accessState(config, book) {
    if (![true, false, 'true', 'false'].includes(config?.premium_mode_enabled)) return null;
    if (config.premium_mode_enabled === false || config.premium_mode_enabled === 'false') return true;
    let ids = config.free_book_ids;
    if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { return null; } }
    const validIds = Array.isArray(ids) && ids.every(id => Number.isInteger(Number(id)) && Number(id) >= 1 && Number(id) <= 6);
    const validCount = config.free_books_count != null && Number.isInteger(Number(config.free_books_count)) && Number(config.free_books_count) >= 0 && Number(config.free_books_count) <= 6;
    if (!validIds && !validCount) return null;
    return (validIds && ids.map(Number).includes(book)) || (validCount && book <= Number(config.free_books_count));
  }
  function validateManualEntry(entry) {
    if (!['income', 'expense'].includes(entry.type)) throw new Error('Kirim yoki chiqim turini tanlang.');
    if (!Number.isSafeInteger(Number(entry.amount)) || Number(entry.amount) <= 0 || Number(entry.amount) > 1e12) throw new Error('Musbat, butun summani kiriting.');
    if (entry.currency !== 'UZS') throw new Error('Faqat UZS qo‘llab-quvvatlanadi.');
    if (!['vip', 'book', 'hosting', 'sms', 'marketing', 'other'].includes(entry.category)) throw new Error('Toifani tanlang.');
    if (!entry.title?.trim() || entry.title.trim().length > 200 || (entry.description || '').length > 1000) throw new Error('Sarlavha yoki izohni tekshiring.');
    if (!['cash', 'bank_transfer', 'click', 'payme', 'other'].includes(entry.payment_method)) throw new Error('To‘lov usulini tanlang.');
    if (!['production', 'test', 'mock'].includes(entry.environment)) throw new Error('Muhitni tanlang.');
    if (!entry.reference?.trim() || entry.reference.trim().length > 200) throw new Error('Takrorlanmas hujjat raqamini kiriting.');
    if (typeof entry.occurred_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(entry.occurred_at)) throw new Error('Vaqt zonasi bilan ISO sanani kiriting.');
    const date = new Date(entry.occurred_at).getTime();
    if (!Number.isFinite(date) || date < Date.UTC(2000, 0, 1) || date > Date.now() + 86400000) throw new Error('Operatsiya sanasini tekshiring.');
    return { request_id: entry.request_id, type: entry.type, amount: Number(entry.amount), currency: 'UZS',
      category: entry.category, title: entry.title.trim(), description: entry.description || '',
      payment_method: entry.payment_method, reference: entry.reference.trim(), occurred_at: new Date(date).toISOString(), environment: entry.environment };
  }
  const csvFields = ['id', 'type', 'amount', 'currency', 'category', 'title', 'description', 'payment_method',
    'reference', 'occurred_at', 'status', 'environment', 'source', 'is_purchase', 'voided_at', 'void_reason'];
  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function exportCSV(rows) {
    return '\uFEFF' + [csvFields.map(csvCell).join(','), ...rows.map(row => csvFields.map(key => csvCell(row[key])).join(','))].join('\r\n');
  }
  function formatNumber(value) { return Number(value).toLocaleString('en-US').replace(/,/g, ' '); }
  const api = {
    generation: () => generation,
    subscribe(fn) { attachAuth(); listeners.add(fn); return () => listeners.delete(fn); },
    async dashboard() {
      const data = await rpc('admin_dashboard_snapshot');
      if (!Array.isArray(data.books) || !data.config || ['total_users','dau','mastered_words','active_streak_users'].some(k => !Number.isSafeInteger(data[k])))
        throw new Error('Tahlil javobi noto‘g‘ri.');
      return data;
    },
    async configuration() {
      const data = await rpc('admin_configuration_snapshot');
      if (!Array.isArray(data.books) || !data.config) throw new Error('Sozlamalar javobi noto‘g‘ri.');
      return data;
    },
    async finance(query = {}) {
      const data = await rpc('admin_finance_snapshot', { p_environment: query.environment || 'production',
        p_filter: query.filter || 'all', p_search: query.search || '', p_before_date: query.before?.occurred_at || null,
        p_before_id: query.before?.id || null, p_limit: query.limit || 50 });
      if (!Array.isArray(data.rows) || !data.counts || ['income','expenses','net_profit','purchase_count','matched_count'].some(k => !Number.isSafeInteger(data[k])) || data.rows.some(row => !Number.isSafeInteger(row.amount)))
        throw new Error('Moliya javobi noto‘g‘ri.');
      return data;
    },
    async create(entry) {
      const normalized = validateManualEntry(entry);
      const data = await rpc('admin_create_finance_entry', { p_entry: normalized });
      if (data.success !== true || data.id !== normalized.request_id) throw new Error('Saqlash tasdiqlanmadi.');
      notify('finance'); return data;
    },
    async void(id, reason) {
      if (!reason?.trim() || reason.trim().length > 500) throw new Error('Bekor qilish sababini kiriting.');
      const data = await rpc('admin_void_finance_entry', { p_id: id, p_reason: reason.trim() });
      if (data.success !== true || data.id !== id) throw new Error('Bekor qilish tasdiqlanmadi.');
      notify('finance'); return data;
    },
    async configure(changes) {
      const data = await rpc('admin_update_configuration', { p_changes: changes });
      if (data.success !== true || !data.config) throw new Error('Sozlamalar tasdiqlanmadi.');
      notify('configuration', data.config); return data.config;
    },
    async export(query) {
      const data = await api.finance({ ...query, before: null, limit: 2000 });
      if (data.matched_count > 2000) throw new Error('Eksport 2 000 yozuv bilan cheklangan. Qidiruvni aniqlashtiring.');
      return exportCSV(data.rows);
    }
  };
  window.inglyRealData = { api, filters, accessState,
    validateManualEntry, csvFields, exportCSV, formatNumber };
})();
