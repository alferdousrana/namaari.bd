import { esc, money, num, toNum, today, fmtDate, nextCode, uid, byDateDesc } from '../core/utils.js';
import { purchaseTotal } from '../core/calc.js';
import * as store from '../core/store.js';
import { icon, openSheet, toast, confirmBox, field, input, select, textarea, readForm, empty, options, pill } from '../ui/components.js';
import { searchBox, lineRow, readLines, bindLines } from './shared.js';

let filter = { q: '', due: false };
export const title = 'ক্রয় (পণ্য কেনা)';

export function render({ C }) {
  return `
    <div class="toolbar">
      ${searchBox('q-po', filter.q, 'ক্রয় নং, সাপ্লায়ার বা পণ্য')}
      <button class="btn primary" data-new>${icon('plus')}নতুন ক্রয়</button>
    </div>
    <div class="chips"><button class="chip ${!filter.due ? 'on' : ''}" data-due="0">সব</button><button class="chip ${filter.due ? 'on' : ''}" data-due="1">সাপ্লায়ারের বাকি</button></div>
    <div class="section list" id="po-list">${listHtml(C)}</div>`;
}
function listHtml(C) {
  const q = filter.q.toLowerCase();
  const rows = C.purchases.filter((p) => {
    if (filter.due && !(p.due > 0)) return false;
    if (!q) return true;
    return [p.code, C.supplierById[p.supplierId]?.name, ...(p.items || []).map((i) => C.variantLabel(i.variantId))].join(' ').toLowerCase().includes(q);
  }).sort(byDateDesc);
  if (!rows.length) return empty('কোনো ক্রয় নেই', 'সাপ্লায়ার থেকে পণ্য কিনলে এখানে যোগ করুন — স্টক নিজে থেকে বাড়বে।', '<button class="btn primary" data-new>নতুন ক্রয়</button>');
  return rows.slice(0, 300).map((p) => `<button class="item" data-open="${esc(p.id)}">
      <div class="avatar accent">${icon('truck')}</div>
      <div class="main-col"><div class="t">${esc(C.supplierById[p.supplierId]?.name || 'সাপ্লায়ার ছাড়া')}</div>
      <div class="s">${esc(p.code)} · ${fmtDate(p.date)} · ${num(p.qty)} পিস · ${esc((p.items || []).map((i) => C.variantLabel(i.variantId)).join(', '))}</div></div>
      <div class="r"><b>${money(p.total)}</b>${p.due > 0 ? `<small class="bad">বাকি ${money(p.due)}</small>` : '<small class="good">পরিশোধিত</small>'}</div>
    </button>`).join('');
}
export function mount(root, ctx) {
  root.querySelector('#q-po').addEventListener('input', (e) => { filter.q = e.target.value; root.querySelector('#po-list').innerHTML = listHtml(ctx.C); });
  root.addEventListener('click', (e) => {
    const d = e.target.closest('[data-due]');
    if (d) { filter.due = d.dataset.due === '1'; ctx.rerender(); return; }
    if (e.target.closest('[data-new]')) return openPurchaseForm(ctx);
    const it = e.target.closest('[data-open]');
    if (it) openPurchaseForm(ctx, it.dataset.open);
  });
}

export function openPurchaseForm(ctx, id, preset = {}) {
  const { S, C } = ctx;
  const st = S.settings;
  const p = id ? S.purchases.find((x) => x.id === id) : null;
  const isNew = !p;
  const d = p || { date: today(), items: [{ qty: 1 }], extra: 0, supplierId: preset.supplierId || '' };
  const comp = p ? C.purchases.find((x) => x.id === id) : null;
  const supOpts = S.suppliers.map((s) => ({ value: s.id, label: s.name }));
  const body = `<form class="form" id="po-form" novalidate>
    <div class="grid-2">
      ${field('সাপ্লায়ার', `<select name="supplierId">${options([{ value: '', label: '—' }, { value: '__new', label: '＋ নতুন সাপ্লায়ার' }, ...supOpts], d.supplierId)}</select>`)}
      ${field('তারিখ', input('date', d.date, 'type="date"'))}
      <div class="span-2 grid-2" data-newsup hidden>${field('সাপ্লায়ারের নাম', input('ns_name'))}${field('ফোন', input('ns_phone', '', 'type="tel"'))}</div>
    </div>
    <div>
      <div class="panel-head"><h3>পণ্য</h3><button type="button" class="btn sm ghost" data-add-line>${icon('plus')}আরেকটি</button></div>
      <div class="lines" data-lines>${(d.items || []).map((i) => lineRow(C, S, i, 'purchase')).join('')}</div>
      <p class="hint">নতুন ডিজাইন হলে আগে "পণ্য" পাতায় পণ্য ও সাইজ/রং যোগ করুন।</p>
    </div>
    <div class="grid-2">
      ${field('অতিরিক্ত খরচ (৳)', input('extra', d.extra || '', 'type="number" min="0" step="any"'), { hint: 'যেমন মাল আনার গাড়ি ভাড়া — স্টকের দামে যোগ হবে' })}
      <label class="field"><span class="field-label">কেনা দাম দিয়ে পণ্যের কস্ট আপডেট</span><span style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" name="updateCost" checked> হ্যাঁ</span></label>
    </div>
    ${isNew ? `<div class="grid-2">${field('এখন পরিশোধ করেছি (৳)', input('paidNow', '', 'type="number" min="0" step="any"'), { hint: 'পুরোটা দিলে খালি রেখে "সব পরিশোধ" চাপুন' })}${field('মাধ্যম', select('payMethod', st.lists.payMethods, st.lists.payMethods[0]))}</div>` : `
    <div><h3 style="font-size:16px;margin-bottom:8px">পেমেন্ট</h3>
      <div class="list">${(p.payments || []).map((x) => `<div class="item" style="cursor:default"><div class="main-col"><div class="t">${money(x.amount)}</div><div class="s">${fmtDate(x.date)} · ${esc(x.method)}</div></div><button type="button" class="icon-btn" data-delpay="${esc(x.id)}">${icon('trash')}</button></div>`).join('') || '<p class="muted">কোনো পেমেন্ট নেই</p>'}</div>
      <div class="grid-3" style="margin-top:8px;align-items:end">${field('টাকা', input('payAmt', comp?.due > 0 ? comp.due : '', 'type="number" min="0" step="any"'))}${field('মাধ্যম', select('payMethod2', st.lists.payMethods, st.lists.payMethods[0]))}<button type="button" class="btn" data-addpay>${icon('plus')}যোগ</button></div>
    </div>`}
    ${field('নোট', textarea('note', d.note || ''))}
    <div class="totals" data-totals></div>
  </form>`;
  openSheet({
    title: isNew ? 'নতুন ক্রয়' : `ক্রয় ${p.code}`, body, wide: true,
    footer: `${!isNew ? `<button class="btn ghost" data-delete>${icon('trash')}মুছুন</button>` : ''}${isNew ? '<button class="btn ghost" data-fullpay>সব পরিশোধ করে সেভ</button>' : ''}<button class="btn primary" data-save>সেভ করুন</button>`,
    onMount: (el, close) => {
      const form = el.querySelector('#po-form');
      let payments = p ? [...(p.payments || [])] : [];
      const supSel = form.querySelector('[name=supplierId]');
      supSel.addEventListener('change', () => { form.querySelector('[data-newsup]').hidden = supSel.value !== '__new'; });
      const recalc = () => {
        const total = purchaseTotal({ items: readLines(form, 'purchase'), extra: form.querySelector('[name=extra]').value });
        const paid = isNew ? toNum(form.querySelector('[name=paidNow]').value) : payments.reduce((a, x) => a + toNum(x.amount), 0);
        form.querySelector('[data-totals]').innerHTML = `<div class="grand"><span>মোট</span><b>${money(total)}</b></div><div><span>বাকি থাকবে</span><b class="${total - paid > 0 ? 'bad' : ''}">${money(total - paid)}</b></div>`;
        return total;
      };
      bindLines(form, C, S, 'purchase', recalc);
      form.addEventListener('input', recalc); recalc();
      form.addEventListener('click', (e) => {
        const dp = e.target.closest('[data-delpay]');
        if (dp) { payments = payments.filter((x) => x.id !== dp.dataset.delpay); dp.closest('.item').remove(); recalc(); }
        if (e.target.closest('[data-addpay]')) {
          const amt = toNum(form.querySelector('[name=payAmt]').value);
          if (!(amt > 0)) return toast('টাকা লিখুন', 'err');
          payments.push({ id: uid(), date: today(), amount: amt, method: form.querySelector('[name=payMethod2]').value });
          doSave(false); toast(`${money(amt)} পরিশোধ যোগ হয়েছে`);
        }
      });
      const doSave = (fullPay) => {
        const f = readForm(form);
        const items = readLines(form, 'purchase');
        if (!items.length) { toast('অন্তত একটি পণ্য দিন', 'err'); return false; }
        let supplierId = f.supplierId;
        if (supplierId === '__new') {
          if (!f.ns_name) { toast('সাপ্লায়ারের নাম দিন', 'err'); return false; }
          supplierId = nextCode('SUP', S.suppliers.map((s) => s.code));
          store.save('suppliers', { id: supplierId, code: supplierId, name: f.ns_name, phone: f.ns_phone || '', address: '', note: '' });
        }
        const total = purchaseTotal({ items, extra: f.extra });
        if (isNew) {
          const amt = fullPay ? total : toNum(f.paidNow);
          if (amt > 0) payments = [{ id: uid(), date: f.date, amount: amt, method: f.payMethod }];
        }
        const code = p ? p.code : nextCode('PO', S.purchases.map((x) => x.code));
        store.save('purchases', { ...(p || {}), id: p ? p.id : code, code, date: f.date, supplierId, items, extra: toNum(f.extra), payments, note: f.note });
        if (f.updateCost) for (const i of items) {
          const v = C.variantById[i.variantId];
          if (v && toNum(v.cost) !== i.cost && i.cost > 0) store.save('variants', { ...v, cost: i.cost });
        }
        return code;
      };
      el.querySelector('[data-save]').addEventListener('click', () => { const c = doSave(false); if (c) { close(); toast(`ক্রয় ${c} সেভ হয়েছে`); } });
      el.querySelector('[data-fullpay]')?.addEventListener('click', () => { const c = doSave(true); if (c) { close(); toast(`ক্রয় ${c} সেভ হয়েছে`); } });
      el.querySelector('[data-delete]')?.addEventListener('click', async () => {
        if (await confirmBox(`ক্রয় ${p.code} মুছবেন? স্টক কমে যাবে।`)) { store.remove('purchases', p.id); close(); toast('মুছে ফেলা হয়েছে'); }
      });
    },
  });
}
