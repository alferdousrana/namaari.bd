import { esc, money, num, toNum, today, fmtDate, nextCode, uid, byDateDesc, waNumber, sum } from '../core/utils.js';
import { STATUSES, STATUS_BN, orderTotal, orderSubtotal } from '../core/calc.js';
import * as store from '../core/store.js';
import { icon, openSheet, toast, confirmBox, field, input, select, textarea, readForm, empty, options } from '../ui/components.js';
import { statusPill, searchBox, lineRow, readLines, bindLines, initials } from './shared.js';

let filter = { q: '', status: 'all' };

export const title = 'অর্ডার ও বিক্রি';
export function render({ C }) {
  const counts = {};
  for (const o of C.orders) counts[o.status] = (counts[o.status] || 0) + 1;
  const chips = [['all', 'সব', C.orders.length], ['due', 'বাকি আছে', C.orders.filter((o) => o.due > 0).length], ...STATUSES.map((s) => [s, STATUS_BN[s], counts[s] || 0])]
    .map(([k, l, n]) => `<button class="chip ${filter.status === k ? 'on' : ''}" data-status="${k}">${esc(l)}<span class="count">${n}</span></button>`).join('');
  return `
    <div class="toolbar">
      ${searchBox('q-sales', filter.q, 'অর্ডার, কাস্টমার, ফোন বা পণ্য খুঁজুন')}
      <button class="btn primary" data-new>${icon('plus')}নতুন অর্ডার</button>
    </div>
    <div class="chips" role="tablist">${chips}</div>
    <div class="section list" id="sales-list">${listHtml(C)}</div>`;
}
function listHtml(C) {
  const q = filter.q.toLowerCase();
  const rows = C.orders.filter((o) => {
    if (filter.status === 'due' && !(o.due > 0)) return false;
    if (filter.status !== 'all' && filter.status !== 'due' && o.status !== filter.status) return false;
    if (!q) return true;
    const c = C.customerById[o.customerId] || {};
    const hay = [o.code, c.name, c.phone, o.tracking, ...(o.items || []).map((i) => C.variantLabel(i.variantId))].join(' ').toLowerCase();
    return hay.includes(q);
  }).sort(byDateDesc);
  if (!rows.length) return empty('কোনো অর্ডার নেই', filter.q || filter.status !== 'all' ? 'ফিল্টার বদলে দেখুন।' : 'প্রথম অর্ডারটি যোগ করুন।', '<button class="btn primary" data-new>নতুন অর্ডার</button>');
  return rows.slice(0, 300).map((o) => {
    const c = C.customerById[o.customerId] || {};
    return `<button class="item" data-open="${esc(o.id)}">
      <div class="avatar">${initials(c.name)}</div>
      <div class="main-col">
        <div class="t">${esc(c.name || 'ওয়াক-ইন')} ${statusPill(o.status)}</div>
        <div class="s">${esc(o.code)} · ${fmtDate(o.date)} · ${num(o.qty)} পিস · ${esc(o.channel || '')}</div>
      </div>
      <div class="r"><b>${money(o.total)}</b>${o.due > 0 ? `<small class="bad">বাকি ${money(o.due)}</small>` : o.revenue ? '<small class="good">পরিশোধিত</small>' : ''}</div>
    </button>`;
  }).join('');
}
export function mount(root, ctx) {
  const { C } = ctx;
  root.querySelector('#q-sales').addEventListener('input', (e) => { filter.q = e.target.value; root.querySelector('#sales-list').innerHTML = listHtml(C); });
  root.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (chip) { filter.status = chip.dataset.status; ctx.rerender(); return; }
    if (e.target.closest('[data-new]')) return openOrderForm(ctx);
    const it = e.target.closest('[data-open]');
    if (it) openOrderDetail(ctx, it.dataset.open);
  });
}

// ================= অর্ডার ফর্ম =================
export function openOrderForm(ctx, orderId, preset = {}) {
  const { S, C } = ctx;
  const st = S.settings;
  const o = orderId ? S.sales.find((x) => x.id === orderId) : null;
  const isNew = !o;
  const d = o || { date: today(), channel: st.lists.channels[0], status: 'Confirmed', items: [{ qty: 1 }], discount: 0, delivery: 0, customerId: preset.customerId || '' };
  const custOpts = [...S.customers].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ' · ' + c.phone : ''}` }));
  const body = `<form class="form" id="order-form" novalidate>
    <div class="grid-2">
      ${field('কাস্টমার', `<select name="customerId">${options([{ value: '', label: 'ওয়াক-ইন / নাম ছাড়া' }, { value: '__new', label: '＋ নতুন কাস্টমার' }, ...custOpts], d.customerId)}</select>`, { cls: 'span-2' })}
      <div class="span-2 grid-2" data-newcust hidden>
        ${field('নাম', input('nc_name', '', 'autocomplete="off"'))}
        ${field('ফোন', input('nc_phone', '', 'type="tel" inputmode="tel"'))}
        ${field('ঠিকানা', input('nc_address'), { cls: 'span-2' })}
      </div>
      ${field('তারিখ', input('date', d.date, 'type="date" required'))}
      ${field('চ্যানেল', select('channel', st.lists.channels, d.channel))}
      ${field('স্ট্যাটাস', `<select name="status">${options(STATUSES.map((s) => ({ value: s, label: STATUS_BN[s] })), d.status)}</select>`, { cls: 'span-2' })}
    </div>
    <div>
      <div class="panel-head"><h3>পণ্য</h3><button type="button" class="btn sm ghost" data-add-line>${icon('plus')}আরেকটি</button></div>
      <div class="lines" data-lines>${(d.items || []).map((i) => lineRow(C, S, i, 'sale')).join('')}</div>
      <p class="hint" data-stockwarn></p>
    </div>
    <div class="grid-2">
      ${field('ছাড় (৳)', input('discount', d.discount || '', 'type="number" inputmode="decimal" min="0" step="any"'))}
      ${field('ডেলিভারি চার্জ (৳)', input('delivery', d.delivery || '', 'type="number" inputmode="decimal" min="0" step="any"'), { hint: 'কাস্টমার যা দেবে' })}
    </div>
    ${isNew ? `<div class="grid-2">
      ${field('এখন পেমেন্ট পেয়েছি (৳)', input('paidNow', '', 'type="number" inputmode="decimal" min="0" step="any"'))}
      ${field('পেমেন্ট মাধ্যম', select('payMethod', st.lists.payMethods, st.lists.payMethods[0]))}
    </div>` : ''}
    <div class="grid-2">
      ${field('কুরিয়ার', select('courier', st.lists.couriers, d.courier, '', '—'))}
      ${field('ট্র্যাকিং / কনসাইনমেন্ট নং', input('tracking', d.tracking || ''))}
    </div>
    ${field('নোট', textarea('note', d.note || ''))}
    <div class="totals" data-totals></div>
  </form>`;
  openSheet({
    title: isNew ? 'নতুন অর্ডার' : `অর্ডার এডিট · ${o.code}`, body, wide: true,
    footer: `<button class="btn ghost" data-close>বাতিল</button><button class="btn primary" data-save>${isNew ? 'অর্ডার সেভ করুন' : 'পরিবর্তন সেভ করুন'}</button>`,
    onMount: (el, close) => {
      const form = el.querySelector('#order-form');
      const custSel = form.querySelector('[name=customerId]');
      const toggleNew = () => { form.querySelector('[data-newcust]').hidden = custSel.value !== '__new'; };
      custSel.addEventListener('change', toggleNew); toggleNew();
      const recalc = () => {
        const items = readLines(form, 'sale');
        const f = readForm(form);
        const tmp = { items, discount: f.discount, delivery: f.delivery };
        const sub = orderSubtotal(tmp), tot = orderTotal(tmp);
        const paid = isNew ? toNum(f.paidNow) : sum(o.payments || [], (p) => p.amount);
        form.querySelector('[data-totals]').innerHTML = `
          <div><span>সাবটোটাল</span><b class="num">${money(sub)}</b></div>
          ${toNum(f.discount) ? `<div><span>ছাড়</span><b class="num">-${money(f.discount)}</b></div>` : ''}
          ${toNum(f.delivery) ? `<div><span>ডেলিভারি</span><b class="num">${money(f.delivery)}</b></div>` : ''}
          <div class="grand"><span>মোট</span><b class="num">${money(tot)}</b></div>
          <div><span>বাকি থাকবে</span><b class="num ${tot - paid > 0 ? 'bad' : ''}">${money(tot - paid)}</b></div>`;
        const warn = items.filter((i) => {
          const inv = C.invById[i.variantId];
          const already = o ? sum((o.items || []).filter((x) => x.variantId === i.variantId), (x) => x.qty) : 0;
          return inv && i.qty > inv.available + already;
        }).map((i) => C.variantLabel(i.variantId));
        form.querySelector('[data-stockwarn]').innerHTML = warn.length ? `<span class="bad">স্টকে কম আছে: ${esc(warn.join(', '))}</span>` : '';
      };
      bindLines(form, C, S, 'sale', recalc);
      form.addEventListener('input', recalc);
      recalc();
      el.querySelector('[data-save]').addEventListener('click', () => {
        const f = readForm(form);
        const items = readLines(form, 'sale').map((i) => {
          const prev = o && (o.items || []).find((x) => x.variantId === i.variantId);
          return { ...i, cost: prev ? toNum(prev.cost) : toNum(C.variantById[i.variantId]?.cost) };
        });
        if (!items.length) return toast('অন্তত একটি পণ্য যোগ করুন', 'err');
        if (!f.date) return toast('তারিখ দিন', 'err');
        let customerId = f.customerId;
        if (customerId === '__new') {
          if (!f.nc_name) return toast('নতুন কাস্টমারের নাম দিন', 'err');
          const code = nextCode('CUST', S.customers.map((c) => c.code));
          store.save('customers', { id: code, code, name: f.nc_name, phone: f.nc_phone, address: f.nc_address, social: '', note: '' });
          customerId = code;
        }
        const code = o ? o.code : nextCode('SO', S.sales.map((x) => x.code), 4);
        const payments = o ? (o.payments || []) : (toNum(f.paidNow) > 0 ? [{ id: uid(), date: f.date, amount: toNum(f.paidNow), method: f.payMethod }] : []);
        const saved = store.save('sales', {
          ...(o || {}), id: o ? o.id : code, code, date: f.date, customerId, channel: f.channel, status: f.status,
          items, discount: toNum(f.discount), delivery: toNum(f.delivery), payments, courier: f.courier, tracking: f.tracking, note: f.note,
        });
        close();
        toast(isNew ? `অর্ডার ${code} সেভ হয়েছে` : 'পরিবর্তন সেভ হয়েছে');
        if (isNew) setTimeout(() => openOrderDetail(ctx, saved.id), 320);
      });
    },
  });
}

// ================= অর্ডার ডিটেইল =================
export function openOrderDetail(ctx, id) {
  const { S } = ctx;
  const st = S.settings;
  const draw = () => {
    const C = ctx.getC();
    const o = C.orderById[id];
    if (!o) return '<p>অর্ডারটি পাওয়া যায়নি।</p>';
    const c = C.customerById[o.customerId] || {};
    return `
      <div class="detail-head">
        <div class="avatar">${initials(c.name)}</div>
        <div class="grow"><b>${esc(c.name || 'ওয়াক-ইন')}</b><div class="muted">${esc(c.phone || '')} ${c.address ? '· ' + esc(c.address) : ''}</div></div>
        ${statusPill(o.status)}
      </div>
      <div class="chips" style="margin-bottom:12px">${STATUSES.map((s) => `<button class="chip ${o.status === s ? 'on' : ''}" data-setstatus="${s}">${STATUS_BN[s]}</button>`).join('')}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>পণ্য</th><th class="n">পরিমাণ</th><th class="n">দাম</th><th class="n">মোট</th></tr></thead>
        <tbody>${(o.items || []).map((i) => `<tr><td>${esc(C.variantLabel(i.variantId))}</td><td class="n">${num(i.qty)}</td><td class="n">${money(i.price)}</td><td class="n">${money(i.qty * i.price)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="stat-lines" style="margin-top:10px">
        <div><span>সাবটোটাল</span><b>${money(o.subtotal)}</b></div>
        ${o.discount ? `<div><span>ছাড়</span><b>-${money(o.discount)}</b></div>` : ''}
        ${o.delivery ? `<div><span>ডেলিভারি চার্জ</span><b>${money(o.delivery)}</b></div>` : ''}
        <div class="total"><span>মোট</span><b>${money(o.total)}</b></div>
        <div><span>পরিশোধ</span><b class="good">${money(o.paid)}</b></div>
        <div><span>${o.revenue ? 'বাকি' : 'অ্যাডভান্স'}</span><b class="${o.due > 0 ? 'bad' : ''}">${money(o.revenue ? o.due : o.advance)}</b></div>
        <div><span>লাভ (খরচ বাদে)</span><b>${money(o.profit)}</b></div>
      </div>
      <h3 style="margin:16px 0 8px;font-size:16px">পেমেন্ট</h3>
      <div class="list">${(o.payments || []).length ? o.payments.map((p) => `<div class="item" style="cursor:default"><div class="main-col"><div class="t">${money(p.amount)}</div><div class="s">${fmtDate(p.date)} · ${esc(p.method || '')}${p.note ? ' · ' + esc(p.note) : ''}</div></div><button class="icon-btn" data-delpay="${esc(p.id)}" aria-label="পেমেন্ট মুছুন">${icon('trash')}</button></div>`).join('') : '<p class="muted">এখনো কোনো পেমেন্ট নেই।</p>'}</div>
      <form class="grid-3" data-payform style="margin-top:10px;align-items:end">
        ${field('টাকা', input('amount', o.due > 0 ? o.due : '', 'type="number" inputmode="decimal" min="0" step="any"'))}
        ${field('মাধ্যম', select('method', st.lists.payMethods, st.lists.payMethods[0]))}
        <button class="btn primary" type="submit">${icon('plus')}পেমেন্ট যোগ</button>
      </form>
      <dl class="kv" style="margin-top:14px">
        <dt>অর্ডার নং</dt><dd>${esc(o.code)}</dd><dt>তারিখ</dt><dd>${fmtDate(o.date)}</dd><dt>চ্যানেল</dt><dd>${esc(o.channel || '—')}</dd>
        ${o.courier ? `<dt>কুরিয়ার</dt><dd>${esc(o.courier)} ${esc(o.tracking || '')}</dd>` : ''}
        ${o.note ? `<dt>নোট</dt><dd>${esc(o.note)}</dd>` : ''}
      </dl>
      <div class="actions">
        <button class="btn ghost sm" data-edit>${icon('edit')}এডিট</button>
        <button class="btn ghost sm" data-print>${icon('printer')}ইনভয়েস</button>
        ${c.phone ? `<a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(invoiceText(C, o, st))}">${icon('chat')}WhatsApp</a>` : ''}
        <button class="btn ghost sm" data-copy>${icon('receipt')}মেসেজ কপি</button>
        <button class="btn ghost sm bad" data-delete>${icon('trash')}মুছুন</button>
      </div>`;
  };
  openSheet({
    title: `অর্ডার ${S.sales.find((x) => x.id === id)?.code || ''}`, body: `<div data-detail>${draw()}</div>`, wide: true,
    onMount: (el, close) => {
      const box = el.querySelector('[data-detail]');
      const refresh = () => { box.innerHTML = draw(); };
      const off = store.onData(() => setTimeout(refresh, 0));
      el.closest('.sheet-wrap').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', off));
      const cur = () => ctx.S.sales.find((x) => x.id === id);
      box.addEventListener('click', async (e) => {
        const o = cur(); if (!o) return;
        const s = e.target.closest('[data-setstatus]');
        if (s) { store.save('sales', { ...o, status: s.dataset.setstatus }); toast(`স্ট্যাটাস: ${STATUS_BN[s.dataset.setstatus]}`); return; }
        const dp = e.target.closest('[data-delpay]');
        if (dp) { if (await confirmBox('এই পেমেন্টটি মুছবেন?')) store.save('sales', { ...o, payments: (o.payments || []).filter((p) => p.id !== dp.dataset.delpay) }); return; }
        if (e.target.closest('[data-edit]')) { off(); close(); setTimeout(() => openOrderForm(ctx, id), 300); return; }
        if (e.target.closest('[data-print]')) return printInvoice(ctx.getC(), ctx.getC().orderById[id], st);
        if (e.target.closest('[data-copy]')) { await navigator.clipboard?.writeText(invoiceText(ctx.getC(), ctx.getC().orderById[id], st)); toast('মেসেজ কপি হয়েছে'); return; }
        if (e.target.closest('[data-delete]')) {
          if (await confirmBox(`অর্ডার ${o.code} পুরোপুরি মুছে ফেলবেন? স্টক ও হিসাব আপডেট হবে।`)) { store.remove('sales', id); off(); close(); toast('অর্ডার মুছে ফেলা হয়েছে'); }
        }
      });
      box.addEventListener('submit', (e) => {
        e.preventDefault();
        const o = cur(); const f = readForm(e.target);
        if (!(toNum(f.amount) > 0)) return toast('টাকার পরিমাণ দিন', 'err');
        store.save('sales', { ...o, payments: [...(o.payments || []), { id: uid(), date: today(), amount: toNum(f.amount), method: f.method }] });
        toast(`${money(f.amount)} পেমেন্ট যোগ হয়েছে`);
      });
    },
  });
}

export function invoiceText(C, o, st) {
  const c = C.customerById[o.customerId] || {};
  const lines = (o.items || []).map((i) => `• ${C.variantLabel(i.variantId)} × ${i.qty} = ${money(i.qty * i.price)}`).join('\n');
  return `*${st.name}* — অর্ডার ${o.code}\n${c.name ? 'প্রিয় ' + c.name + ',\n' : ''}${fmtDate(o.date)}\n\n${lines}\n` +
    `${o.discount ? `ছাড়: -${money(o.discount)}\n` : ''}${o.delivery ? `ডেলিভারি: ${money(o.delivery)}\n` : ''}` +
    `মোট: ${money(o.total)}\nপরিশোধ: ${money(o.paid)}\n${o.total - o.paid > 0 ? `বাকি: ${money(o.total - o.paid)}\n` : ''}` +
    `${o.courier ? `\nকুরিয়ার: ${o.courier} ${o.tracking || ''}\n` : ''}\n${st.invoiceNote || ''}`;
}

export function printInvoice(C, o, st) {
  const c = C.customerById[o.customerId] || {};
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="inv-head"><div><h1>${esc(st.name)}</h1><div>${esc(st.address || '')}</div><div>${esc(st.phone || '')}</div></div>
    <div style="text-align:right"><b>ইনভয়েস ${esc(o.code)}</b><div>${fmtDate(o.date)}</div></div></div>
    <p><b>কাস্টমার:</b> ${esc(c.name || 'ওয়াক-ইন')} ${esc(c.phone || '')}<br>${esc(c.address || '')}</p>
    <table style="margin-top:10px"><thead><tr><th>পণ্য</th><th class="n">পরিমাণ</th><th class="n">দাম</th><th class="n">মোট</th></tr></thead>
    <tbody>${(o.items || []).map((i) => `<tr><td>${esc(C.variantLabel(i.variantId))}</td><td class="n">${num(i.qty)}</td><td class="n">${money(i.price)}</td><td class="n">${money(i.qty * i.price)}</td></tr>`).join('')}</tbody></table>
    <div class="stat-lines" style="max-width:280px;margin:12px 0 0 auto">
      <div><span>সাবটোটাল</span><b>${money(o.subtotal)}</b></div>
      ${o.discount ? `<div><span>ছাড়</span><b>-${money(o.discount)}</b></div>` : ''}
      ${o.delivery ? `<div><span>ডেলিভারি</span><b>${money(o.delivery)}</b></div>` : ''}
      <div class="total"><span>মোট</span><b>${money(o.total)}</b></div>
      <div><span>পরিশোধ</span><b>${money(o.paid)}</b></div>
      <div><span>বাকি</span><b>${money(o.total - o.paid)}</b></div>
    </div>
    <p style="margin-top:24px;text-align:center">${esc(st.invoiceNote || '')}</p>`;
  window.print();
}
