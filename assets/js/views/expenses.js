import { esc, money, today, fmtDate, nextCode, monthKey, fmtMonth, byDateDesc, sum, toNum } from '../core/utils.js';
import * as store from '../core/store.js';
import { icon, openSheet, toast, confirmBox, field, input, select, textarea, readForm, empty, options, pill } from '../ui/components.js';
import { searchBox } from './shared.js';

let filter = { q: '', month: '', cat: '' };
export const title = 'খরচ';

export function render({ C, S }) {
  const months = [...new Set(C.expenses.map((e) => monthKey(e.date)))].sort().reverse();
  const rows = filtered(C);
  const biz = sum(rows.filter((e) => !e.drawing), (e) => e.amount);
  const draw = sum(rows.filter((e) => e.drawing), (e) => e.amount);
  return `
    <div class="toolbar">
      ${searchBox('q-exp', filter.q, 'বিবরণ খুঁজুন')}
      <button class="btn primary" data-new>${icon('plus')}খরচ যোগ</button>
    </div>
    <div class="grid-2" style="margin-bottom:12px">
      <select id="f-month">${options([{ value: '', label: 'সব মাস' }, ...months.map((m) => ({ value: m, label: fmtMonth(m) }))], filter.month)}</select>
      <select id="f-cat">${options([{ value: '', label: 'সব ক্যাটাগরি' }, ...S.settings.lists.expenseCats], filter.cat)}</select>
    </div>
    <div class="kpis" style="grid-template-columns:repeat(2,1fr)">
      <div class="kpi"><span>ব্যবসার খরচ</span><b>${money(biz)}</b><small>লাভ থেকে বাদ যায়</small></div>
      <div class="kpi"><span>ব্যক্তিগত / উত্তোলন</span><b>${money(draw)}</b><small>${esc((S.settings.drawingCats || []).join(', '))}</small></div>
    </div>
    <div class="section list" id="exp-list">${listHtml(rows)}</div>`;
}
const filtered = (C) => {
  const q = filter.q.toLowerCase();
  return C.expenses.filter((e) => (!filter.month || monthKey(e.date) === filter.month) && (!filter.cat || e.category === filter.cat) && (!q || `${e.description} ${e.note} ${e.category}`.toLowerCase().includes(q))).sort(byDateDesc);
};
function listHtml(rows) {
  if (!rows.length) return empty('কোনো খরচ নেই', 'কুরিয়ার, প্যাকেজিং, বুস্ট — ছোট খরচও লিখে রাখুন।', '<button class="btn primary" data-new>খরচ যোগ</button>');
  return rows.slice(0, 400).map((e) => `<button class="item" data-open="${esc(e.id)}">
    <div class="avatar ${e.drawing ? 'bad' : 'accent'}">${icon(e.drawing ? 'wallet' : 'receipt')}</div>
    <div class="main-col"><div class="t">${esc(e.description || e.category)}</div><div class="s">${fmtDate(e.date)} · ${esc(e.category)} · ${esc(e.method || '')}</div></div>
    <div class="r"><b>${money(e.amount)}</b>${e.drawing ? '<small class="muted">উত্তোলন</small>' : ''}</div></button>`).join('');
}
export function mount(root, ctx) {
  root.querySelector('#q-exp').addEventListener('input', (e) => { filter.q = e.target.value; root.querySelector('#exp-list').innerHTML = listHtml(filtered(ctx.C)); });
  root.querySelector('#f-month').addEventListener('change', (e) => { filter.month = e.target.value; ctx.rerender(); });
  root.querySelector('#f-cat').addEventListener('change', (e) => { filter.cat = e.target.value; ctx.rerender(); });
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-new]')) return openExpenseForm(ctx);
    const it = e.target.closest('[data-open]');
    if (it) openExpenseForm(ctx, it.dataset.open);
  });
}

export function openExpenseForm(ctx, id) {
  const { S } = ctx;
  const L = S.settings.lists;
  const x = id ? S.expenses.find((e) => e.id === id) : null;
  const d = x || { date: today(), category: L.expenseCats[0], method: L.payMethods[0] };
  openSheet({
    title: x ? `খরচ ${x.code}` : 'নতুন খরচ',
    body: `<form class="form" id="exp-form">
      <div class="grid-2">
        ${field('টাকা (৳)', input('amount', d.amount ?? '', 'type="number" inputmode="decimal" min="0" step="any" required'))}
        ${field('তারিখ', input('date', d.date, 'type="date"'))}
        ${field('ক্যাটাগরি', select('category', L.expenseCats, d.category))}
        ${field('পেমেন্ট মাধ্যম', select('method', L.payMethods, d.method))}
      </div>
      ${field('বিবরণ', input('description', d.description || '', 'placeholder="যেমন: ১০টি পার্সেল কুরিয়ার"'))}
      ${field('নোট', textarea('note', d.note || ''))}
      <p class="hint">"${esc((S.settings.drawingCats || []).join(', '))}" ক্যাটাগরি ব্যবসার লাভ কমায় না — মালিকের উত্তোলন হিসেবে ধরা হয়। সেটিংস থেকে বদলানো যায়।</p>
    </form>`,
    footer: `${x ? `<button class="btn ghost" data-delete>${icon('trash')}মুছুন</button>` : ''}<button class="btn primary" data-save>সেভ করুন</button>`,
    onMount: (el, close) => {
      el.querySelector('[data-save]').addEventListener('click', () => {
        const f = readForm(el.querySelector('#exp-form'));
        if (!(toNum(f.amount) > 0)) return toast('টাকার পরিমাণ দিন', 'err');
        const code = x ? x.code : nextCode('EXP', S.expenses.map((e) => e.code));
        store.save('expenses', { ...(x || {}), id: x ? x.id : code, code, ...f, amount: toNum(f.amount) });
        close(); toast('খরচ সেভ হয়েছে');
      });
      el.querySelector('[data-delete]')?.addEventListener('click', async () => {
        if (await confirmBox('এই খরচটি মুছবেন?')) { store.remove('expenses', x.id); close(); toast('মুছে ফেলা হয়েছে'); }
      });
    },
  });
}
