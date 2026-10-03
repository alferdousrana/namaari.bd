import * as store from './core/store.js';
import { compute } from './core/calc.js';
import { esc } from './core/utils.js';
import { startReminders, stopReminders } from './core/reminders.js';
import { icon, toast, openSheet, closeTopSheet } from './ui/components.js';
import { NAV } from './nav.js';
import * as dashboard from './views/dashboard.js';
import * as sales from './views/sales.js';
import * as purchases from './views/purchases.js';
import * as expenses from './views/expenses.js';
import { products, inventory } from './views/catalog.js';
import { customers, suppliers } from './views/people.js';
import { cashbook, reports, openLedgerForm } from './views/money.js';
import { marketing, activity, openPostForm } from './views/growth.js';
import { settings, more } from './views/settings.js';
import { openProductForm } from './views/catalog.js';
import { openCustomerForm } from './views/people.js';

const VIEWS = { dashboard, sales, purchases, expenses, products, inventory, customers, suppliers, cash: cashbook, reports, marketing, activity, settings, more };
const app = document.getElementById('app');

// ---------- থিম ----------
export function setTheme(mode) {
  localStorage.setItem('namaari_theme', mode);
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#150e18' : '#5b2a5e');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTheme(localStorage.getItem('namaari_theme') || 'system'));
setTheme(localStorage.getItem('namaari_theme') || 'system');

// ---------- ইনস্টল (PWA) ----------
const install = { available: false, installed: matchMedia('(display-mode: standalone)').matches || navigator.standalone, evt: null };
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); install.evt = e; install.available = true; });
addEventListener('appinstalled', () => { install.available = false; install.installed = true; toast('অ্যাপ ইনস্টল হয়েছে'); });
async function promptInstall() { if (!install.evt) return; install.evt.prompt(); await install.evt.userChoice; install.evt = null; install.available = false; rerender(); }
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

export const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="var(--brand)"/><circle class="mark-ring" cx="32" cy="32" r="24.5"/><text x="32" y="41.5" text-anchor="middle" font-family="Tiro Bangla, serif" font-size="27" fill="var(--brand-ink)">ন</text></svg>`;

// ---------- লগইন ----------
function renderLogin() {
  stopReminders();
  const local = !store.firebaseReady;
  app.innerHTML = `<main class="login"><div class="login-card">
    <div class="login-mark">${LOGO}<div><h1>Namaari</h1></div></div>
    <p class="lede">ব্যবসার হিসাব, স্টক, অর্ডার আর প্রতিদিনের কাজ — এক জায়গায়।</p>
    ${local ? `<div class="form" style="display:grid;gap:14px;background:var(--surface);padding:22px;border-radius:var(--r-lg);box-shadow:var(--shadow)">
        <button class="btn primary block" id="go-local">এই ডিভাইসে শুরু করুন</button>
        <p class="local-note" style="margin:0">Firebase এখনো সেটআপ করা হয়নি, তাই ডেটা শুধু এই ব্রাউজারে থাকবে। সব ডিভাইসে সিঙ্ক ও লগইনের জন্য <b>assets/js/firebase-config.js</b> ফাইলে কনফিগ বসান (README দেখুন)।</p></div>`
    : `<form id="login-form" novalidate>
        <label class="field"><span class="field-label">ইমেইল</span><input name="email" type="email" autocomplete="username" required></label>
        <label class="field"><span class="field-label">পাসওয়ার্ড</span><input name="pass" type="password" autocomplete="current-password" required></label>
        <button class="btn primary block" type="submit">লগইন</button>
        <div class="row-links"><button type="button" class="link-btn" id="forgot">পাসওয়ার্ড ভুলে গেছি</button></div>
        <p class="hint" id="login-msg" role="alert"></p>
      </form>`}
    <hr class="stitch draw" style="margin-top:26px">
  </div></main>`;
  if (local) { document.getElementById('go-local').onclick = () => { store.auth.startLocal(); boot(); }; return; }
  const form = document.getElementById('login-form');
  const msg = document.getElementById('login-msg');
  const errText = (e) => ({
    'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড ভুল।', 'auth/wrong-password': 'পাসওয়ার্ড ভুল।', 'auth/user-not-found': 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই।',
    'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করুন।', 'auth/network-request-failed': 'ইন্টারনেট সংযোগ নেই।', 'auth/invalid-email': 'ইমেইল ঠিকভাবে লিখুন।',
  }[e.code] || e.message);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'লগইন হচ্ছে…'; msg.textContent = '';
    try { await store.auth.login(form.email.value.trim(), form.pass.value); } catch (err) { msg.textContent = errText(err); btn.disabled = false; btn.textContent = 'লগইন'; }
  });
  document.getElementById('forgot').onclick = async () => {
    const email = form.email.value.trim();
    if (!email) { msg.textContent = 'আগে ইমেইল লিখুন, তারপর এই বাটন চাপুন।'; return; }
    try { await store.auth.reset(email); msg.textContent = 'পাসওয়ার্ড রিসেটের লিংক ইমেইলে পাঠানো হয়েছে।'; } catch (err) { msg.textContent = errText(err); }
  };
}

// ---------- শেল ----------
let user = null;
let current = null; // { id, mod }
let C = null;
let dirty = true;
let firstPaint = true;
const getC = () => { if (dirty || !C) { C = compute(store.getState()); dirty = false; } return C; };

function shellHtml() {
  const side = NAV.map((g) => `<div class="nav-group"><span>${esc(g.group)}</span>${g.items.map((i) => `<a class="nav-link" href="#/${i.id}" data-nav="${i.id}">${icon(i.icon)}<span>${esc(i.label)}</span><span class="badge" data-badge="${i.id}" hidden></span></a>`).join('')}</div>`).join('');
  return `<div class="app">
    <aside class="side" aria-label="মেনু"><div class="brand">${LOGO}<div><b id="biz-name">Namaari</b><small>ব্যবসার খাতা</small></div></div>${side}</aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn only-mobile" data-back hidden aria-label="পেছনে">${icon('back')}</button>
        <h1 id="page-title">হোম</h1>
        <span class="sync" id="sync" title="সিঙ্ক অবস্থা"></span>
        <button class="icon-btn" id="theme-btn" aria-label="থিম বদলান"></button>
        <button class="btn primary sm only-desktop" id="quick-desk">${icon('plus')}নতুন</button>
      </header>
      <main class="view" id="view" tabindex="-1"></main>
    </div>
    <nav class="bottom-nav" aria-label="প্রধান মেনু">
      <a href="#/dashboard" data-nav="dashboard">${icon('home')}হোম</a>
      <a href="#/sales" data-nav="sales">${icon('bag')}অর্ডার</a>
      <button class="fab" id="quick" aria-label="নতুন এন্ট্রি">${icon('plus')}</button>
      <a href="#/activity" data-nav="activity">${icon('checklist')}আজকের কাজ</a>
      <a href="#/more" data-nav="more">${icon('grid')}সব</a>
    </nav>
  </div>`;
}

const ctx = () => ({
  S: store.getState(), C: getC(), getC, user, install, firstPaint,
  rerender, setTheme, promptInstall, logout,
  go: (r) => { location.hash = '#/' + r; },
});

function route() {
  const id = (location.hash.replace(/^#\/?/, '').split('/')[0]) || 'dashboard';
  const mod = VIEWS[id] || dashboard;
  if (current && current.mod.unmount) current.mod.unmount();
  current = { id: VIEWS[id] ? id : 'dashboard', mod };
  paint(true);
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === current.id || (current.id === 'more' && false)));
  const back = document.querySelector('[data-back]');
  const inBottom = ['dashboard', 'sales', 'activity', 'more'].includes(current.id);
  if (back) back.hidden = inBottom;
  scrollTo({ top: 0 });
}

function paint(animate = false) {
  const view = document.getElementById('view');
  if (!view || !current) return;
  const S = store.getState();
  if (!S.ready) { view.innerHTML = `<div class="loader">${LOGO}</div>`; return; }
  const c = ctx();
  const mod = current.mod;
  // আগের রিং অবস্থান মনে রাখি যাতে আপডেটে রিং লাফ না দেয়
  const prevRings = [...view.querySelectorAll('.ring .fg')].map((x) => x.style.strokeDashoffset);
  if (mod.unmount && !animate) mod.unmount();
  document.getElementById('page-title').textContent = mod.title || '';
  // প্রতিবার নতুন র‍্যাপার — যাতে পুরোনো ইভেন্ট লিসেনার জমে না থাকে
  const wrap = document.createElement('div');
  wrap.innerHTML = mod.render(c);
  view.replaceChildren(wrap);
  if (animate) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
  mod.mount && mod.mount(wrap, c);
  view.querySelectorAll('.ring .fg').forEach((el, i) => {
    if (!animate && prevRings[i]) el.style.strokeDashoffset = prevRings[i];
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.strokeDashoffset = el.dataset.offset; }));
  });
  firstPaint = false;
  updateBadges();
}

let pendingRerender = false;
function rerender() {
  const view = document.getElementById('view');
  const a = document.activeElement;
  // কেউ টাইপ করছে? তাহলে ফোকাস হারানোর পরে রিফ্রেশ করি
  if (view && a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox') {
    if (!pendingRerender) { pendingRerender = true; a.addEventListener('blur', () => { pendingRerender = false; setTimeout(() => paint(false), 50); }, { once: true }); }
    return;
  }
  paint(false);
}

function updateBadges() {
  const c = getC();
  const set = (id, n) => { const b = document.querySelector(`[data-badge="${id}"]`); if (b) { b.hidden = !n; b.textContent = n; } };
  set('sales', c.kpi.pendingOrders);
  set('inventory', c.kpi.lowStock);
  document.getElementById('biz-name').textContent = store.getState().settings.name || 'Namaari';
  const tb = document.getElementById('theme-btn');
  if (tb) tb.innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon');
}

function quickAdd() {
  const c = ctx();
  const items = [
    ['bag', 'নতুন অর্ডার', () => sales.openOrderForm(c)],
    ['receipt', 'খরচ', () => expenses.openExpenseForm(c)],
    ['truck', 'ক্রয়', () => purchases.openPurchaseForm(c)],
    ['megaphone', 'পোস্ট লগ', () => openPostForm(c, null, { status: 'posted' })],
    ['users', 'কাস্টমার', () => openCustomerForm(c)],
    ['layers', 'পণ্য', () => openProductForm(c)],
    ['wallet', 'ক্যাশ এন্ট্রি', () => openLedgerForm(c)],
  ];
  openSheet({
    title: 'নতুন এন্ট্রি',
    body: `<div class="quick-grid">${items.map(([ic, l], i) => `<button data-q="${i}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>`,
    onMount: (el, close) => el.querySelector('.quick-grid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      close(); setTimeout(items[Number(b.dataset.q)][2], 280);
    }),
  });
}

async function logout() {
  stopReminders(); store.stopData(); await store.auth.logout(); user = null; location.hash = ''; renderLogin();
}

function renderShell() {
  app.innerHTML = shellHtml();
  document.getElementById('quick').onclick = quickAdd;
  document.getElementById('quick-desk').onclick = quickAdd;
  document.getElementById('theme-btn').onclick = () => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); updateBadges(); paint(false); };
  document.querySelector('[data-back]').onclick = () => { if (!closeTopSheet()) history.length > 1 ? history.back() : (location.hash = '#/dashboard'); };
  const sync = document.getElementById('sync');
  const net = () => { sync.classList.toggle('off', !navigator.onLine); sync.title = navigator.onLine ? (store.isLocal() ? 'লোকাল মোড' : 'অনলাইন — সিঙ্ক চালু') : 'অফলাইন — পরে সিঙ্ক হবে'; };
  addEventListener('online', net); addEventListener('offline', net); net();
}

let unsubData = null;
let booted = false;
async function boot() {
  if (!booted) {
    booted = true;
    addEventListener('hashchange', () => user && route());
    store.onError((e) => {
      console.error(e);
      if (e && e.code === 'permission-denied') toast('অনুমতি নেই — Firestore rules এ আপনার ইমেইল যোগ করুন (README দেখুন)', 'err');
      else toast(e?.message || 'কিছু একটা সমস্যা হয়েছে', 'err');
    });
  }
  store.auth.watch(async (u) => {
    user = u;
    if (!u) { store.stopData(); renderLogin(); return; }
    renderShell();
    if (unsubData) unsubData();
    unsubData = store.onData(() => { dirty = true; store.ensureDefaults(); rerender(); });
    route();
    await store.startData();
    startReminders(store.getState, (r, body) => toast(`🔔 ${r.title} — ${body}`));
  });
}
boot();
