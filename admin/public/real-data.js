/* Shared admin data boundary. No private browser persistence or demo fallbacks. */
(() => {
  let generation = 0;
  let subscribed = false;
  const listeners = new Set();
  function notify(kind) { for (const fn of listeners) fn(kind); }
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
      if (turn !== generation || access.auth_user_id !== session.user.id) throw new Error('Admin sessiyasi o‘zgardi.');
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
  function filterRows(rows, filter = 'all', search = '') {
    const text = search.trim().toLowerCase();
    return rows.filter(row => (filter === 'all' || row.type === filter || row.category === filter) &&
      (!text || [row.title, row.description, row.payment_method, row.reference].join(' ').toLowerCase().includes(text)));
  }
  function financeTotals(rows, environment = 'production') {
    const seen = new Set();
    let income = 0, expenses = 0, purchase_count = 0;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      if (row.environment !== environment || row.status !== 'completed') continue;
      if (row.type === 'income') {
        income += Number(row.amount);
        if (row.is_purchase && row.source === 'verified_provider') purchase_count++;
      } else if (row.type === 'expense') expenses += Number(row.amount);
    }
    return { income, expenses, net_profit: income - expenses, purchase_count };
  }
  function weeklyGrowth(current, previous) {
    return previous > 0 ? Math.round((current - previous) * 1000 / previous) / 10 : null;
  }
  function accessState(config, book) {
    if (![true, false, 'true', 'false'].includes(config?.premium_mode_enabled)) return null;
    if (config.premium_mode_enabled === false || config.premium_mode_enabled === 'false') return true;
    let ids = config.free_book_ids;
    if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { return null; } }
    if (Array.isArray(ids) && ids.every(id => Number.isInteger(Number(id)) && Number(id) >= 1 && Number(id) <= 6)) return ids.map(Number).includes(book);
    if (Number.isInteger(Number(config.free_books_count)) && config.free_books_count !== null && Number(config.free_books_count) >= 0 && Number(config.free_books_count) <= 6)
      return book <= Number(config.free_books_count);
    return null;
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
      if (!Array.isArray(data.books) || !data.config || ['total_users','dau','mastered_words','active_streak_users'].some(k => !Number.isFinite(data[k])))
        throw new Error('Tahlil javobi noto‘g‘ri.');
      return data;
    },
    async finance(query = {}) {
      const data = await rpc('admin_finance_snapshot', { p_environment: query.environment || 'production',
        p_filter: query.filter || 'all', p_search: query.search || '', p_before_date: query.before?.occurred_at || null,
        p_before_id: query.before?.id || null, p_limit: query.limit || 50 });
      if (!Array.isArray(data.rows) || !data.counts || ['income','expenses','net_profit','purchase_count','matched_count'].some(k => !Number.isFinite(data[k])))
        throw new Error('Moliya javobi noto‘g‘ri.');
      return data;
    },
    async create(entry) {
      const data = await rpc('admin_create_finance_entry', { p_entry: validateManualEntry(entry) });
      if (data.success !== true || !data.id) throw new Error('Saqlash tasdiqlanmadi.');
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
      notify('configuration'); return data.config;
    },
    async export(query) {
      const data = await api.finance({ ...query, before: null, limit: 2000 });
      if (data.matched_count > 2000) throw new Error('Eksport 2 000 yozuv bilan cheklangan. Qidiruvni aniqlashtiring.');
      return exportCSV(data.rows);
    }
  };
  window.inglyRealData = { api, filters, filterRows, financeTotals, weeklyGrowth, accessState,
    validateManualEntry, csvFields, exportCSV, formatNumber };
})();
