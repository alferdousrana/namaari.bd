// সব হিসাব এখানে — কোনো UI নেই, শুধু ডেটা থেকে রিপোর্ট বানায়।
// নিয়ম:
//  • Confirmed / Shipped / Delivered অর্ডার = বিক্রি (আয়, COGS, স্টক কমে, কাস্টমার বাকি)
//  • Pending অর্ডার = স্টক "রিজার্ভ", এখনো বিক্রি না। আগাম টাকা নিলে তা "কাস্টমার অ্যাডভান্স" (দায়)
//  • Cancelled / Returned = বিক্রি না, স্টক ফেরত
//  • "ড্রয়িংস" ক্যাটাগরির খরচ (যেমন Personal Cost) ব্যবসার লাভ থেকে বাদ যায় না, মালিকের উত্তোলন হিসেবে ধরা হয়
import { sum, monthKey, today, toNum } from './utils.js';

export const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Returned', 'Cancelled'];
export const REVENUE_STATUSES = new Set(['Confirmed', 'Shipped', 'Delivered']);
export const STATUS_BN = {
  Pending: 'পেন্ডিং', Confirmed: 'কনফার্মড', Shipped: 'পাঠানো হয়েছে',
  Delivered: 'ডেলিভারড', Returned: 'রিটার্ন', Cancelled: 'বাতিল',
};

export const LEDGER_KINDS = {
  capital: { bn: 'মূলধন জমা', dir: 1 },
  drawing: { bn: 'মালিকের উত্তোলন', dir: -1 },
  loan_in: { bn: 'লোন নেওয়া', dir: 1 },
  loan_out: { bn: 'লোন পরিশোধ', dir: -1 },
  income: { bn: 'অন্যান্য আয়', dir: 1 },
  transfer: { bn: 'অ্যাকাউন্ট ট্রান্সফার', dir: 0 },
};

export const orderSubtotal = (o) => sum(o.items || [], (i) => toNum(i.qty) * toNum(i.price));
export const orderTotal = (o) => orderSubtotal(o) - toNum(o.discount) + toNum(o.delivery);
export const orderCogs = (o) => sum(o.items || [], (i) => toNum(i.qty) * toNum(i.cost));
export const paymentsSum = (x) => sum(x.payments || [], (p) => p.amount);
export const purchaseTotal = (p) => sum(p.items || [], (i) => toNum(i.qty) * toNum(i.cost)) + toNum(p.extra);
export const isRevenue = (o) => REVENUE_STATUSES.has(o.status);

export function compute(S) {
  const st = S.settings || {};
  const drawingCats = new Set(st.drawingCats || ['Personal Cost']);
  const lowStock = toNum(st.lowStock ?? 1);
  const now = today();

  const productById = Object.fromEntries((S.products || []).map((p) => [p.id, p]));
  const variantById = Object.fromEntries((S.variants || []).map((v) => [v.id, v]));
  const customerById = Object.fromEntries((S.customers || []).map((c) => [c.id, c]));
  const supplierById = Object.fromEntries((S.suppliers || []).map((s) => [s.id, s]));

  const variantLabel = (id) => {
    const v = variantById[id];
    if (!v) return id || '—';
    const p = productById[v.productId];
    return `${p ? p.name : v.productId} (${[v.size, v.color].filter(Boolean).join('/')})`;
  };

  // ---------- অর্ডার ----------
  const orders = (S.sales || []).map((o) => {
    const subtotal = orderSubtotal(o);
    const total = orderTotal(o);
    const cogs = orderCogs(o);
    const paid = paymentsSum(o);
    const revenue = isRevenue(o);
    return {
      ...o, subtotal, total, cogs, paid, revenue,
      profit: total - cogs,
      due: revenue ? total - paid : 0,
      advance: revenue ? 0 : paid,
      qty: sum(o.items || [], (i) => i.qty),
    };
  });
  const orderById = Object.fromEntries(orders.map((o) => [o.id, o]));

  // ---------- ক্রয় ----------
  const purchases = (S.purchases || []).map((p) => {
    const total = purchaseTotal(p);
    const paid = paymentsSum(p);
    return { ...p, total, paid, due: total - paid, qty: sum(p.items || [], (i) => i.qty) };
  });

  // ---------- স্টক ----------
  const stock = {};
  for (const v of S.variants || []) {
    stock[v.id] = { opening: toNum(v.opening), purchased: 0, sold: 0, reserved: 0, adjusted: 0 };
  }
  const ensure = (id) => (stock[id] ||= { opening: 0, purchased: 0, sold: 0, reserved: 0, adjusted: 0 });
  for (const p of purchases) for (const i of p.items || []) ensure(i.variantId).purchased += toNum(i.qty);
  for (const o of orders) {
    for (const i of o.items || []) {
      if (o.revenue) ensure(i.variantId).sold += toNum(i.qty);
      else if (o.status === 'Pending') ensure(i.variantId).reserved += toNum(i.qty);
    }
  }
  for (const a of S.adjustments || []) ensure(a.variantId).adjusted += toNum(a.qty);

  const inventory = Object.entries(stock).map(([id, s]) => {
    const v = variantById[id] || { id, cost: 0, price: 0 };
    const p = productById[v.productId] || {};
    const onHand = s.opening + s.purchased - s.sold + s.adjusted;
    const available = onHand - s.reserved;
    const reorder = v.reorder !== undefined && v.reorder !== '' ? toNum(v.reorder) : lowStock;
    return {
      id, code: v.code || id, productId: v.productId, productName: p.name || '—', category: p.category || '',
      size: v.size, color: v.color, sku: v.sku, cost: toNum(v.cost), price: toNum(v.price),
      ...s, onHand, available, reorder,
      value: onHand * toNum(v.cost),
      level: onHand <= 0 ? 'out' : available < reorder ? 'low' : 'ok',
      label: variantLabel(id),
    };
  }).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const invById = Object.fromEntries(inventory.map((r) => [r.id, r]));

  const openingStockValue = sum(S.variants || [], (v) => toNum(v.opening) * toNum(v.cost));
  const adjustmentValue = sum(S.adjustments || [], (a) => toNum(a.qty) * toNum(variantById[a.variantId]?.cost));

  // ---------- খরচ ----------
  const expenses = (S.expenses || []).map((e) => ({ ...e, amount: toNum(e.amount), drawing: drawingCats.has(e.category) }));
  const bizExpenses = expenses.filter((e) => !e.drawing);
  const drawExpenses = expenses.filter((e) => e.drawing);

  // ---------- অ্যাকাউন্ট (ক্যাশ / বিকাশ / ব্যাংক) ----------
  const accounts = {};
  const acc = (m) => (accounts[m || 'Cash'] ||= { name: m || 'Cash', in: 0, out: 0 });
  const cashMoves = []; // ক্যাশবুকের জন্য সব লেনদেন একসাথে
  for (const o of orders) for (const p of o.payments || []) {
    const a = toNum(p.amount);
    if (a >= 0) acc(p.method).in += a; else acc(p.method).out += -a;
    cashMoves.push({ date: p.date || o.date, type: 'sale', ref: o.code, desc: `বিক্রি ${o.code} — ${customerById[o.customerId]?.name || ''}`, account: p.method || 'Cash', amount: a });
  }
  for (const pu of purchases) for (const p of pu.payments || []) {
    const a = toNum(p.amount);
    acc(p.method).out += a;
    cashMoves.push({ date: p.date || pu.date, type: 'purchase', ref: pu.code, desc: `ক্রয় ${pu.code} — ${supplierById[pu.supplierId]?.name || ''}`, account: p.method || 'Cash', amount: -a });
  }
  for (const e of expenses) {
    acc(e.method).out += e.amount;
    cashMoves.push({ date: e.date, type: e.drawing ? 'drawing' : 'expense', ref: e.code, desc: `${e.category}: ${e.description || ''}`, account: e.method || 'Cash', amount: -e.amount });
  }
  let capitalIn = 0, drawLedger = 0, loanNet = 0, otherIncome = 0;
  for (const l of S.ledger || []) {
    const a = toNum(l.amount);
    if (l.kind === 'transfer') {
      acc(l.account).out += a; acc(l.toAccount).in += a;
      cashMoves.push({ date: l.date, type: 'transfer', ref: '', desc: `${l.account} → ${l.toAccount} ${l.description || ''}`, account: l.account, amount: -a, id: l.id });
      cashMoves.push({ date: l.date, type: 'transfer', ref: '', desc: `${l.account} → ${l.toAccount} ${l.description || ''}`, account: l.toAccount, amount: a, id: l.id });
      continue;
    }
    const dir = LEDGER_KINDS[l.kind]?.dir ?? 1;
    if (dir > 0) acc(l.account).in += a; else acc(l.account).out += a;
    if (l.kind === 'capital') capitalIn += a;
    if (l.kind === 'drawing') drawLedger += a;
    if (l.kind === 'loan_in') loanNet += a;
    if (l.kind === 'loan_out') loanNet -= a;
    if (l.kind === 'income') otherIncome += a;
    cashMoves.push({ date: l.date, type: l.kind, ref: '', desc: `${LEDGER_KINDS[l.kind]?.bn || l.kind}${l.description ? ': ' + l.description : ''}`, account: l.account || 'Cash', amount: dir * a, id: l.id, manual: true });
  }
  for (const a of Object.values(accounts)) a.balance = a.in - a.out;
  const cash = sum(Object.values(accounts), (a) => a.balance);
  cashMoves.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // ---------- লাভ-ক্ষতি ----------
  const revOrders = orders.filter((o) => o.revenue);
  const revenue = sum(revOrders, (o) => o.total);
  const cogs = sum(revOrders, (o) => o.cogs);
  const grossProfit = revenue - cogs;
  const bizExpenseTotal = sum(bizExpenses, (e) => e.amount);
  const netProfit = grossProfit - bizExpenseTotal + otherIncome + adjustmentValue;
  const drawings = drawLedger + sum(drawExpenses, (e) => e.amount);

  // ---------- ব্যালেন্স শিট ----------
  const receivable = sum(revOrders, (o) => o.due);
  const advances = sum(orders.filter((o) => !o.revenue), (o) => o.paid);
  const payable = sum(purchases, (p) => p.due);
  // বইয়ের হিসাবে স্টকের মূল্য = ওপেনিং + ক্রয় − বিক্রিত পণ্যের খরচ ± অ্যাডজাস্টমেন্ট
  const inventoryValue = openingStockValue + sum(purchases, (p) => p.total) - cogs + adjustmentValue;
  const inventoryAtCost = sum(inventory, (r) => r.value);
  const totalAssets = cash + inventoryValue + receivable;
  const totalLiabilities = payable + advances + loanNet;
  const capital = capitalIn + openingStockValue;
  const equity = capital + netProfit - drawings;
  const difference = Math.round(totalAssets - (totalLiabilities + equity));

  // ---------- কাস্টমার / সাপ্লায়ার ----------
  const customers = (S.customers || []).map((c) => {
    const os = orders.filter((o) => o.customerId === c.id);
    const rev = os.filter((o) => o.revenue);
    return {
      ...c, orders: os.length,
      totalPurchase: sum(rev, (o) => o.total),
      due: sum(rev, (o) => o.due),
      lastDate: os.map((o) => o.date).sort().pop() || '',
    };
  });
  const suppliers = (S.suppliers || []).map((s) => {
    const ps = purchases.filter((p) => p.supplierId === s.id);
    return { ...s, purchases: ps.length, total: sum(ps, (p) => p.total), paid: sum(ps, (p) => p.paid), due: sum(ps, (p) => p.due), lastDate: ps.map((p) => p.date).sort().pop() || '' };
  });

  // ---------- মাসিক ----------
  const months = {};
  const M = (k) => (months[k] ||= { month: k, sales: 0, cogs: 0, gross: 0, purchases: 0, expenses: 0, drawings: 0, cashIn: 0, cashOut: 0, orders: 0 });
  for (const o of revOrders) { const m = M(monthKey(o.date)); m.sales += o.total; m.cogs += o.cogs; m.orders += 1; }
  for (const p of purchases) M(monthKey(p.date)).purchases += p.total;
  for (const e of expenses) { const m = M(monthKey(e.date)); if (e.drawing) m.drawings += e.amount; else m.expenses += e.amount; }
  for (const c of cashMoves) {
    if (c.type === 'transfer') continue;
    const m = M(monthKey(c.date));
    if (c.amount >= 0) m.cashIn += c.amount; else m.cashOut += -c.amount;
  }
  for (const m of Object.values(months)) { m.gross = m.sales - m.cogs; m.net = m.gross - m.expenses; }

  // ---------- বিশ্লেষণ ----------
  const expenseByCat = {};
  for (const e of expenses) expenseByCat[e.category || 'Others'] = (expenseByCat[e.category || 'Others'] || 0) + e.amount;
  const channelSales = {};
  for (const o of revOrders) channelSales[o.channel || 'Others'] = (channelSales[o.channel || 'Others'] || 0) + o.total;
  const productSales = {};
  for (const o of revOrders) for (const i of o.items || []) {
    const pid = variantById[i.variantId]?.productId || i.variantId;
    const r = (productSales[pid] ||= { id: pid, name: productById[pid]?.name || pid, qty: 0, amount: 0, profit: 0 });
    r.qty += toNum(i.qty); r.amount += toNum(i.qty) * toNum(i.price); r.profit += toNum(i.qty) * (toNum(i.price) - toNum(i.cost));
  }

  const thisMonth = monthKey(now);
  return {
    orders, orderById, purchases, expenses, inventory, invById, customers, suppliers, accounts, cashMoves,
    productById, variantById, customerById, supplierById, variantLabel,
    months, expenseByCat, channelSales,
    topProducts: Object.values(productSales).sort((a, b) => b.amount - a.amount),
    pl: { revenue, cogs, grossProfit, bizExpenseTotal, otherIncome, adjustmentValue, netProfit, drawings },
    bs: { cash, inventoryValue, inventoryAtCost, receivable, totalAssets, payable, advances, loans: loanNet, totalLiabilities, capitalIn, openingStockValue, capital, netProfit, drawings, equity, difference },
    kpi: {
      todaySales: sum(revOrders.filter((o) => o.date === now), (o) => o.total),
      todayOrders: orders.filter((o) => o.date === now && o.status !== 'Cancelled').length,
      monthSales: months[thisMonth]?.sales || 0,
      monthGross: months[thisMonth]?.gross || 0,
      monthExpenses: months[thisMonth]?.expenses || 0,
      pendingOrders: orders.filter((o) => o.status === 'Pending').length,
      toShip: orders.filter((o) => o.status === 'Confirmed').length,
      totalStock: sum(inventory, (r) => r.onHand),
      lowStock: inventory.filter((r) => r.level !== 'ok').length,
    },
  };
}
