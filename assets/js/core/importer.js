// পুরোনো Namaari_Business_ERP.xlsx থেকে ডেটা নতুন সিস্টেমে আনার কনভার্টার।
// sheets = { sheetName: [[row cells], ...] }  (SheetJS: sheet_to_json(ws, {header:1, raw:true}) + cellDates:true)
import { toNum, ymd, nextCode } from './utils.js';

const norm = (s) => String(s ?? '').trim().toLowerCase();
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const sizeStr = (v) => (typeof v === 'number' ? String(v) : str(v));
const dateStr = (v) => {
  if (!v) return '';
  if (v instanceof Date) return ymd(v);
  if (typeof v === 'number') { // Excel serial
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return ymd(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const d = new Date(v);
  return isNaN(d) ? '' : ymd(d);
};

function findSheet(sheets, key) {
  const name = Object.keys(sheets).find((n) => norm(n).includes(key));
  return name ? sheets[name] : null;
}
// হেডার সারি খুঁজে বের করে, তারপর বাকি সারি {হেডার: মান} অবজেক্টে রূপান্তর করে
function table(rows, firstHeader) {
  if (!rows) return [];
  const hi = rows.findIndex((r) => r && norm(r[0]) === norm(firstHeader));
  if (hi < 0) return [];
  const heads = rows[hi].map((h) => norm(h));
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    if (!r || r[0] === null || r[0] === undefined || str(r[0]) === '') continue;
    const o = {};
    heads.forEach((h, i) => { if (h) o[h] = r[i]; });
    out.push(o);
  }
  return out;
}
const pick = (o, ...keys) => {
  for (const k of keys) {
    const hit = Object.keys(o).find((h) => h.startsWith(norm(k)));
    if (hit !== undefined && o[hit] !== undefined && o[hit] !== null && o[hit] !== '') return o[hit];
  }
  return undefined;
};

export function importWorkbook(sheets) {
  const report = [];
  const out = { settings: {}, products: [], variants: [], customers: [], suppliers: [], sales: [], purchases: [], expenses: [], ledger: [] };

  // ---- Settings ----
  const setRows = findSheet(sheets, 'settings');
  if (setRows) {
    const kv = {};
    for (const r of setRows) if (r && r[0]) kv[norm(r[0])] = r[1];
    const g = (k) => { const hit = Object.keys(kv).find((x) => x.startsWith(k)); return hit ? kv[hit] : undefined; };
    out.settings = {
      name: str(g('business name')) || 'Namaari', owner: str(g('owner')), phone: str(g('phone')), address: str(g('address')),
      startDate: dateStr(g('business start')), capital: toNum(g('starting capital')), lowStock: toNum(g('low stock') ?? 1) || 1,
    };
  }

  // ---- Lists ----
  const listRows = findSheet(sheets, 'lists');
  if (listRows) {
    const hi = listRows.findIndex((r) => r && norm(r[0]).startsWith('category'));
    if (hi >= 0) {
      const col = (i) => listRows.slice(hi + 1).map((r) => r && r[i]).filter((v) => v !== null && v !== undefined && str(v) !== '').map(sizeStr);
      out.settings.lists = { categories: col(0), sizes: col(1), colors: col(2), payMethods: col(3), channels: col(4), expenseCats: col(6) };
    }
  }

  // ---- Suppliers (নাম থেকে তৈরি) ----
  const supByName = {};
  const supplierId = (name) => {
    const n = str(name);
    if (!n) return '';
    if (!supByName[norm(n)]) {
      const code = nextCode('SUP', out.suppliers.map((s) => s.code));
      supByName[norm(n)] = code;
      out.suppliers.push({ id: code, code, name: n, phone: '', address: '', note: '' });
    }
    return supByName[norm(n)];
  };

  // ---- Products ----
  for (const r of table(findSheet(sheets, 'products'), 'Product ID')) {
    const code = str(pick(r, 'product id'));
    out.products.push({
      id: code, code, name: str(pick(r, 'product name')), category: str(pick(r, 'category')),
      cost: toNum(pick(r, 'cost')), price: toNum(pick(r, 'selling')), supplierId: supplierId(pick(r, 'supplier')), note: str(pick(r, 'note')),
    });
  }
  // ---- Variants ----
  for (const r of table(findSheet(sheets, 'variant'), 'Variant ID')) {
    const code = str(pick(r, 'variant id'));
    out.variants.push({
      id: code, code, productId: str(pick(r, 'product id')), size: sizeStr(pick(r, 'size')), color: str(pick(r, 'color')),
      sku: str(pick(r, 'sku')), cost: toNum(pick(r, 'cost')), price: toNum(pick(r, 'selling')), opening: toNum(pick(r, 'opening')),
    });
  }
  // ---- Customers ----
  for (const r of table(findSheet(sheets, 'customers'), 'Customer ID')) {
    const code = str(pick(r, 'customer id'));
    out.customers.push({ id: code, code, name: str(pick(r, 'name')), phone: str(pick(r, 'phone')), address: str(pick(r, 'address')), social: str(pick(r, 'fb')), note: str(pick(r, 'note')) });
  }
  // ---- Sales: একই SO ID = একটি অর্ডার, একাধিক আইটেম ----
  const salesMap = {};
  for (const r of table(findSheet(sheets, 'sales'), 'SO ID')) {
    const code = str(pick(r, 'so id'));
    const o = (salesMap[code] ||= {
      id: code, code, date: dateStr(pick(r, 'date')), customerId: str(pick(r, 'customer id')), channel: str(pick(r, 'channel')) || 'Offline',
      items: [], discount: 0, delivery: 0, payments: [], status: str(pick(r, 'status')) || 'Confirmed', note: '',
    });
    const qty = toNum(pick(r, 'qty'));
    const cogs = toNum(pick(r, 'cost'));
    o.items.push({ variantId: str(pick(r, 'variant id')), qty, price: toNum(pick(r, 'unit price')), cost: qty ? cogs / qty : 0 });
    o.discount += toNum(pick(r, 'discount'));
    const paid = toNum(pick(r, 'paid'));
    if (paid) o.payments.push({ id: `${code}-p${o.payments.length + 1}`, date: o.date, amount: paid, method: str(pick(r, 'payment method')) || 'Cash' });
  }
  out.sales = Object.values(salesMap);
  // ---- Purchases ----
  const poMap = {};
  for (const r of table(findSheet(sheets, 'purchases'), 'PO ID')) {
    const code = str(pick(r, 'po id'));
    const p = (poMap[code] ||= { id: code, code, date: dateStr(pick(r, 'date')), supplierId: supplierId(pick(r, 'supplier')), items: [], extra: 0, payments: [], note: str(pick(r, 'note')) });
    p.items.push({ variantId: str(pick(r, 'variant id')), qty: toNum(pick(r, 'qty')), cost: toNum(pick(r, 'unit cost')) });
    const paid = toNum(pick(r, 'paid'));
    if (paid) p.payments.push({ id: `${code}-p${p.payments.length + 1}`, date: p.date, amount: paid, method: str(pick(r, 'payment method')) || 'Cash' });
  }
  out.purchases = Object.values(poMap);
  // ---- Expenses ----
  for (const r of table(findSheet(sheets, 'expenses'), 'Expense ID')) {
    const code = str(pick(r, 'expense id'));
    out.expenses.push({ id: code, code, date: dateStr(pick(r, 'date')), category: str(pick(r, 'category')) || 'Others', description: str(pick(r, 'description')), amount: toNum(pick(r, 'amount')), method: str(pick(r, 'payment method')) || 'Cash', note: str(pick(r, 'note')) });
  }
  // ---- Cashbook manual ledger ----
  const cb = findSheet(sheets, 'cashbook');
  if (cb) {
    const hi = cb.findIndex((r) => r && norm(r[0]) === 'date' && norm(r[2]).startsWith('type'));
    if (hi >= 0) {
      cb.slice(hi + 1).forEach((r, i) => {
        if (!r || !r[0]) return;
        const isIn = norm(r[2]) === 'in';
        const amount = toNum(isIn ? r[3] : r[4]) || toNum(r[3]) || toNum(r[4]);
        if (!amount) return;
        out.ledger.push({ id: `IMP-L${i + 1}`, date: dateStr(r[0]), kind: isIn ? 'capital' : 'drawing', amount, account: 'Cash', description: str(r[1]), note: str(r[5]) });
      });
    }
  }

  for (const k of ['products', 'variants', 'customers', 'suppliers', 'sales', 'purchases', 'expenses', 'ledger']) report.push(`${k}: ${out[k].length}`);
  return { data: out, report };
}
