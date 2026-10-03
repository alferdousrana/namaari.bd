import { esc, money, num, toNum, today, fmtDate, nextCode, uid, waNumber, byDateDesc } from '../core/utils.js';
import * as store from '../core/store.js';
import { icon, openSheet, toast, confirmBox, field, input, select, textarea, readForm, empty } from '../ui/components.js';
import { searchBox, initials, statusPill } from './shared.js';
import { openOrderDetail, openOrderForm } from './sales.js';
import { openPurchaseForm } from './purchases.js';

// ======================= কাস্টমার =======================
let cf = { q: '', due: false };
export const customers = {
  title: 'কাস্টমার',
  render({ C }) {
    const totalDue = C.customers.reduce((a, c) => a + Math.max(0, c.due), 0);
    return `<div class="toolbar">${searchBox('q-cust', cf.q, 'নাম, ফোন বা ঠিকানা')}<button class="btn primary" data-new>${icon('plus')}নতুন কাস্টমার</button></div>
      <div class="chips"><button class="chip ${!cf.due ? 'on' : ''}" data-due="0">সব <span class="count">${C.customers.length}</span></button><button class="chip ${cf.due ? 'on' : ''}" data-due="1">বাকি আছে · ${money(totalDue)}</button></div>
      <div class="section list" id="cust-list">${custList(C)}</div>`;
  },
  mount(root, ctx) {
    root.querySelector('#q-cust').addEventListener('input', (e) => { cf.q = e.target.value; root.querySelector('#cust-list').innerHTML = custList(ctx.C); });
    root.addEventListener('click', (e) => {
      const d = e.target.closest('[data-due]');
      if (d) { cf.due = d.dataset.due === '1'; ctx.rerender(); return; }
      if (e.target.closest('[data-new]')) return openCustomerForm(ctx);
      const it = e.target.closest('[data-open]');
      if (it) openCustomerDetail(ctx, it.dataset.open);
    });
  },
};
function custList(C) {
  const q = cf.q.toLowerCase();
  const rows = C.customers.filter((c) => (!cf.due || c.due > 0) && (!q || `${c.name} ${c.phone} ${c.address} ${c.code}`.toLowerCase().includes(q)))
    .sort((a, b) => (cf.due ? b.due - a.due : (b.lastDate || '').localeCompare(a.lastDate || '')));
  if (!rows.length) return empty('কোনো কাস্টমার নেই', 'অর্ডার নেওয়ার সময়ও নতুন কাস্টমার যোগ করা যায়।');
  return rows.map((c) => `<button class="item" data-open="${esc(c.id)}"><div class="avatar">${initials(c.name)}</div>
    <div class="main-col"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.phone || 'ফোন নেই')} · ${c.orders} অর্ডার${c.lastDate ? ' · শেষ ' + fmtDate(c.lastDate) : ''}</div></div>
    <div class="r"><b>${money(c.totalPurchase)}</b>${c.due > 0 ? `<small class="bad">বাকি ${money(c.due)}</small>` : ''}</div></button>`).join('');
}

export function openCustomerForm(ctx, id) {
  const { S } = ctx;
  const c = id ? S.customers.find((x) => x.id === id) : null;
  const d = c || {};
  openSheet({
    title: c ? `এডিট · ${c.name}` : 'নতুন কাস্টমার',
    body: `<form class="form" id="cf"><div class="grid-2">
      ${field('নাম', input('name', d.name || '', 'required'), { cls: 'span-2' })}
      ${field('ফোন', input('phone', d.phone || '', 'type="tel" inputmode="tel"'))}
      ${field('FB / Insta আইডি', input('social', d.social || ''))}
      ${field('ঠিকানা', input('address', d.address || ''), { cls: 'span-2' })}
      ${field('নোট (সাইজ, পছন্দ ইত্যাদি)', textarea('note', d.note || ''), { cls: 'span-2' })}
    </div></form>`,
    footer: `${c ? `<button class="btn ghost" data-del>${icon('trash')}মুছুন</button>` : ''}<button class="btn primary" data-save>সেভ করুন</button>`,
    onMount: (el, close) => {
      el.querySelector('[data-save]').addEventListener('click', () => {
        const f = readForm(el.querySelector('#cf'));
        if (!f.name) return toast('নাম দিন', 'err');
        if (!c && f.phone && S.customers.some((x) => x.phone && x.phone === f.phone)) toast('এই ফোন নম্বরে আগেই কাস্টমার আছে', 'err');
        const code = c ? c.code : nextCode('CUST', S.customers.map((x) => x.code));
        store.save('customers', { ...(c || {}), id: c ? c.id : code, code, ...f });
        close(); toast('কাস্টমার সেভ হয়েছে');
      });
      el.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (S.sales.some((o) => o.customerId === c.id)) return toast('এই কাস্টমারের অর্ডার আছে, মোছা যাবে না', 'err');
        if (await confirmBox(`${c.name} কে মুছবেন?`)) { store.remove('customers', c.id); close(); }
      });
    },
  });
}

export function openCustomerDetail(ctx, id) {
  const draw = () => {
    const C = ctx.getC();
    const c = C.customers.find((x) => x.id === id);
    if (!c) return '<p>পাওয়া যায়নি</p>';
    const orders = C.orders.filter((o) => o.customerId === id).sort(byDateDesc);
    return `<div class="detail-head"><div class="avatar">${initials(c.name)}</div><div class="grow"><b>${esc(c.name)}</b><div class="muted">${esc(c.code)} · ${esc(c.address || '')}</div>${c.note ? `<div class="hint">${esc(c.note)}</div>` : ''}</div></div>
      <div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><span>মোট কেনা</span><b>${money(c.totalPurchase)}</b></div><div class="kpi"><span>অর্ডার</span><b>${c.orders}</b></div><div class="kpi ${c.due > 0 ? 'alert' : ''}"><span>বাকি</span><b>${money(c.due)}</b></div></div>
      <div class="actions">
        ${c.phone ? `<a class="btn ghost sm" href="tel:${esc(c.phone)}">${icon('phone')}কল</a><a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/${waNumber(c.phone)}${c.due > 0 ? '?text=' + encodeURIComponent(`আসসালামু আলাইকুম ${c.name}, ${ctx.S.settings.name} থেকে বলছি। আপনার ${money(c.due)} বাকি আছে। সুবিধামতো পরিশোধ করলে কৃতজ্ঞ থাকব।`) : ''}">${icon('chat')}WhatsApp</a>` : ''}
        ${c.due > 0 ? `<button class="btn primary sm" data-collect>${icon('money')}বাকি আদায়</button>` : ''}
        <button class="btn ghost sm" data-order>${icon('plus')}নতুন অর্ডার</button>
        <button class="btn ghost sm" data-edit>${icon('edit')}এডিট</button>
      </div>
      <h3 style="margin:16px 0 8px;font-size:16px">অর্ডারসমূহ</h3>
      <div class="list">${orders.map((o) => `<button class="item" data-order-open="${esc(o.id)}"><div class="main-col"><div class="t">${esc(o.code)} ${statusPill(o.status)}</div><div class="s">${fmtDate(o.date)} · ${num(o.qty)} পিস</div></div><div class="r"><b>${money(o.total)}</b>${o.due > 0 ? `<small class="bad">বাকি ${money(o.due)}</small>` : ''}</div></button>`).join('') || '<p class="muted">কোনো অর্ডার নেই</p>'}</div>`;
  };
  openSheet({
    title: 'কাস্টমার', wide: true, body: `<div data-d>${draw()}</div>`,
    onMount: (el, close) => {
      const box = el.querySelector('[data-d]');
      const off = store.onData(() => setTimeout(() => { box.innerHTML = draw(); }, 0));
      el.closest('.sheet-wrap').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', off));
      box.addEventListener('click', (e) => {
        const oo = e.target.closest('[data-order-open]');
        if (oo) return openOrderDetail(ctx, oo.dataset.orderOpen);
        if (e.target.closest('[data-collect]')) return collectDue(ctx, id);
        if (e.target.closest('[data-order]')) { off(); close(); setTimeout(() => openOrderForm(ctx, null, { customerId: id }), 300); return; }
        if (e.target.closest('[data-edit]')) openCustomerForm(ctx, id);
      });
    },
  });
}

// পুরোনো অর্ডার থেকে শুরু করে বাকি টাকা ভাগ করে বসায়
function collectDue(ctx, customerId) {
  const C = ctx.getC();
  const c = C.customers.find((x) => x.id === customerId);
  const L = ctx.S.settings.lists;
  openSheet({
    title: `বাকি আদায় · ${c.name}`,
    body: `<form class="form" id="col"><div class="grid-2">${field('টাকা', input('amount', c.due, 'type="number" min="0" step="any"'))}${field('মাধ্যম', select('method', L.payMethods, L.payMethods[0]))}${field('তারিখ', input('date', today(), 'type="date"'), { cls: 'span-2' })}</div><p class="hint">মোট বাকি ${money(c.due)} — পুরোনো অর্ডার থেকে ক্রমানুসারে বসানো হবে।</p></form>`,
    footer: '<button class="btn primary" data-save>আদায় সেভ করুন</button>',
    onMount: (el, close) => {
      el.querySelector('[data-save]').addEventListener('click', () => {
        const f = readForm(el.querySelector('#col'));
        let left = toNum(f.amount);
        if (!(left > 0)) return toast('টাকা লিখুন', 'err');
        const dueOrders = C.orders.filter((o) => o.customerId === customerId && o.due > 0).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        for (const o of dueOrders) {
          if (left <= 0) break;
          const amt = Math.min(left, o.due);
          const raw = ctx.S.sales.find((x) => x.id === o.id);
          store.save('sales', { ...raw, payments: [...(raw.payments || []), { id: uid(), date: f.date, amount: amt, method: f.method, note: 'বাকি আদায়' }] });
          left -= amt;
        }
        close(); toast(`${money(toNum(f.amount) - left)} আদায় হয়েছে`);
        if (left > 0) toast(`${money(left)} অতিরিক্ত — কোনো বাকি অর্ডারে বসানো হয়নি`, 'err');
      });
    },
  });
}

// ======================= সাপ্লায়ার =======================
export const suppliers = {
  title: 'সাপ্লায়ার',
  render({ C }) {
    if (!C.suppliers.length) return `<div class="toolbar"><span style="flex:1"></span><button class="btn primary" data-new>${icon('plus')}নতুন সাপ্লায়ার</button></div>${empty('কোনো সাপ্লায়ার নেই', 'যাদের কাছ থেকে মাল কেনেন তাদের যোগ করুন।')}`;
    return `<div class="toolbar"><span style="flex:1"></span><button class="btn primary" data-new>${icon('plus')}নতুন সাপ্লায়ার</button></div>
      <div class="list">${C.suppliers.sort((a, b) => b.total - a.total).map((s) => `<button class="item" data-open="${esc(s.id)}"><div class="avatar accent">${initials(s.name)}</div>
      <div class="main-col"><div class="t">${esc(s.name)}</div><div class="s">${esc(s.phone || '')} · ${s.purchases} বার কেনা${s.lastDate ? ' · শেষ ' + fmtDate(s.lastDate) : ''}</div></div>
      <div class="r"><b>${money(s.total)}</b>${s.due > 0 ? `<small class="bad">দেনা ${money(s.due)}</small>` : ''}</div></button>`).join('')}</div>`;
  },
  mount(root, ctx) {
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-new]')) return openSupplierForm(ctx);
      const it = e.target.closest('[data-open]');
      if (it) openSupplierForm(ctx, it.dataset.open);
    });
  },
};
function openSupplierForm(ctx, id) {
  const { S } = ctx;
  const s = id ? S.suppliers.find((x) => x.id === id) : null;
  const comp = id ? ctx.C.suppliers.find((x) => x.id === id) : null;
  const d = s || {};
  const L = S.settings.lists;
  openSheet({
    title: s ? s.name : 'নতুন সাপ্লায়ার', wide: !!s,
    body: `<form class="form" id="sf"><div class="grid-2">
      ${field('নাম', input('name', d.name || ''), { cls: 'span-2' })}${field('ফোন', input('phone', d.phone || '', 'type="tel"'))}${field('ঠিকানা / মার্কেট', input('address', d.address || ''))}
      ${field('নোট', textarea('note', d.note || ''), { cls: 'span-2' })}</div>
      ${comp ? `<div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><span>মোট কেনা</span><b>${money(comp.total)}</b></div><div class="kpi"><span>পরিশোধ</span><b>${money(comp.paid)}</b></div><div class="kpi ${comp.due > 0 ? 'alert' : ''}"><span>দেনা</span><b>${money(comp.due)}</b></div></div>
      ${comp.due > 0 ? `<div class="grid-3" style="align-items:end">${field('পরিশোধ করুন', input('payAmt', comp.due, 'type="number" min="0"'))}${field('মাধ্যম', select('payMethod', L.payMethods, L.payMethods[0]))}<button type="button" class="btn primary" data-pay>পরিশোধ</button></div>` : ''}
      <div class="list">${ctx.C.purchases.filter((p) => p.supplierId === id).sort(byDateDesc).map((p) => `<button type="button" class="item" data-po="${esc(p.id)}"><div class="main-col"><div class="t">${esc(p.code)}</div><div class="s">${fmtDate(p.date)} · ${num(p.qty)} পিস</div></div><div class="r"><b>${money(p.total)}</b>${p.due > 0 ? `<small class="bad">বাকি ${money(p.due)}</small>` : ''}</div></button>`).join('')}</div>` : ''}
    </form>`,
    footer: `${s ? `<button class="btn ghost" data-newpo>${icon('plus')}ক্রয়</button>` : ''}<button class="btn primary" data-save>সেভ করুন</button>`,
    onMount: (el, close) => {
      const form = el.querySelector('#sf');
      el.querySelector('[data-save]').addEventListener('click', () => {
        const f = readForm(form);
        if (!f.name) return toast('নাম দিন', 'err');
        const code = s ? s.code : nextCode('SUP', S.suppliers.map((x) => x.code));
        store.save('suppliers', { ...(s || {}), id: s ? s.id : code, code, name: f.name, phone: f.phone, address: f.address, note: f.note });
        close(); toast('সেভ হয়েছে');
      });
      el.querySelector('[data-newpo]')?.addEventListener('click', () => { close(); setTimeout(() => openPurchaseForm(ctx, null, { supplierId: id }), 300); });
      form.addEventListener('click', (e) => {
        const po = e.target.closest('[data-po]');
        if (po) { close(); setTimeout(() => openPurchaseForm(ctx, po.dataset.po), 300); }
        if (e.target.closest('[data-pay]')) {
          let left = toNum(form.querySelector('[name=payAmt]').value);
          const method = form.querySelector('[name=payMethod]').value;
          const dues = ctx.C.purchases.filter((p) => p.supplierId === id && p.due > 0).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
          for (const p of dues) {
            if (left <= 0) break;
            const amt = Math.min(left, p.due);
            const raw = S.purchases.find((x) => x.id === p.id);
            store.save('purchases', { ...raw, payments: [...(raw.payments || []), { id: uid(), date: today(), amount: amt, method }] });
            left -= amt;
          }
          close(); toast('পরিশোধ সেভ হয়েছে');
        }
      });
    },
  });
}
