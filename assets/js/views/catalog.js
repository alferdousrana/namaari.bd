import { esc, money, num, toNum, today, fmtDate, nextCode, sum } from '../core/utils.js';
import * as store from '../core/store.js';
import { icon, openSheet, toast, confirmBox, field, input, select, textarea, readForm, empty, options, pill } from '../ui/components.js';
import { searchBox, variantOptions, csvDownload } from './shared.js';

// ======================= পণ্য =======================
let pq = '';
export const products = {
  title: 'পণ্য ও ডিজাইন',
  render({ C, S }) {
    return `<div class="toolbar">${searchBox('q-prod', pq, 'পণ্যের নাম বা ক্যাটাগরি')}<button class="btn primary" data-new>${icon('plus')}নতুন পণ্য</button></div>
      <div class="list" id="prod-list">${prodList(C, S)}</div>`;
  },
  mount(root, ctx) {
    root.querySelector('#q-prod').addEventListener('input', (e) => { pq = e.target.value; root.querySelector('#prod-list').innerHTML = prodList(ctx.C, ctx.S); });
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-new]')) return openProductForm(ctx);
      const it = e.target.closest('[data-open]');
      if (it) openProductDetail(ctx, it.dataset.open);
    });
  },
};
function prodList(C, S) {
  const q = pq.toLowerCase();
  const rows = S.products.filter((p) => !q || `${p.name} ${p.category} ${p.code}`.toLowerCase().includes(q)).sort((a, b) => String(b.code).localeCompare(String(a.code)));
  if (!rows.length) return empty('কোনো পণ্য নেই', 'একটি ডিজাইন = একটি পণ্য। সাইজ ও রং একসাথে যোগ করা যাবে।', '<button class="btn primary" data-new>নতুন পণ্য</button>');
  return rows.map((p) => {
    const inv = C.inventory.filter((r) => r.productId === p.id);
    const stock = sum(inv, (r) => r.onHand);
    const low = inv.some((r) => r.level !== 'ok');
    return `<button class="item" data-open="${esc(p.id)}">
      <div class="avatar">${icon('layers')}</div>
      <div class="main-col"><div class="t">${esc(p.name)} ${low ? pill(stock <= 0 ? 'স্টক শেষ' : 'কম স্টক', stock <= 0 ? 'bad' : 'warn') : ''}</div>
      <div class="s">${esc(p.code)} · ${esc(p.category || '')} · ${inv.length} ভ্যারিয়েন্ট · ${esc(C.supplierById[p.supplierId]?.name || '')}</div></div>
      <div class="r"><b>${money(p.price)}</b><small class="muted">স্টক ${num(stock)}</small></div></button>`;
  }).join('');
}

const checkGroup = (name, list, selected = []) => `<div class="chips" style="flex-wrap:wrap">${list.map((x) => `<label class="chip ${selected.includes(x) ? 'on' : ''}"><input type="checkbox" class="sr-only" data-multi="${name}" value="${esc(x)}" ${selected.includes(x) ? 'checked' : ''}>${esc(x)}</label>`).join('')}</div>`;
const bindChecks = (root) => root.addEventListener('change', (e) => { if (e.target.dataset.multi) e.target.closest('.chip').classList.toggle('on', e.target.checked); });
const readChecks = (root, name) => [...root.querySelectorAll(`[data-multi="${name}"]:checked`)].map((i) => i.value);

function makeVariants(ctx, product, sizes, colors, opening) {
  const { S } = ctx;
  const codes = S.variants.map((v) => v.code);
  const existing = S.variants.filter((v) => v.productId === product.id);
  const out = [];
  for (const size of sizes.length ? sizes : ['']) for (const color of colors.length ? colors : ['']) {
    if (existing.some((v) => String(v.size) === size && v.color === color)) continue;
    const code = nextCode('VIR', [...codes, ...out.map((v) => v.code)], 4);
    out.push({ id: code, code, productId: product.id, size, color, sku: `${code}-${size.slice(0, 2)}-${color.slice(0, 3)}`.replace(/-+$/, ''), cost: toNum(product.cost), price: toNum(product.price), opening: toNum(opening) });
  }
  return out;
}

export function openProductForm(ctx, id) {
  const { S } = ctx;
  const L = S.settings.lists;
  const p = id ? S.products.find((x) => x.id === id) : null;
  const d = p || { category: L.categories[0] };
  openSheet({
    title: p ? `এডিট · ${p.name}` : 'নতুন পণ্য (ডিজাইন)', wide: true,
    body: `<form class="form" id="prod-form">
      <div class="grid-2">
        ${field('পণ্যের নাম', input('name', d.name || '', 'required placeholder="যেমন: VIP Ari Batik"'), { cls: 'span-2' })}
        ${field('ক্যাটাগরি', select('category', L.categories, d.category))}
        ${field('সাপ্লায়ার', select('supplierId', S.suppliers.map((s) => ({ value: s.id, label: s.name })), d.supplierId, '', '—'))}
        ${field('কেনা দাম (৳)', input('cost', d.cost ?? '', 'type="number" min="0" step="any"'))}
        ${field('বিক্রি দাম (৳)', input('price', d.price ?? '', 'type="number" min="0" step="any"'))}
      </div>
      ${p ? '<p class="hint">দাম বদলালে সব ভ্যারিয়েন্টে প্রয়োগ করতে নিচে টিক দিন।</p><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="applyAll"> সব সাইজ/রঙে নতুন দাম বসাও</label>' : `
      ${field('সাইজ (একাধিক বাছাই করা যায়)', checkGroup('size', L.sizes, []))}
      ${field('রং', checkGroup('color', L.colors, []))}
      ${field('প্রতিটি সাইজ/রঙের ওপেনিং স্টক', input('opening', 0, 'type="number" min="0" step="1"'), { hint: 'আগে থেকে হাতে থাকা মাল। নতুন কেনা হলে "ক্রয়" এ এন্ট্রি দিন।' })}`}
      ${field('নোট', textarea('note', d.note || ''))}
    </form>`,
    footer: `<button class="btn ghost" data-close>বাতিল</button><button class="btn primary" data-save>সেভ করুন</button>`,
    onMount: (el, close) => {
      const form = el.querySelector('#prod-form');
      bindChecks(form);
      el.querySelector('[data-save]').addEventListener('click', () => {
        const f = readForm(form);
        if (!f.name) return toast('পণ্যের নাম দিন', 'err');
        const code = p ? p.code : nextCode('PRD', S.products.map((x) => x.code));
        const prod = { ...(p || {}), id: p ? p.id : code, code, name: f.name, category: f.category, supplierId: f.supplierId, cost: toNum(f.cost), price: toNum(f.price), note: f.note };
        store.save('products', prod);
        if (!p) {
          const vs = makeVariants(ctx, prod, readChecks(form, 'size'), readChecks(form, 'color'), f.opening);
          if (vs.length) store.bulk(vs.map((o) => ({ c: 'variants', o })));
          toast(`${prod.name} যোগ হয়েছে · ${vs.length} ভ্যারিয়েন্ট`);
        } else {
          if (f.applyAll) store.bulk(S.variants.filter((v) => v.productId === p.id).map((v) => ({ c: 'variants', o: { ...v, cost: prod.cost, price: prod.price } })));
          toast('পণ্য আপডেট হয়েছে');
        }
        close();
      });
    },
  });
}

export function openProductDetail(ctx, id) {
  const draw = () => {
    const { S } = ctx; const C = ctx.getC();
    const p = S.products.find((x) => x.id === id);
    if (!p) return '<p>পণ্য পাওয়া যায়নি</p>';
    const inv = C.inventory.filter((r) => r.productId === id);
    const sold = C.topProducts.find((x) => x.id === id);
    return `<dl class="kv"><dt>কোড</dt><dd>${esc(p.code)}</dd><dt>ক্যাটাগরি</dt><dd>${esc(p.category)}</dd><dt>কেনা / বিক্রি</dt><dd>${money(p.cost)} / ${money(p.price)} <span class="muted">(মার্জিন ${money(p.price - p.cost)})</span></dd>
      <dt>মোট বিক্রি</dt><dd>${num(sold?.qty || 0)} পিস · ${money(sold?.amount || 0)}</dd></dl>
      <div class="panel-head" style="margin-top:14px"><h3>সাইজ / রং ও স্টক</h3><button class="btn sm ghost" data-addvar>${icon('plus')}সাইজ/রং যোগ</button></div>
      <div class="table-wrap"><table><thead><tr><th>সাইজ</th><th>রং</th><th class="n">হাতে</th><th class="n">রিজার্ভ</th><th class="n">দাম</th><th></th></tr></thead>
      <tbody>${inv.map((r) => `<tr class="click" data-var="${esc(r.id)}"><td>${esc(r.size)}</td><td>${esc(r.color)}</td><td class="n ${r.level === 'ok' ? '' : r.level === 'out' ? 'bad' : 'warn'}">${num(r.onHand)}</td><td class="n">${num(r.reserved)}</td><td class="n">${money(r.price)}</td><td>${icon('chev')}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">কোনো ভ্যারিয়েন্ট নেই</td></tr>'}</tbody></table></div>
      <div class="actions"><button class="btn ghost sm" data-edit>${icon('edit')}পণ্য এডিট</button><button class="btn ghost sm" data-del>${icon('trash')}মুছুন</button></div>`;
  };
  openSheet({
    title: ctx.S.products.find((x) => x.id === id)?.name || 'পণ্য', wide: true, body: `<div data-d>${draw()}</div>`,
    onMount: (el, close) => {
      const box = el.querySelector('[data-d]');
      const off = store.onData(() => setTimeout(() => { box.innerHTML = draw(); }, 0));
      el.closest('.sheet-wrap').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', off));
      box.addEventListener('click', async (e) => {
        const v = e.target.closest('[data-var]');
        if (v) return openVariantForm(ctx, v.dataset.var);
        if (e.target.closest('[data-edit]')) { off(); close(); setTimeout(() => openProductForm(ctx, id), 300); return; }
        if (e.target.closest('[data-addvar]')) return openAddVariants(ctx, id);
        if (e.target.closest('[data-del]')) {
          const vids = new Set(ctx.S.variants.filter((x) => x.productId === id).map((x) => x.id));
          const used = [...ctx.S.sales, ...ctx.S.purchases].some((o) => (o.items || []).some((i) => vids.has(i.variantId)));
          if (used) return toast('এই পণ্যের বিক্রি/ক্রয় আছে, তাই মোছা যাবে না', 'err');
          if (await confirmBox('পণ্য ও এর সব সাইজ/রং মুছবেন?')) {
            store.bulk([{ c: 'products', del: id }, ...[...vids].map((x) => ({ c: 'variants', del: x }))]);
            off(); close(); toast('মুছে ফেলা হয়েছে');
          }
        }
      });
    },
  });
}

function openAddVariants(ctx, productId) {
  const L = ctx.S.settings.lists;
  const p = ctx.S.products.find((x) => x.id === productId);
  openSheet({
    title: 'নতুন সাইজ / রং',
    body: `<form class="form" id="av">${field('সাইজ', checkGroup('size', L.sizes))}${field('রং', checkGroup('color', L.colors))}${field('ওপেনিং স্টক (প্রতিটি)', input('opening', 0, 'type="number" min="0"'))}</form>`,
    footer: '<button class="btn primary" data-save>যোগ করুন</button>',
    onMount: (el, close) => {
      const form = el.querySelector('#av'); bindChecks(form);
      el.querySelector('[data-save]').addEventListener('click', () => {
        const vs = makeVariants(ctx, p, readChecks(form, 'size'), readChecks(form, 'color'), readForm(form).opening);
        if (!vs.length) return toast('নতুন কোনো কম্বিনেশন নেই', 'err');
        store.bulk(vs.map((o) => ({ c: 'variants', o }))); close(); toast(`${vs.length}টি যোগ হয়েছে`);
      });
    },
  });
}

export function openVariantForm(ctx, id) {
  const { S } = ctx;
  const v = S.variants.find((x) => x.id === id);
  const L = S.settings.lists;
  openSheet({
    title: `ভ্যারিয়েন্ট ${v.code}`,
    body: `<form class="form" id="vf"><div class="grid-2">
      ${field('সাইজ', select('size', [...new Set([...L.sizes, String(v.size)])], String(v.size)))}
      ${field('রং', select('color', [...new Set([...L.colors, v.color])], v.color))}
      ${field('কেনা দাম', input('cost', v.cost, 'type="number" step="any"'))}
      ${field('বিক্রি দাম', input('price', v.price, 'type="number" step="any"'))}
      ${field('ওপেনিং স্টক', input('opening', v.opening || 0, 'type="number"'))}
      ${field('রিঅর্ডার লেভেল', input('reorder', v.reorder ?? '', 'type="number" placeholder="ডিফল্ট"'), { hint: 'এর কম হলে সতর্ক করবে' })}
      ${field('SKU', input('sku', v.sku || ''), { cls: 'span-2' })}
    </div></form>`,
    footer: `<button class="btn ghost" data-adj>${icon('box')}স্টক অ্যাডজাস্ট</button><button class="btn ghost" data-del>${icon('trash')}</button><button class="btn primary" data-save>সেভ</button>`,
    onMount: (el, close) => {
      el.querySelector('[data-save]').addEventListener('click', () => {
        const f = readForm(el.querySelector('#vf'));
        store.save('variants', { ...v, ...f, cost: toNum(f.cost), price: toNum(f.price), opening: toNum(f.opening), reorder: f.reorder === '' ? '' : toNum(f.reorder) });
        close(); toast('সেভ হয়েছে');
      });
      el.querySelector('[data-adj]').addEventListener('click', () => { close(); setTimeout(() => openAdjust(ctx, id), 300); });
      el.querySelector('[data-del]').addEventListener('click', async () => {
        const used = [...S.sales, ...S.purchases].some((o) => (o.items || []).some((i) => i.variantId === id));
        if (used) return toast('এই সাইজ/রঙের লেনদেন আছে, মোছা যাবে না', 'err');
        if (await confirmBox('এই সাইজ/রং মুছবেন?')) { store.remove('variants', id); close(); }
      });
    },
  });
}

// ======================= স্টক =======================
let inv = { q: '', lvl: 'all' };
export const inventory = {
  title: 'স্টক / ইনভেন্টরি',
  render({ C }) {
    const rows = invRows(C);
    const out = C.inventory.filter((r) => r.level === 'out').length;
    const low = C.inventory.filter((r) => r.level === 'low').length;
    return `<div class="kpis">
        <div class="kpi"><span>মোট স্টক</span><b>${num(C.kpi.totalStock)} পিস</b></div>
        <div class="kpi"><span>স্টকের মূল্য (কেনা দামে)</span><b>${money(C.bs.inventoryAtCost)}</b></div>
        <div class="kpi"><span>সম্ভাব্য বিক্রয় মূল্য</span><b>${money(sum(C.inventory, (r) => r.onHand * r.price))}</b></div>
        <div class="kpi ${out ? 'alert' : ''}"><span>স্টক শেষ / কম</span><b>${out} / ${low}</b></div>
      </div>
      <div class="toolbar section">${searchBox('q-inv', inv.q, 'পণ্য, সাইজ, রং বা SKU')}
        <button class="btn ghost" data-adjust>${icon('box')}অ্যাডজাস্ট</button><button class="btn ghost" data-csv>${icon('download')}CSV</button></div>
      <div class="chips">${[['all', 'সব'], ['low', 'কম স্টক'], ['out', 'শেষ'], ['in', 'স্টকে আছে']].map(([k, l]) => `<button class="chip ${inv.lvl === k ? 'on' : ''}" data-lvl="${k}">${l}</button>`).join('')}</div>
      <div class="section table-wrap"><table><thead><tr><th>পণ্য</th><th>সাইজ / রং</th><th class="n">ওপেনিং</th><th class="n">কেনা</th><th class="n">বিক্রি</th><th class="n">হাতে</th><th class="n">রিজার্ভ</th><th class="n">মূল্য</th></tr></thead>
      <tbody id="inv-body">${invBody(rows)}</tbody></table></div>`;
  },
  mount(root, ctx) {
    root.querySelector('#q-inv').addEventListener('input', (e) => { inv.q = e.target.value; root.querySelector('#inv-body').innerHTML = invBody(invRows(ctx.C)); });
    root.addEventListener('click', (e) => {
      const l = e.target.closest('[data-lvl]');
      if (l) { inv.lvl = l.dataset.lvl; ctx.rerender(); return; }
      if (e.target.closest('[data-adjust]')) return openAdjust(ctx);
      if (e.target.closest('[data-csv]')) return csvDownload(`namaari-stock-${today()}.csv`, [['Variant', 'Product', 'Size', 'Color', 'SKU', 'Opening', 'Purchased', 'Sold', 'Adjusted', 'On hand', 'Reserved', 'Cost', 'Value'], ...ctx.C.inventory.map((r) => [r.code, r.productName, r.size, r.color, r.sku, r.opening, r.purchased, r.sold, r.adjusted, r.onHand, r.reserved, r.cost, r.value])]);
      const row = e.target.closest('[data-var]');
      if (row) openVariantForm(ctx, row.dataset.var);
    });
  },
};
function invRows(C) {
  const q = inv.q.toLowerCase();
  return C.inventory.filter((r) => (inv.lvl === 'all' || (inv.lvl === 'in' ? r.onHand > 0 : inv.lvl === 'low' ? r.level !== 'ok' : r.level === 'out')) && (!q || `${r.productName} ${r.size} ${r.color} ${r.sku} ${r.code}`.toLowerCase().includes(q)));
}
function invBody(rows) {
  if (!rows.length) return '<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">কিছু পাওয়া যায়নি</td></tr>';
  return rows.map((r) => `<tr class="click" data-var="${esc(r.id)}"><td>${esc(r.productName)}</td><td>${esc([r.size, r.color].filter(Boolean).join(' / '))}</td><td class="n">${num(r.opening)}</td><td class="n">${num(r.purchased)}</td><td class="n">${num(r.sold)}</td>
    <td class="n"><b class="${r.level === 'out' ? 'bad' : r.level === 'low' ? 'warn' : ''}">${num(r.onHand)}</b></td><td class="n">${r.reserved ? num(r.reserved) : '—'}</td><td class="n">${money(r.value)}</td></tr>`).join('');
}

export function openAdjust(ctx, variantId = '') {
  const { S, C } = ctx;
  openSheet({
    title: 'স্টক অ্যাডজাস্টমেন্ট',
    body: `<form class="form" id="adj">
      ${field('পণ্য', `<select name="variantId">${variantOptions(C, S, variantId)}</select>`)}
      <div class="grid-2">${field('পরিমাণ (+ বা −)', input('qty', '', 'type="number" step="1" placeholder="যেমন -1"'), { hint: 'হারানো/নষ্ট হলে মাইনাস, গুনে বেশি পেলে প্লাস' })}${field('তারিখ', input('date', today(), 'type="date"'))}</div>
      ${field('কারণ', select('reason', ['নষ্ট / ড্যামেজ', 'হারিয়ে গেছে', 'স্যাম্পল / গিফট', 'গণনায় পার্থক্য', 'অন্যান্য'], ''))}
      <p class="hint">মাইনাস অ্যাডজাস্টমেন্ট কেনা দামে ক্ষতি হিসেবে লাভ-ক্ষতিতে যাবে।</p>
      ${recentAdj(ctx)}
    </form>`,
    footer: '<button class="btn primary" data-save>সেভ করুন</button>',
    onMount: (el, close) => {
      el.querySelector('[data-save]').addEventListener('click', () => {
        const f = readForm(el.querySelector('#adj'));
        if (!f.variantId || !toNum(f.qty)) return toast('পণ্য ও পরিমাণ দিন', 'err');
        store.save('adjustments', { date: f.date, variantId: f.variantId, qty: toNum(f.qty), reason: f.reason });
        close(); toast('স্টক আপডেট হয়েছে');
      });
      el.addEventListener('click', async (e) => {
        const d = e.target.closest('[data-deladj]');
        if (d && await confirmBox('এই অ্যাডজাস্টমেন্ট মুছবেন?')) { store.remove('adjustments', d.dataset.deladj); d.closest('.item').remove(); }
      });
    },
  });
}
function recentAdj(ctx) {
  const list = [...ctx.S.adjustments].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);
  if (!list.length) return '';
  return `<div><h3 style="font-size:15px;margin:6px 0">সাম্প্রতিক</h3><div class="list">${list.map((a) => `<div class="item" style="cursor:default"><div class="main-col"><div class="t">${esc(ctx.C.variantLabel(a.variantId))}</div><div class="s">${fmtDate(a.date)} · ${esc(a.reason)}</div></div><b class="${a.qty < 0 ? 'bad' : 'good'}">${a.qty > 0 ? '+' : ''}${a.qty}</b><button type="button" class="icon-btn" data-deladj="${esc(a.id)}">${icon('trash')}</button></div>`).join('')}</div></div>`;
}
