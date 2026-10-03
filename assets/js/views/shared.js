import { esc, money, num, toNum } from '../core/utils.js';
import { STATUS_BN } from '../core/calc.js';
import { pill, icon } from '../ui/components.js';

export const statusTone = { Pending: 'warn', Confirmed: 'brand', Shipped: 'brand', Delivered: 'good', Returned: 'bad', Cancelled: '' };
export const statusPill = (s) => pill(STATUS_BN[s] || s, statusTone[s]);
export const initials = (name) => esc(String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase());

// ভ্যারিয়েন্ট ড্রপডাউন — প্রোডাক্ট অনুযায়ী গ্রুপ করা, স্টক দেখায়
export function variantOptions(C, S, selected, { showStock = true } = {}) {
  const byProduct = {};
  for (const v of S.variants) (byProduct[v.productId] ||= []).push(v);
  let html = '<option value="">— পণ্য বাছাই করুন —</option>';
  const prods = [...S.products].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  for (const p of prods) {
    const vs = (byProduct[p.id] || []).sort((a, b) => String(a.code).localeCompare(String(b.code)));
    if (!vs.length) continue;
    html += `<optgroup label="${esc(p.name)}">`;
    for (const v of vs) {
      const inv = C.invById[v.id];
      const stock = showStock && inv ? ` · স্টক ${num(inv.available)}` : '';
      html += `<option value="${esc(v.id)}" data-price="${toNum(v.price)}" data-cost="${toNum(v.cost)}" ${v.id === selected ? 'selected' : ''}>${esc(p.name)} — ${esc([v.size, v.color].filter(Boolean).join(' / '))}${stock}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

export function searchBox(id, value, placeholder) {
  return `<div class="search">${icon('search')}<input id="${id}" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off"></div>`;
}

export const moneyCell = (v, cls = '') => `<td class="n ${cls}">${money(v)}</td>`;

export function csvDownload(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(filename, '\ufeff' + csv, 'text/csv;charset=utf-8');
}
export function downloadBlob(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// লাইন-আইটেম এডিটর (অর্ডার ও ক্রয় দুই জায়গায়)
export function lineRow(C, S, item = {}, mode = 'sale') {
  const priceKey = mode === 'sale' ? 'price' : 'cost';
  return `<div class="line" data-row>
    <label class="field"><span class="field-label">পণ্য</span><select data-k="variantId">${variantOptions(C, S, item.variantId)}</select></label>
    <label class="field"><span class="field-label">পরিমাণ</span><input data-k="qty" type="number" inputmode="numeric" min="1" step="1" value="${esc(item.qty ?? 1)}"></label>
    <label class="field"><span class="field-label">${mode === 'sale' ? 'দাম (প্রতি পিস)' : 'কেনা দাম'}</span><input data-k="${priceKey}" type="number" inputmode="decimal" min="0" step="any" value="${esc(item[priceKey] ?? '')}"></label>
    <button type="button" class="icon-btn" data-del-line aria-label="সারি মুছুন">${icon('trash')}</button>
  </div>`;
}
export function readLines(root, mode = 'sale') {
  const priceKey = mode === 'sale' ? 'price' : 'cost';
  return [...root.querySelectorAll('[data-row]')].map((r) => ({
    variantId: r.querySelector('[data-k=variantId]').value,
    qty: toNum(r.querySelector('[data-k=qty]').value),
    [priceKey]: toNum(r.querySelector(`[data-k=${priceKey}]`).value),
  })).filter((l) => l.variantId && l.qty > 0);
}
export function bindLines(root, C, S, mode, onChange) {
  const box = root.querySelector('[data-lines]');
  const priceKey = mode === 'sale' ? 'price' : 'cost';
  root.querySelector('[data-add-line]').addEventListener('click', () => {
    box.insertAdjacentHTML('beforeend', lineRow(C, S, { qty: 1 }, mode));
    onChange();
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-line]');
    if (b) { b.closest('[data-row]').remove(); onChange(); }
  });
  box.addEventListener('change', (e) => {
    if (e.target.matches('[data-k=variantId]')) {
      const o = e.target.selectedOptions[0];
      const inp = e.target.closest('[data-row]').querySelector(`[data-k=${priceKey}]`);
      if (o && o.dataset[priceKey] !== undefined) inp.value = o.dataset[priceKey];
    }
    onChange();
  });
  box.addEventListener('input', onChange);
}
