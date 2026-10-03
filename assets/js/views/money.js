import { esc, money, num, toNum, today, fmtDate, fmtMonth, monthKey, lastMonths, sum } from '../core/utils.js';
import { LEDGER_KINDS } from '../core/calc.js';
import * as store from '../core/store.js';
import { icon, openSheet, toast, confirmBox, field, input, select, readForm, options, empty } from '../ui/components.js';
import { csvDownload } from './shared.js';

// ======================= ক্যাশবুক =======================
let cash = { account: '' };
export const cashbook = {
  title: 'ক্যাশবুক',
  render({ C, S }) {
    const accs = Object.values(C.accounts).sort((a, b) => b.balance - a.balance);
    const moves = C.cashMoves.filter((m) => !cash.account || m.account === cash.account);
    return `
      <div class="panel">
        <div class="panel-head"><h3>অ্যাকাউন্ট ব্যালেন্স</h3><b class="num ${C.bs.cash < 0 ? 'bad' : ''}">${money(C.bs.cash)}</b></div>
        <div class="acc-list">${accs.map((a) => `<div class="acc-row"><span>${esc(a.name)}</span><small class="muted num">+${money(a.in)} / −${money(a.out)}</small><b class="${a.balance < 0 ? 'bad' : ''}">${money(a.balance)}</b></div>`).join('') || '<p class="muted">এখনো কোনো লেনদেন নেই</p>'}</div>
        ${accs.some((a) => a.balance < 0) ? '<p class="hint" style="margin-top:8px">কোনো অ্যাকাউন্ট মাইনাসে থাকলে সাধারণত কোনো টাকা ঢোকার এন্ট্রি বাদ পড়েছে, অথবা এক অ্যাকাউন্ট থেকে আরেকটিতে টাকা সরানো হয়েছে — "ট্রান্সফার" এন্ট্রি দিন।</p>' : ''}
      </div>
      <div class="toolbar section">
        <select id="f-acc" style="flex:1;min-width:160px">${options([{ value: '', label: 'সব অ্যাকাউন্ট' }, ...S.settings.lists.payMethods], cash.account)}</select>
        <button class="btn primary" data-new>${icon('plus')}ম্যানুয়াল এন্ট্রি</button>
        <button class="btn ghost" data-csv>${icon('download')}CSV</button>
      </div>
      <p class="hint" style="margin-bottom:10px">বিক্রি, ক্রয় ও খরচের টাকা নিজে থেকেই এখানে আসে। মূলধন, লোন, উত্তোলন বা বিকাশ→ক্যাশ ট্রান্সফার "ম্যানুয়াল এন্ট্রি" দিয়ে লিখুন।</p>
      <div class="table-wrap"><table><thead><tr><th>তারিখ</th><th>বিবরণ</th><th>অ্যাকাউন্ট</th><th class="n">ঢুকেছে</th><th class="n">বের হয়েছে</th><th></th></tr></thead>
      <tbody>${moves.slice(0, 400).map((m) => `<tr><td>${fmtDate(m.date)}</td><td>${esc(m.desc)}</td><td>${esc(m.account)}</td><td class="n good">${m.amount > 0 ? money(m.amount) : ''}</td><td class="n bad">${m.amount < 0 ? money(-m.amount) : ''}</td>
        <td>${m.manual || m.type === 'transfer' ? `<button class="icon-btn" data-del="${esc(m.id)}" aria-label="মুছুন">${icon('trash')}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">কিছু নেই</td></tr>'}</tbody></table></div>`;
  },
  mount(root, ctx) {
    root.querySelector('#f-acc').addEventListener('change', (e) => { cash.account = e.target.value; ctx.rerender(); });
    root.addEventListener('click', async (e) => {
      if (e.target.closest('[data-new]')) return openLedgerForm(ctx);
      if (e.target.closest('[data-csv]')) return csvDownload(`namaari-cashbook-${today()}.csv`, [['Date', 'Description', 'Account', 'In', 'Out'], ...ctx.C.cashMoves.map((m) => [m.date, m.desc, m.account, m.amount > 0 ? m.amount : '', m.amount < 0 ? -m.amount : ''])]);
      const d = e.target.closest('[data-del]');
      if (d && await confirmBox('এই এন্ট্রি মুছবেন?')) store.remove('ledger', d.dataset.del);
    });
  },
};
export function openLedgerForm(ctx) {
  const L = ctx.S.settings.lists;
  openSheet({
    title: 'ম্যানুয়াল এন্ট্রি',
    body: `<form class="form" id="lf"><div class="grid-2">
      ${field('ধরন', select('kind', Object.entries(LEDGER_KINDS).map(([value, k]) => ({ value, label: k.bn })), 'capital'), { cls: 'span-2' })}
      ${field('টাকা', input('amount', '', 'type="number" min="0" step="any"'))}
      ${field('তারিখ', input('date', today(), 'type="date"'))}
      ${field('অ্যাকাউন্ট', select('account', L.payMethods, L.payMethods[0]))}
      <div data-to hidden>${field('কোন অ্যাকাউন্টে', select('toAccount', L.payMethods, L.payMethods[1] || L.payMethods[0]))}</div>
      ${field('বিবরণ', input('description', ''), { cls: 'span-2' })}
    </div></form>`,
    footer: '<button class="btn primary" data-save>সেভ করুন</button>',
    onMount: (el, close) => {
      const form = el.querySelector('#lf');
      const k = form.querySelector('[name=kind]');
      k.addEventListener('change', () => { form.querySelector('[data-to]').hidden = k.value !== 'transfer'; });
      el.querySelector('[data-save]').addEventListener('click', () => {
        const f = readForm(form);
        if (!(toNum(f.amount) > 0)) return toast('টাকা লিখুন', 'err');
        if (f.kind === 'transfer' && f.account === f.toAccount) return toast('দুটি আলাদা অ্যাকাউন্ট বাছুন', 'err');
        store.save('ledger', { ...f, amount: toNum(f.amount), toAccount: f.kind === 'transfer' ? f.toAccount : '' });
        close(); toast('এন্ট্রি সেভ হয়েছে');
      });
    },
  });
}

// ======================= রিপোর্ট =======================
let rep = { tab: 'monthly', month: '' };
let charts = [];
export const reports = {
  title: 'রিপোর্ট',
  render({ C }) {
    const tabs = [['monthly', 'মাসিক'], ['pl', 'লাভ-ক্ষতি'], ['bs', 'ব্যালেন্স শিট'], ['exp', 'খরচ'], ['sales', 'বিক্রি বিশ্লেষণ']];
    return `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="${rep.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="rep-body">${body(C)}</div>`;
  },
  mount(root, ctx) {
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { rep.tab = t.dataset.tab; ctx.rerender(); return; }
      if (e.target.closest('[data-csv]')) {
        const ms = Object.values(ctx.C.months).sort((a, b) => a.month.localeCompare(b.month));
        csvDownload(`namaari-monthly-${today()}.csv`, [['Month', 'Sales', 'COGS', 'Gross Profit', 'Business Expenses', 'Net Profit', 'Purchases', 'Drawings', 'Cash In', 'Cash Out'], ...ms.map((m) => [m.month, m.sales, m.cogs, m.gross, m.expenses, m.net, m.purchases, m.drawings, m.cashIn, m.cashOut])]);
      }
    });
    root.addEventListener('change', (e) => { if (e.target.id === 'pl-month') { rep.month = e.target.value; ctx.rerender(); } });
    drawCharts(root, ctx.C);
  },
  unmount() { charts.forEach((c) => c.destroy()); charts = []; },
};

function body(C) {
  const ms = Object.values(C.months).sort((a, b) => b.month.localeCompare(a.month));
  if (rep.tab === 'monthly') {
    const t = (k) => sum(ms, (m) => m[k]);
    return `<div class="panel"><div class="panel-head"><h3>বিক্রি বনাম লাভ</h3></div><div class="chart-box"><canvas id="ch-monthly"></canvas></div></div>
      <div class="toolbar section"><span style="flex:1" class="muted">নিট লাভ = গ্রস লাভ − ব্যবসার খরচ (ব্যক্তিগত উত্তোলন বাদে)</span><button class="btn ghost sm" data-csv>${icon('download')}CSV</button></div>
      <div class="table-wrap"><table><thead><tr><th>মাস</th><th class="n">বিক্রি</th><th class="n">গ্রস লাভ</th><th class="n">ব্যবসার খরচ</th><th class="n">নিট লাভ</th><th class="n">ক্রয়</th><th class="n">উত্তোলন</th><th class="n">ক্যাশ ইন</th><th class="n">ক্যাশ আউট</th></tr></thead>
      <tbody>${ms.map((m) => `<tr><td>${fmtMonth(m.month)}</td><td class="n">${money(m.sales)}</td><td class="n">${money(m.gross)}</td><td class="n">${money(m.expenses)}</td><td class="n ${m.net < 0 ? 'bad' : 'good'}">${money(m.net)}</td><td class="n">${money(m.purchases)}</td><td class="n">${money(m.drawings)}</td><td class="n">${money(m.cashIn)}</td><td class="n">${money(m.cashOut)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>মোট</td><td class="n">${money(t('sales'))}</td><td class="n">${money(t('gross'))}</td><td class="n">${money(t('expenses'))}</td><td class="n">${money(t('net'))}</td><td class="n">${money(t('purchases'))}</td><td class="n">${money(t('drawings'))}</td><td class="n">${money(t('cashIn'))}</td><td class="n">${money(t('cashOut'))}</td></tr></tfoot></table></div>`;
  }
  if (rep.tab === 'pl') {
    const m = rep.month ? C.months[rep.month] : null;
    const r = m ? { revenue: m.sales, cogs: m.cogs, gross: m.gross, exp: m.expenses, net: m.net, draw: m.drawings } : { revenue: C.pl.revenue, cogs: C.pl.cogs, gross: C.pl.grossProfit, exp: C.pl.bizExpenseTotal, net: C.pl.netProfit, draw: C.pl.drawings };
    const margin = r.revenue ? Math.round((r.gross / r.revenue) * 100) : 0;
    return `<div class="panel"><div class="panel-head"><h3>লাভ-ক্ষতি হিসাব</h3>
      <select id="pl-month" style="max-width:180px">${options([{ value: '', label: 'শুরু থেকে এখন' }, ...ms.map((x) => ({ value: x.month, label: fmtMonth(x.month) }))], rep.month)}</select></div>
      <div class="stat-lines">
        <div><span>বিক্রি (কনফার্মড/ডেলিভারড)</span><b>${money(r.revenue)}</b></div>
        <div><span>বিক্রিত পণ্যের কেনা দাম (COGS)</span><b>−${money(r.cogs)}</b></div>
        <div class="total"><span>গ্রস লাভ <small class="muted">(${margin}%)</small></span><b>${money(r.gross)}</b></div>
        <div><span>ব্যবসার খরচ</span><b>−${money(r.exp)}</b></div>
        ${!m && C.pl.otherIncome ? `<div><span>অন্যান্য আয়</span><b>${money(C.pl.otherIncome)}</b></div>` : ''}
        ${!m && C.pl.adjustmentValue ? `<div><span>স্টক অ্যাডজাস্টমেন্ট</span><b>${money(C.pl.adjustmentValue)}</b></div>` : ''}
        <div class="total"><span>নিট লাভ / ক্ষতি</span><b class="${r.net < 0 ? 'bad' : 'good'}">${money(r.net)}</b></div>
        <div><span>মালিকের উত্তোলন (লাভ থেকে নেওয়া)</span><b>${money(r.draw)}</b></div>
      </div></div>`;
  }
  if (rep.tab === 'bs') {
    const b = C.bs;
    return `<div class="dash-grid" style="margin-top:0">
      <div class="panel"><div class="panel-head"><h3>সম্পদ</h3></div><div class="stat-lines">
        <div><span>নগদ ও অ্যাকাউন্ট</span><b class="${b.cash < 0 ? 'bad' : ''}">${money(b.cash)}</b></div>
        <div><span>স্টক (বইয়ের মূল্য)</span><b>${money(b.inventoryValue)}</b></div>
        <div><span>কাস্টমারের কাছে পাওনা</span><b>${money(b.receivable)}</b></div>
        <div class="total"><span>মোট সম্পদ</span><b>${money(b.totalAssets)}</b></div></div></div>
      <div class="panel"><div class="panel-head"><h3>দায় ও মালিকানা</h3></div><div class="stat-lines">
        <div><span>সাপ্লায়ারের দেনা</span><b>${money(b.payable)}</b></div>
        <div><span>কাস্টমার অ্যাডভান্স</span><b>${money(b.advances)}</b></div>
        <div><span>লোন</span><b>${money(b.loans)}</b></div>
        <div><span>মূলধন${b.openingStockValue ? ' (ওপেনিং স্টকসহ)' : ''}</span><b>${money(b.capital)}</b></div>
        <div><span>নিট লাভ/ক্ষতি</span><b>${money(b.netProfit)}</b></div>
        <div><span>উত্তোলন</span><b>−${money(b.drawings)}</b></div>
        <div class="total"><span>মোট দায় + মালিকানা</span><b>${money(b.totalLiabilities + b.equity)}</b></div></div></div>
      </div>
      <div class="banner" style="margin-top:16px;${b.difference === 0 ? 'background:var(--good-soft)' : ''}">${icon(b.difference === 0 ? 'check' : 'alert')}<p>${b.difference === 0 ? 'হিসাব মিলেছে — সম্পদ = দায় + মালিকানা।' : `হিসাবে ${money(b.difference)} পার্থক্য আছে। পুরোনো ডেটায় ভুল এন্ট্রি থাকতে পারে।`}</p></div>`;
  }
  if (rep.tab === 'exp') {
    const cats = Object.entries(C.expenseByCat).sort((a, b) => b[1] - a[1]);
    const total = sum(cats, (c) => c[1]);
    const max = cats[0]?.[1] || 1;
    if (!cats.length) return empty('কোনো খরচ নেই', 'খরচ যোগ করলে এখানে বিশ্লেষণ দেখাবে।');
    return `<div class="panel"><div class="panel-head"><h3>ক্যাটাগরি অনুযায়ী খরচ</h3><b>${money(total)}</b></div>
      <div class="bars">${cats.map(([k, v]) => `<div class="bar-row"><span>${esc(k)}</span><div class="track"><div class="fill ${C.expenses.find((e) => e.category === k)?.drawing ? 'accent' : ''}" style="width:${(v / max) * 100}%"></div></div><b class="num">${money(v)} <small class="muted">${Math.round((v / total) * 100)}%</small></b></div>`).join('')}</div>
      <p class="hint" style="margin-top:10px">হলুদ বার = ব্যক্তিগত/উত্তোলন ক্যাটাগরি।</p></div>`;
  }
  // sales analysis
  const top = C.topProducts.slice(0, 10);
  const maxP = top[0]?.amount || 1;
  const ch = Object.entries(C.channelSales).sort((a, b) => b[1] - a[1]);
  const maxC = ch[0]?.[1] || 1;
  if (!top.length) return empty('এখনো বিক্রি নেই', 'কনফার্মড অর্ডার হলে এখানে সেরা পণ্য ও চ্যানেল দেখাবে।');
  return `<div class="dash-grid" style="margin-top:0">
    <div class="panel"><div class="panel-head"><h3>সেরা পণ্য</h3></div><div class="bars">${top.map((p) => `<div class="bar-row"><span title="${esc(p.name)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span><div class="track"><div class="fill" style="width:${(p.amount / maxP) * 100}%"></div></div><b class="num">${num(p.qty)} পিস · ${money(p.amount)}</b></div>`).join('')}</div></div>
    <div class="panel"><div class="panel-head"><h3>চ্যানেল অনুযায়ী</h3></div><div class="bars">${ch.map(([k, v]) => `<div class="bar-row"><span>${esc(k)}</span><div class="track"><div class="fill accent" style="width:${(v / maxC) * 100}%"></div></div><b class="num">${money(v)}</b></div>`).join('')}</div></div>
  </div>`;
}

function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
export function monthlyChart(canvas, C, n = 6) {
  if (!window.Chart || !canvas) return null;
  const keys = lastMonths(n);
  const ink = cssVar('--muted');
  return new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: keys.map(fmtMonth),
      datasets: [
        { label: 'বিক্রি', data: keys.map((k) => C.months[k]?.sales || 0), backgroundColor: cssVar('--brand'), borderRadius: 6, maxBarThickness: 28 },
        { label: 'গ্রস লাভ', data: keys.map((k) => C.months[k]?.gross || 0), backgroundColor: cssVar('--accent'), borderRadius: 6, maxBarThickness: 28 },
        { label: 'খরচ', data: keys.map((k) => C.months[k]?.expenses || 0), backgroundColor: cssVar('--muted') + '66', borderRadius: 6, maxBarThickness: 28 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: ink, font: { family: 'Hind Siliguri' } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money(c.raw)}` } } },
      scales: { x: { ticks: { color: ink }, grid: { display: false } }, y: { ticks: { color: ink, callback: (v) => money(v) }, grid: { color: cssVar('--line') } } },
    },
  });
}
function drawCharts(root, C) {
  charts.forEach((c) => c.destroy()); charts = [];
  const c = monthlyChart(root.querySelector('#ch-monthly'), C, 12);
  if (c) charts.push(c);
}
