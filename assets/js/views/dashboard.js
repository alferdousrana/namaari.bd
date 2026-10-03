import { esc, money, num, today, fmtDate, parseYMD, BN_DAYS, byDateDesc } from '../core/utils.js';
import { icon, empty } from '../ui/components.js';
import { statusPill, initials } from './shared.js';
import { ring, routineProgress, postStreak } from './growth.js';
import { monthlyChart } from './money.js';
import { todayReminders } from '../core/reminders.js';
import { openOrderDetail } from './sales.js';
import { openCustomerDetail } from './people.js';

let chart = null;
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'শুভ সকাল' : h < 17 ? 'শুভ দুপুর' : h < 20 ? 'শুভ সন্ধ্যা' : 'শুভ রাত্রি'; };

export const title = 'হোম';
export function render({ S, C }) {
  const t = today();
  const prog = routineProgress(S, t);
  const owner = (S.settings.owner || '').split(/\s+/).filter((w) => w && !/^(md|mohammad|mohammed|muhammad)\.?$/i.test(w)).join(' ');
  const accs = Object.values(C.accounts).sort((a, b) => b.balance - a.balance);
  const recent = [...C.orders].sort(byDateDesc).slice(0, 5);
  const low = C.inventory.filter((r) => r.level !== 'ok').sort((a, b) => a.available - b.available).slice(0, 6);
  const dues = C.customers.filter((c) => c.due > 0).sort((a, b) => b.due - a.due).slice(0, 5);
  const totalDue = C.customers.reduce((a, c) => a + Math.max(0, c.due), 0);
  const supDue = C.suppliers.reduce((a, s) => a + Math.max(0, s.due), 0);
  const next = todayReminders(S).find((r) => !r.passed);
  const postsToday = S.posts.filter((p) => p.date === t && p.status === 'posted').length;
  const target = S.settings.social.dailyTarget || 0;
  const hasData = S.products.length || S.sales.length;

  return `
    <section class="hero">
      <div class="hero-top">
        <div><h2>${greet()}${owner ? ', ' + esc(owner) : ''}</h2><div class="date">${BN_DAYS[parseYMD(t).getDay()]}বার, ${fmtDate(t)}</div></div>
        <a href="#/activity" style="color:inherit;text-decoration:none">${ring(prog.pct, `${prog.done}/${prog.total}`, 'আজকের কাজ')}</a>
      </div>
      <div class="hero-stats">
        <div><span>আজ বিক্রি</span><b data-count="${C.kpi.todaySales}">${money(C.kpi.todaySales)}</b></div>
        <div><span>এই মাসে</span><b data-count="${C.kpi.monthSales}">${money(C.kpi.monthSales)}</b></div>
        <div><span>হাতে টাকা</span><b data-count="${C.bs.cash}">${money(C.bs.cash)}</b></div>
      </div>
    </section>
    <hr class="stitch draw" style="margin:18px 6px">

    ${!hasData ? `<div class="banner">${icon('upload')}<p>পুরোনো এক্সেল ফাইলের ডেটা আনতে চান? সেটিংস → "এক্সেল থেকে ইমপোর্ট"।</p><a class="btn sm primary" href="#/settings">সেটিংস</a></div>` : ''}
    ${target && postsToday < target ? `<a class="banner" href="#/marketing" style="text-decoration:none">${icon('megaphone')}<p>আজ ${postsToday}/${target}টি পোস্ট হয়েছে${next ? ` · পরের রিমাইন্ডার ${esc(next.time)} — ${esc(next.title)}` : ''}</p>${icon('chev')}</a>` : ''}

    <div class="kpis">
      <a class="kpi" href="#/reports"><span>এই মাসের গ্রস লাভ</span><b>${money(C.kpi.monthGross)}</b><small>খরচ ${money(C.kpi.monthExpenses)}</small></a>
      <a class="kpi ${C.kpi.pendingOrders ? 'alert' : ''}" href="#/sales"><span>পেন্ডিং / পাঠাতে হবে</span><b>${C.kpi.pendingOrders} / ${C.kpi.toShip}</b><small>অর্ডার</small></a>
      <a class="kpi" href="#/customers"><span>কাস্টমারের কাছে পাওনা</span><b>${money(totalDue)}</b><small>সাপ্লায়ার দেনা ${money(supDue)}</small></a>
      <a class="kpi ${C.kpi.lowStock ? 'alert' : ''}" href="#/inventory"><span>স্টক</span><b>${num(C.kpi.totalStock)} পিস</b><small>${C.kpi.lowStock} টি শেষ/কম</small></a>
    </div>

    <div class="dash-grid">
      <div>
        <div class="panel"><div class="panel-head"><h3>বিক্রি, লাভ ও খরচ</h3><a href="#/reports">রিপোর্ট</a></div><div class="chart-box"><canvas id="dash-chart"></canvas></div></div>
        <div class="panel"><div class="panel-head"><h3>সাম্প্রতিক অর্ডার</h3><a href="#/sales">সব দেখুন</a></div>
          <div class="list">${recent.map((o) => `<button class="item" data-order="${esc(o.id)}" style="box-shadow:none;background:var(--surface-2)"><div class="avatar">${initials(C.customerById[o.customerId]?.name)}</div><div class="main-col"><div class="t">${esc(C.customerById[o.customerId]?.name || 'ওয়াক-ইন')} ${statusPill(o.status)}</div><div class="s">${esc(o.code)} · ${fmtDate(o.date)}</div></div><div class="r"><b>${money(o.total)}</b>${o.due > 0 ? `<small class="bad">বাকি ${money(o.due)}</small>` : ''}</div></button>`).join('') || empty('এখনো অর্ডার নেই', 'নিচের ＋ বাটন থেকে প্রথম অর্ডার দিন।')}</div>
        </div>
      </div>
      <div>
        <div class="panel"><div class="panel-head"><h3>টাকা কোথায় আছে</h3><a href="#/cash">ক্যাশবুক</a></div>
          <div class="acc-list">${accs.map((a) => `<div class="acc-row"><span>${esc(a.name)}</span><b class="${a.balance < 0 ? 'bad' : ''}">${money(a.balance)}</b></div>`).join('') || '<p class="muted">কোনো লেনদেন নেই</p>'}</div></div>
        <div class="panel"><div class="panel-head"><h3>বাকি আদায় করুন</h3><a href="#/customers">সব</a></div>
          <div class="acc-list">${dues.map((c) => `<div class="acc-row" data-cust="${esc(c.id)}" style="cursor:pointer"><span>${esc(c.name)}</span><small class="muted">${esc(c.phone || '')}</small><b class="bad">${money(c.due)}</b></div>`).join('') || '<p class="muted">কারো কাছে বাকি নেই 🎉</p>'}</div></div>
        <div class="panel"><div class="panel-head"><h3>স্টক শেষ / কম</h3><a href="#/inventory">স্টক</a></div>
          <div class="acc-list">${low.map((r) => `<div class="acc-row"><span>${esc(r.productName)} <small class="muted">${esc([r.size, r.color].filter(Boolean).join('/'))}</small></span><b class="${r.level === 'out' ? 'bad' : ''}">${num(r.available)}</b></div>`).join('') || '<p class="muted">সব স্টক ঠিক আছে</p>'}</div></div>
        <div class="panel"><div class="streak">${icon('flame')}<div><b>${postStreak(S)}</b> <span class="muted">দিন টানা সোশ্যাল মিডিয়ায় পোস্ট</span></div></div></div>
      </div>
    </div>`;
}
export function mount(root, ctx) {
  if (chart) chart.destroy();
  chart = monthlyChart(root.querySelector('#dash-chart'), ctx.C, 6);
  root.addEventListener('click', (e) => {
    const o = e.target.closest('[data-order]');
    if (o) return openOrderDetail(ctx, o.dataset.order);
    const c = e.target.closest('[data-cust]');
    if (c) openCustomerDetail(ctx, c.dataset.cust);
  });
  // সংখ্যা গুনে ওঠার অ্যানিমেশন — শুধু প্রথমবার হোম খুললে
  if (ctx.firstPaint && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.querySelectorAll('[data-count]').forEach((el) => {
      const target = Number(el.dataset.count) || 0;
      const t0 = performance.now(), dur = 900;
      const step = (now) => { const p = Math.min(1, (now - t0) / dur); el.textContent = money(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }
}
export function unmount() { if (chart) { chart.destroy(); chart = null; } }
