import React from 'react';
import '../../public/real-data.js';

const panel = 'bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5';
const button = 'px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 disabled:opacity-50';
const input = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white';
const model = () => window.inglyRealData;
const categories = { other: 'Boshqa', vip: 'VIP obuna', book: 'Kitob', hosting: 'Server va hosting', sms: 'SMS', marketing: 'Marketing' };
const methods = { cash: 'Naqd pul', bank_transfer: 'Bank o‘tkazmasi', click: 'Click', payme: 'Payme', other: 'Boshqa' };

function useResource(fetcher, kinds) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const request = React.useRef(0);
  const load = React.useCallback(async () => {
    const turn = ++request.current;
    setBusy(true); setError(''); setData(null);
    try {
      const value = await fetcher();
      if (request.current === turn) setData(value);
    } catch (err) { if (request.current === turn) setError(err.message || 'Ma’lumot yuklanmadi.'); }
    finally { if (request.current === turn) setBusy(false); }
  }, [fetcher]);
  React.useEffect(() => {
    let timer;
    load();
    const unsubscribe = model()?.api.subscribe(kind => {
      if (kind === 'session') { ++request.current; setData(null); setError(''); }
      if (kind === 'session' || kinds.includes(kind)) {
        clearTimeout(timer); timer = setTimeout(load, 0);
      }
    });
    return () => { ++request.current; clearTimeout(timer); unsubscribe?.(); };
  }, [load, kinds]);
  return { data, error, busy, load };
}
const dashboardKinds = ['configuration'];
const financeKinds = ['finance'];
function Feedback({ error, busy }) {
  return <>{busy && <p role="status" className="text-slate-500">Yuklanmoqda…</p>}
    {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-700">Ma’lumot mavjud emas: {error}</p>}</>;
}
function Metric({ label, value, note }) {
  return <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</div>
    <div className="text-3xl font-extrabold text-slate-900 mt-2">{value == null ? '—' : model().formatNumber(value)}</div>
    {note && <div className="text-xs text-slate-500 mt-2">{note}</div>}
  </div>;
}
function bookLabel(free) { return free === null ? 'Sozlama mavjud emas' : free ? 'Bepul' : 'Pullik / VIP'; }

export function Dashboard({ onNavigate = () => {} }) {
  const fetcher = React.useCallback(() => model().api.dashboard(), []);
  const { data, error, busy, load } = useResource(fetcher, dashboardKinds);
  const words = data?.books.reduce((total, book) => total + book.word_count, 0);
  return <div className="space-y-6">
    <div className="rounded-3xl bg-gradient-to-r from-brand-600 via-brand-500 to-accent-400 p-8 text-white shadow-xl">
      <h1 className="text-3xl font-extrabold mb-2">Ingly boshqaruv paneli</h1>
      <p>Ingliz tilini o‘rganish uchun mahalliy saqlanadigan kitoblar va lug‘at.</p>
      {data && <p className="text-sm mt-2">{data.books.length} ta kitob • {model().formatNumber(words)} ta so‘z • {data.timezone}</p>}
      <div className="flex flex-wrap gap-3 mt-5">
        <button className={button} onClick={() => onNavigate('words')}>So‘zlarni ko‘rish</button>
        <button className={button} onClick={() => onNavigate('monetization')}>Monetizatsiya sozlamalari</button>
        <button className={button} disabled={busy} onClick={load}>Qayta yuklash</button>
      </div>
    </div>
    <Feedback error={error} busy={busy} />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <Metric label="Faol foydalanuvchilar (DAU)" value={data?.dau} note="Bugungi sinxronlangan o‘rganish faolligi. Oflayn navbatlar hali hisobga kirmaydi." />
      <Metric label="Jami foydalanuvchilar" value={data?.total_users} note="Auth bilan bog‘langan ilova profillari; adminlar kiritilmaydi." />
      <Metric label="O‘zlashtirilgan so‘zlar" value={data?.mastered_words} note="Har bir foydalanuvchi va darslik so‘zi bir marta. Shaxsiy lug‘at kiritilmaydi." />
      <Metric label="Faol streak egalari" value={data?.active_streak_users} note="Sinxronlangan musbat streak, oxirgi faollik bugun yoki kecha. Eski UTC yozuvlari kiritilmaydi." />
    </div>
    <div className={panel}>
      <p className="font-semibold">Haftalik yangi foydalanuvchilar o‘sishi: {data?.weekly_growth_pct == null
        ? 'Hisoblash uchun yetarli ma’lumot mavjud emas.' : `${data.weekly_growth_pct > 0 ? '+' : ''}${data.weekly_growth_pct}%`}</p>
      {data && <p className="text-sm text-slate-500">Joriy 7 kun: {data.current_week_new_users}; oldingi 7 kun: {data.previous_week_new_users}.
        Faollik kuzatuvi {new Date(data.activity_tracking_started_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })} dan boshlangan.
        Oxirgi yuklash: {new Date(data.generated_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}.</p>}
    </div>
    <div className={panel}>
      <h2 className="text-lg font-extrabold">Kitoblar va o‘rganish holati</h2>
      {!data && <p className="text-slate-500">Kitoblar va monetizatsiya holati serverdan yuklanadi.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {data?.books.map(book => <div key={book.book} className="p-5 rounded-2xl border border-slate-200 bg-slate-50">
          <div className="flex justify-between gap-2"><h3 className="font-bold">{book.title}</h3>
            <span className="text-xs text-brand-600">{bookLabel(model().accessState(data.config, book.book))}</span></div>
          <p className="text-sm text-slate-500 mt-2">{book.unit_count} ta unit • {model().formatNumber(book.word_count)} ta so‘z • Ilovada mavjud</p>
          <p className="text-xs mt-3">O‘zlashtirgan foydalanuvchilar: {model().formatNumber(book.learners)}</p>
          <p className="text-xs">O‘zlashtirilgan foydalanuvchi–so‘z juftliklari: {model().formatNumber(book.mastered_pairs)}</p>
        </div>)}
      </div>
    </div>
  </div>;
}

export function Finance() {
  const renderGeneration = model().api.generation();
  const [environment, setEnvironment] = React.useState('production');
  const [filter, setFilter] = React.useState('all');
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [cursors, setCursors] = React.useState([null]);
  const [form, setForm] = React.useState(null);
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const lock = React.useRef(false);
  const pending = React.useRef(null);
  const before = cursors[cursors.length - 1];
  const fetcher = React.useCallback(() => model().api.finance({ environment, filter, search, before }), [environment, filter, search, before]);
  const { data, error, busy, load } = useResource(fetcher, financeKinds);
  const query = { environment, filter, search };
  React.useEffect(() => model().api.subscribe(kind => {
    if (kind === 'session') { setForm(null); setMessage(''); pending.current = null; }
  }), []);
  const run = async action => {
    if (lock.current || renderGeneration !== model().api.generation()) return;
    lock.current = true; setSaving(true); setMessage('');
    const generation = model().api.generation();
    try { await action(generation); }
    catch (err) { if (generation === model().api.generation()) setMessage(err.message); }
    finally { lock.current = false; setSaving(false); }
  };
  const save = event => {
    event.preventDefault();
    const submitted = { ...form };
    run(async generation => {
      const normalized = model().validateManualEntry(submitted);
      const signature = JSON.stringify(normalized);
      if (pending.current && pending.current !== signature) throw new Error('Tasdiqlanmagan so‘rovni aynan qayta yuboring yoki hujjat raqami bo‘yicha tekshiring.');
      pending.current = signature;
      await model().api.create(normalized);
      if (generation !== model().api.generation()) return;
      setForm(null); pending.current = null; setMessage('Operatsiya serverda saqlandi.'); setCursors([null]);
    });
  };
  const openForm = () => {
    pending.current = null;
    setForm({ request_id: crypto.randomUUID(), type: 'income', amount: '', currency: 'UZS', category: 'other',
      title: '', description: '', reference: '', payment_method: 'cash', environment,
      occurred_at: new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 16) + '+05:00' });
  };
  const labels = { all: 'Barchasi', income: 'Kirimlar', expense: 'Chiqimlar', vip: 'VIP obunalar', book: 'Kitoblar' };
  return <div className={panel}>
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div><h1 className="text-2xl font-extrabold">Moliya va kirim-chiqimlar boshqaruvi</h1>
        <p className="text-sm text-slate-500">Qo‘lda kiritilgan yozuvlar va server tasdiqlagan xaridlar. Click/Payme integratsiyasi hali mavjud emas.</p>
        <p className="text-xs text-amber-700">Bu yangi moliya reyestri. Eski transactions_data arxivi tekshirilmasdan ko‘chirilmagan va jami summalarga kirmaydi.</p></div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy || saving} onClick={load}>Qayta yuklash</button>
        <button className={button} disabled={busy || saving || !data} onClick={() => run(async generation => {
          const csv = await model().api.export(query);
          if (generation !== model().api.generation()) return;
          const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          const link = document.createElement('a'); link.href = url; link.download = `ingly_moliya_${environment}.csv`;
          document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
          setMessage('Tanlangan muhit, filtr va qidiruvdagi yozuvlar eksport qilindi.');
        })}>CSV / Excel uchun eksport</button>
        <button className={button} disabled={saving} onClick={openForm}>+ Yangi kirim / chiqim</button>
      </div>
    </div>
    <p className="text-xs text-slate-500">Asosiy jami summalar tanlangan muhit bo‘yicha; filtr va qidiruv ularni o‘zgartirmaydi. Faqat yakunlangan yozuvlar hisoblanadi. Qo‘lda kiritilgan kirim xaridlar soniga kirmaydi.</p>
    <div className="flex flex-wrap gap-3 items-center">
      <label>Muhit: <select className={button} value={environment} onChange={e => { setEnvironment(e.target.value); setCursors([null]); }}>
        <option value="production">Ishlab chiqarish (real)</option><option value="test">TEST — asosiy daromadga kirmaydi</option><option value="mock">MOCK — asosiy daromadga kirmaydi</option>
      </select></label>
      {environment !== 'production' && <strong className="text-amber-700">TEST / MOCK ko‘rinishi — production jami emas</strong>}
    </div>
    <Feedback error={error} busy={busy} />
    {message && <p role="status" className="text-sm text-brand-700">{message}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Metric label="Jami kirim (so‘m)" value={data?.income} /><Metric label="Jami chiqim (so‘m)" value={data?.expenses} />
      <Metric label="Sof foyda (so‘m)" value={data?.net_profit} /><Metric label="Tasdiqlangan xaridlar soni" value={data?.purchase_count} />
    </div>
    <div className="flex flex-wrap gap-2">
      {model().filters.map(key => <button key={key} className={`${button} ${filter === key ? 'ring-2 ring-brand-500' : ''}`}
        onClick={() => { setFilter(key); setCursors([null]); }}>{labels[key]} ({data?.counts[key] ?? '—'})</button>)}
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); setCursors([null]); }}>
        <input aria-label="Moliya qidiruvi" className={input} maxLength={100} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Sarlavha, izoh yoki hujjat raqami" />
        <button className={button}>Qidirish</button>
      </form>
    </div>
    {data?.matched_count === 0 && <p className="text-center p-8 text-slate-500">Hozircha moliyaviy operatsiyalar mavjud emas.</p>}
    {!!data?.rows.length && <div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead><tr>{['Sarlavha / toifa', 'Summa', 'Usul / manba', 'Sana (Toshkent)', 'Holat', 'Amal'].map(title => <th key={title} className="p-3 border-b">{title}</th>)}</tr></thead>
      <tbody>{data.rows.map(row => <tr key={row.id} className="border-b border-slate-100">
        <td className="p-3"><strong>{row.title}</strong><p className="text-xs text-slate-500">{categories[row.category]} • {row.reference}</p><p className="text-xs">{row.description}</p></td>
        <td className={`p-3 whitespace-nowrap font-bold ${row.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{row.type === 'income' ? '+' : '−'}{model().formatNumber(row.amount)} so‘m</td>
        <td className="p-3">{methods[row.payment_method]}<p className="text-xs">{row.source === 'manual' ? 'Qo‘lda kiritilgan' : 'Server tasdiqlagan'} • {row.environment}</p></td>
        <td className="p-3">{new Date(row.occurred_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}</td>
        <td className="p-3">{{ completed: 'Yakunlangan', pending: 'Kutilmoqda', failed: 'Xato', cancelled: 'Bekor qilingan', voided: 'Hisobdan chiqarilgan' }[row.status]}{row.void_reason && <p className="text-xs">{row.void_reason}</p>}</td>
        <td className="p-3">{row.status !== 'voided' && <button className={button} disabled={saving} onClick={() => {
          const reason = window.prompt('Hisobdan chiqarish sababi:');
          if (reason == null) return;
          run(async generation => { await model().api.void(row.id, reason); if (generation === model().api.generation()) { setMessage('Yozuv hisobdan chiqarildi. Audit tarixi saqlandi.'); setCursors([null]); } });
        }}>Hisobdan chiqarish</button>}</td>
      </tr>)}</tbody>
    </table></div>}
    {data && <div className="flex justify-between items-center gap-3 text-sm">
      <span>Topilgan yozuvlar: {model().formatNumber(data.matched_count)} • Sahifa: {cursors.length}</span>
      <button className={button} disabled={busy || cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>Oldingi</button>
      <button className={button} disabled={busy || data.rows.length < 50 || cursors.length * 50 >= data.matched_count}
        onClick={() => setCursors([...cursors, data.rows[data.rows.length - 1]])}>Keyingi</button>
    </div>}
    {form && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <form onSubmit={save} className={`${panel} max-w-lg w-full max-h-[90vh] overflow-y-auto`}>
        <h2 className="font-extrabold text-xl">Yangi kirim / chiqim</h2>
        <p className="text-xs text-slate-500">Qo‘lda kiritilgan yozuv. Xarid yoki VIP huquqi yaratmaydi. Karta ma’lumotlari va maxfiy ma’lumotlarni kiritmang.</p>
        <label className="block">Turi<select className={input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="income">Kirim</option><option value="expense">Chiqim</option></select></label>
        <label className="block">Muhit<select className={input} value={form.environment} onChange={e => setForm({ ...form, environment: e.target.value })}><option value="production">Real / production</option><option value="test">TEST</option><option value="mock">MOCK</option></select></label>
        <label className="block">Toifa<select className={input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Object.entries(categories).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {['title','amount','reference','occurred_at','description'].map(key => <label key={key} className="block">
          {{ title: 'Sarlavha', amount: 'Summa (so‘m)', reference: 'Takrorlanmas hujjat raqami', occurred_at: 'Sana va vaqt (Toshkent)', description: 'Izoh' }[key]}
          <input className={input} type={key === 'amount' ? 'number' : key === 'occurred_at' ? 'datetime-local' : 'text'} min={key === 'amount' ? 1 : undefined} step={key === 'amount' ? 1 : undefined}
            maxLength={key === 'description' ? 1000 : 200} required={key !== 'description'} value={key === 'occurred_at' ? form[key].slice(0, 16) : form[key]}
            onChange={e => setForm({ ...form, [key]: key === 'occurred_at' ? e.target.value + '+05:00' : e.target.value })} /></label>)}
        <label className="block">To‘lov usuli<select className={input} value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
          {Object.entries(methods).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {message && <p role="alert" className="text-rose-700">{message}</p>}
        <div className="flex gap-2"><button type="submit" className={button} disabled={saving}>{saving ? 'Saqlanmoqda…' : 'Serverda saqlash'}</button>
          <button type="button" className={button} disabled={saving} onClick={() => setForm(null)}>Yopish</button></div>
      </form>
    </div>}
  </div>;
}

export function Monetization() {
  const renderGeneration = model().api.generation();
  const fetcher = React.useCallback(() => model().api.configuration(), []);
  const { data, error, busy, load } = useResource(fetcher, dashboardKinds);
  const [draft, setDraft] = React.useState({});
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const lock = React.useRef(false);
  const config = { ...data?.config, ...draft };
  React.useEffect(() => { setDraft({}); setMessage(''); }, [data]);
  const save = async () => {
    if (lock.current || !data || renderGeneration !== model().api.generation()) return;
    lock.current = true; setSaving(true); setMessage('');
    const generation = model().api.generation();
    try {
      await model().api.configure(draft);
      if (generation === model().api.generation()) { setDraft({}); setMessage('Sozlamalar serverda saqlandi.'); }
    } catch (err) { if (generation === model().api.generation()) setMessage(err.message); }
    finally { lock.current = false; setSaving(false); }
  };
  let ids = config.free_book_ids;
  if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = null; } }
  if (!Array.isArray(ids) && config.free_books_count != null && Number.isInteger(Number(config.free_books_count)))
    ids = Array.from({ length: Math.min(6, Math.max(0, Number(config.free_books_count))) }, (_, i) => i + 1);
  else if (Array.isArray(ids) && config.free_books_count != null && Number.isInteger(Number(config.free_books_count)))
    ids = [...new Set([...ids.map(Number), ...Array.from({ length: Math.min(6, Math.max(0, Number(config.free_books_count))) }, (_, i) => i + 1)])];
  return <div className={panel}>
    <div className="flex justify-between gap-3"><h1 className="text-2xl font-extrabold">Monetizatsiya sozlamalari</h1><button className={button} onClick={load} disabled={busy || saving}>Qayta yuklash</button></div>
    <Feedback error={error} busy={busy} />
    <p className="text-sm text-slate-500">Holat app_settings jadvalidan olinadi. O‘zgarishlar faqat server tasdig‘idan keyin kuchga kiradi.
      Reklama integratsiyasi yoki haqiqiy Click/Payme to‘lovini sozlash bu sahifaning vazifasi emas.</p>
    {data && <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">{[
        ['ads_enabled', 'Reklama konfiguratsiyasi'], ['premium_mode_enabled', 'Pullik / VIP rejimi'], ['videos_enabled', 'Mavjud video konfiguratsiyasi']
      ].map(([key, label]) => <label key={key} className="border rounded-2xl p-5 flex items-center gap-3">
        <input type="checkbox" disabled={saving} checked={config[key] === true || config[key] === 'true'} onChange={e => setDraft({ ...draft, [key]: e.target.checked })} />
        <span>{label}<span className="block text-xs text-slate-500">{config[key] == null ? 'Sozlama mavjud emas' : config[key] === true || config[key] === 'true' ? 'Yoqilgan' : 'O‘chiq'}</span></span>
      </label>)}</div>
      <h2 className="font-bold">Bepul kitoblar (VIP rejimi yoqilganda)</h2>
      {!Array.isArray(ids) && <p className="text-amber-700">Bepul kitoblar konfiguratsiyasi mavjud emas. Saqlash uchun kitoblarni belgilang.</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{data.books.map(book => <label key={book.book} className="p-4 border rounded-2xl flex gap-2 items-center">
        <input type="checkbox" disabled={saving} checked={Array.isArray(ids) && ids.map(Number).includes(book.book)} onChange={e => {
          const selected = Array.isArray(ids) ? ids.map(Number) : [];
          setDraft({ ...draft, free_book_ids: e.target.checked ? [...new Set([...selected, book.book])].sort() : selected.filter(id => id !== book.book) });
        }} />{book.title}
      </label>)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[
        ['premium_monthly_price', 'VIP oylik narxi'], ['premium_monthly_original_price', 'VIP asl narxi'],
        ['single_book_price', 'Kitob narxi'], ['single_book_original_price', 'Kitob asl narxi']
      ].map(([key, label]) => <label key={key}>{label} (so‘m)<input className={input} type="number" min={1} step={1} disabled={saving}
        placeholder="Sozlama mavjud emas" value={config[key] ?? ''} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })} /></label>)}</div>
      {message && <p role="status" className="text-brand-700">{message}</p>}
      <button className={button} onClick={save} disabled={saving || !Object.keys(draft).length}>{saving ? 'Saqlanmoqda…' : 'Sozlamalarni serverda saqlash'}</button>
    </>}
  </div>;
}
