import { esc, money, num, toNum, today, fmtDate, addDays, parseYMD, BN_DAYS, uid, sum } from '../core/utils.js';
import * as store from '../core/store.js';
import { icon, openSheet, toast, confirmBox, field, input, select, textarea, readForm, empty, options, pill } from '../ui/components.js';
import { askPermission, notifPermission, todayReminders, buildICS, notify } from '../core/reminders.js';
import { downloadBlob } from './shared.js';

// ---------- সাধারণ হিসাব ----------
export function dayDoc(S, date) { return S.activities.find((a) => a.id === `day-${date}`) || { id: `day-${date}`, date, done: {}, tasks: [], note: '' }; }
export function dayScore(S, date) {
  const d = dayDoc(S, date);
  const routine = Object.values(d.done || {}).filter(Boolean).length;
  const tasks = (d.tasks || []).filter((t) => t.done).length;
  const posts = S.posts.filter((p) => p.date === date && p.status === 'posted').length;
  return { routine, tasks, posts, total: routine + tasks + posts };
}
export function routineProgress(S, date = today()) {
  const d = dayDoc(S, date);
  const items = S.settings.routine || [];
  const done = items.filter((r) => d.done?.[r.id]).length;
  return { done, total: items.length, pct: items.length ? done / items.length : 0 };
}
export function postStreak(S) {
  const days = new Set(S.posts.filter((p) => p.status === 'posted').map((p) => p.date));
  let d = today();
  if (!days.has(d)) d = addDays(d, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
const postsOn = (S, date) => S.posts.filter((p) => p.date === date && p.status === 'posted').length;

const IDEAS = [
  'নতুন কালেকশনের রিল — কাপড়ের ক্লোজআপ সহ', 'কাস্টমার রিভিউ / ফিডব্যাক স্ক্রিনশট', 'সাইজ গাইড — কোন সাইজ কার জন্য',
  '"লাস্ট পিস" — যেগুলো ১টি করে বাকি', 'প্যাকিংয়ের বিহাইন্ড দ্য সিন ভিডিও', 'একটি থ্রি-পিস ৩ ভাবে স্টাইল করা',
  'কাপড়ের ধরন ও যত্ন নেওয়ার টিপস', 'আজকের ডেলিভারি — কোথায় কোথায় গেল', 'লাইভ — নতুন মাল দেখানো', 'কাস্টমারের প্রশ্নের উত্তর (FAQ) পোস্ট',
];

// ======================= মার্কেটিং =======================
let mk = { tab: 'log' };
export const marketing = {
  title: 'সোশ্যাল মিডিয়া',
  render({ S, C }) {
    const t = today();
    const target = S.settings.social.dailyTarget || 0;
    const todayN = postsOn(S, t);
    const since30 = addDays(t, -29);
    const recent = S.posts.filter((p) => p.status === 'posted' && p.date >= since30);
    const byPlat = {};
    for (const p of recent) byPlat[p.platform] = (byPlat[p.platform] || 0) + 1;
    const maxPl = Math.max(1, ...Object.values(byPlat));
    const week = S.posts.filter((p) => p.status === 'posted' && p.date >= addDays(t, -6)).length;
    const planned = S.posts.filter((p) => p.status === 'planned').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const history = S.posts.filter((p) => p.status === 'posted').sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));
    // কোন পণ্য নিয়ে অনেকদিন পোস্ট হয়নি অথচ স্টকে আছে
    const lastPost = {};
    for (const p of S.posts) for (const pid of p.productIds || []) if (!lastPost[pid] || p.date > lastPost[pid]) lastPost[pid] = p.date;
    const suggest = S.products.map((p) => ({ p, stock: sum(C.inventory.filter((r) => r.productId === p.id), (r) => r.onHand), last: lastPost[p.id] || '' }))
      .filter((x) => x.stock > 0).sort((a, b) => (a.last || '').localeCompare(b.last || '') || b.stock - a.stock).slice(0, 4);
    const idea = IDEAS[parseYMD(t).getDate() % IDEAS.length];
    return `
      <div class="hero" style="margin-bottom:16px">
        <div class="hero-top"><div><h2>আজকের পোস্ট</h2><div class="date">${todayN} / ${target} টার্গেট · টানা ${postStreak(S)} দিন</div></div>
        ${ring(target ? Math.min(1, todayN / target) : 0, `${todayN}/${target}`)}</div>
        <div class="actions" style="position:relative;z-index:1"><button class="btn accent" data-posted>${icon('check')}পোস্ট করেছি — লগ করুন</button><button class="btn ghost" style="color:inherit;border-color:currentColor" data-plan>${icon('calendar')}পরিকল্পনা</button></div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>এই সপ্তাহে পোস্ট</span><b>${week}</b></div>
        <div class="kpi"><span>৩০ দিনে পোস্ট</span><b>${recent.length}</b></div>
        <div class="kpi"><span>৩০ দিনে ইনবক্স মেসেজ</span><b>${num(sum(recent, (p) => p.messages))}</b></div>
        <div class="kpi"><span>৩০ দিনে পোস্ট থেকে অর্ডার</span><b>${num(sum(recent, (p) => p.orders))}</b></div>
      </div>
      <div class="dash-grid">
        <div>
          <div class="tabs"><button class="${mk.tab === 'log' ? 'on' : ''}" data-tab="log">পোস্ট লগ</button><button class="${mk.tab === 'plan' ? 'on' : ''}" data-tab="plan">পরিকল্পিত <span class="badge">${planned.length}</span></button></div>
          <div class="list">${(mk.tab === 'log' ? history.slice(0, 60) : planned).map((p) => postItem(S, p)).join('') || empty(mk.tab === 'log' ? 'এখনো কোনো পোস্ট লগ নেই' : 'কোনো পরিকল্পনা নেই', mk.tab === 'log' ? 'পোস্ট দেওয়ার পর এখানে লিখে রাখুন — রিচ, মেসেজ, অর্ডার ট্র্যাক হবে।' : 'আগামী দিনের পোস্ট আগে থেকে ঠিক করে রাখুন।')}</div>
        </div>
        <div>
          <div class="panel"><div class="panel-head"><h3>আজকের আইডিয়া</h3></div><p>${esc(idea)}</p></div>
          ${suggest.length ? `<div class="panel"><div class="panel-head"><h3>এগুলো নিয়ে পোস্ট দিন</h3></div><div class="acc-list">${suggest.map((x) => `<div class="acc-row"><span>${esc(x.p.name)}</span><small class="muted">${x.last ? 'শেষ পোস্ট ' + fmtDate(x.last) : 'কখনো পোস্ট হয়নি'}</small><b>${num(x.stock)} পিস</b></div>`).join('')}</div></div>` : ''}
          <div class="panel"><div class="panel-head"><h3>প্ল্যাটফর্ম (৩০ দিন)</h3></div>${Object.keys(byPlat).length ? `<div class="bars">${Object.entries(byPlat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="bar-row"><span>${esc(k)}</span><div class="track"><div class="fill" style="width:${(v / maxPl) * 100}%"></div></div><b>${v}</b></div>`).join('')}</div>` : '<p class="muted">ডেটা নেই</p>'}</div>
        </div>
      </div>`;
  },
  mount(root, ctx) {
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { mk.tab = t.dataset.tab; ctx.rerender(); return; }
      if (e.target.closest('[data-posted]')) return openPostForm(ctx, null, { status: 'posted' });
      if (e.target.closest('[data-plan]')) return openPostForm(ctx, null, { status: 'planned', date: addDays(today(), 1) });
      const done = e.target.closest('[data-markdone]');
      if (done) { const p = ctx.S.posts.find((x) => x.id === done.dataset.markdone); store.save('posts', { ...p, status: 'posted', date: today() }); toast('পোস্ট হয়েছে হিসেবে চিহ্নিত'); return; }
      const it = e.target.closest('[data-post]');
      if (it) openPostForm(ctx, it.dataset.post);
    });
  },
};
function postItem(S, p) {
  const prods = (p.productIds || []).map((id) => S.products.find((x) => x.id === id)?.name).filter(Boolean);
  return `<div class="item" data-post="${esc(p.id)}"><div class="avatar ${p.status === 'posted' ? 'good' : 'accent'}">${icon(p.status === 'posted' ? 'megaphone' : 'calendar')}</div>
    <div class="main-col"><div class="t">${esc(p.topic || p.type)} ${pill(p.platform, 'brand')}</div>
    <div class="s">${fmtDate(p.date)}${p.time ? ' ' + esc(p.time) : ''} · ${esc(p.type)}${prods.length ? ' · ' + esc(prods.join(', ')) : ''}</div></div>
    <div class="r">${p.status === 'posted' ? `<small class="muted">রিচ ${num(p.reach)} · মেসেজ ${num(p.messages)} · অর্ডার ${num(p.orders)}</small>` : `<button class="btn sm primary" data-markdone="${esc(p.id)}">পোস্ট করেছি</button>`}</div></div>`;
}
export function openPostForm(ctx, id, preset = {}) {
  const { S } = ctx;
  const L = S.settings.lists;
  const p = id ? S.posts.find((x) => x.id === id) : null;
  const now = new Date();
  const d = p || { date: today(), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, platform: L.platforms[0], type: L.postTypes[0], status: 'posted', productIds: [], ...preset };
  openSheet({
    title: p ? 'পোস্ট এডিট' : d.status === 'planned' ? 'পোস্টের পরিকল্পনা' : 'পোস্ট লগ করুন', wide: true,
    body: `<form class="form" id="pf"><div class="grid-2">
      ${field('প্ল্যাটফর্ম', select('platform', L.platforms, d.platform))}
      ${field('ধরন', select('type', L.postTypes, d.type))}
      ${field('তারিখ', input('date', d.date, 'type="date"'))}
      ${field('সময়', input('time', d.time || '', 'type="time"'))}
      ${field('বিষয় / ক্যাপশন', input('topic', d.topic || '', 'placeholder="যেমন: নতুন বাটিক কালেকশন রিল"'), { cls: 'span-2' })}
      ${field('কোন পণ্য নিয়ে', `<select name="productIds" multiple size="4">${S.products.map((x) => `<option value="${esc(x.id)}" ${(d.productIds || []).includes(x.id) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`, { cls: 'span-2', hint: 'একাধিক বাছাই করতে Ctrl/লং-প্রেস' })}
      ${field('লিংক', input('link', d.link || '', 'type="url" placeholder="https://"'), { cls: 'span-2' })}
      ${field('স্ট্যাটাস', `<select name="status">${options([{ value: 'posted', label: 'পোস্ট হয়ে গেছে' }, { value: 'planned', label: 'পরিকল্পিত' }], d.status)}</select>`, { cls: 'span-2' })}
    </div>
    <h3 style="font-size:15px">ফলাফল (পরে আপডেট করা যায়)</h3>
    <div class="grid-2">
      ${field('রিচ / ভিউ', input('reach', d.reach ?? '', 'type="number" min="0"'))}
      ${field('রিঅ্যাকশন', input('reactions', d.reactions ?? '', 'type="number" min="0"'))}
      ${field('কমেন্ট', input('comments', d.comments ?? '', 'type="number" min="0"'))}
      ${field('ইনবক্স মেসেজ', input('messages', d.messages ?? '', 'type="number" min="0"'))}
      ${field('এই পোস্ট থেকে অর্ডার', input('orders', d.orders ?? '', 'type="number" min="0"'))}
    </div>
    ${field('নোট', textarea('note', d.note || ''))}
    <p class="hint">বুস্টের টাকা "খরচ" এ Facebook Boost ক্যাটাগরিতে লিখুন।</p></form>`,
    footer: `${p ? `<button class="btn ghost" data-del>${icon('trash')}</button>` : ''}<button class="btn primary" data-save>সেভ করুন</button>`,
    onMount: (el, close) => {
      el.querySelector('[data-save]').addEventListener('click', () => {
        const form = el.querySelector('#pf');
        const f = readForm(form);
        f.productIds = [...form.querySelector('[name=productIds]').selectedOptions].map((o) => o.value);
        for (const k of ['reach', 'reactions', 'comments', 'messages', 'orders']) f[k] = toNum(f[k]);
        store.save('posts', { ...(p || {}), ...f });
        close(); toast(f.status === 'posted' ? 'পোস্ট লগ হয়েছে' : 'পরিকল্পনা সেভ হয়েছে');
      });
      el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmBox('এই পোস্ট লগ মুছবেন?')) { store.remove('posts', p.id); close(); } });
    },
  });
}

// ======================= আজকের কাজ / অ্যাক্টিভিটি =======================
let actDate = today();
export const activity = {
  title: 'আজকের কাজ',
  render({ S }) {
    const d = dayDoc(S, actDate);
    const prog = routineProgress(S, actDate);
    const sc = dayScore(S, actDate);
    const isToday = actDate === today();
    const dt = parseYMD(actDate);
    const rems = todayReminders(S);
    const perm = notifPermission();
    return `
      <div class="hero">
        <div class="hero-top">
          <div><h2>${isToday ? 'আজকের রুটিন' : fmtDate(actDate)}</h2><div class="date">${BN_DAYS[dt.getDay()]}বার · ${sc.total} কাজ সম্পন্ন · ${sc.posts} পোস্ট</div></div>
          ${ring(prog.pct, `${prog.done}/${prog.total}`)}
        </div>
        <div class="actions" style="position:relative;z-index:1">
          <button class="btn sm ghost" style="color:inherit;border-color:currentColor" data-day="-1" aria-label="আগের দিন">${icon('back')}</button>
          ${!isToday ? '<button class="btn sm accent" data-day="0">আজ</button>' : ''}
          <button class="btn sm ghost" style="color:inherit;border-color:currentColor" data-day="1" aria-label="পরের দিন" ${isToday ? 'disabled' : ''}>${icon('chev')}</button>
        </div>
      </div>
      <div class="dash-grid">
        <div>
          <div class="list" style="margin-top:4px">
            ${(S.settings.routine || []).map((r) => `<div class="check ${d.done?.[r.id] ? 'done' : ''}" data-routine="${esc(r.id)}" role="checkbox" aria-checked="${!!d.done?.[r.id]}" tabindex="0"><span class="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5L20 7"/></svg></span><span class="label">${esc(r.title)}</span></div>`).join('')}
            ${(d.tasks || []).map((t) => `<div class="check ${t.done ? 'done' : ''}" data-task="${esc(t.id)}" role="checkbox" aria-checked="${!!t.done}" tabindex="0"><span class="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5L20 7"/></svg></span><span class="label">${esc(t.title)}</span><button class="icon-btn" data-deltask="${esc(t.id)}" aria-label="মুছুন">${icon('x')}</button></div>`).join('')}
          </div>
          <form class="toolbar" id="task-add" style="margin-top:10px"><input name="title" placeholder="আজকের বাড়তি কোনো কাজ যোগ করুন" style="flex:1"><button class="btn primary" type="submit">${icon('plus')}</button></form>
          ${field('দিনের নোট / কী শিখলাম', `<textarea id="day-note" rows="3" placeholder="আজ কী ভালো হলো, কী উন্নতি দরকার…">${esc(d.note || '')}</textarea>`)}
        </div>
        <div>
          <div class="panel"><div class="panel-head"><h3>গত ১৮ সপ্তাহ</h3><div class="streak">${icon('flame')}<b>${postStreak(S)}</b><small class="muted">দিন টানা পোস্ট</small></div></div>
            ${heatmap(S)}
            <div class="legend">কম <i style="background:var(--surface-2)"></i><i style="background:color-mix(in srgb,var(--good) 30%,var(--surface-2))"></i><i style="background:color-mix(in srgb,var(--good) 55%,var(--surface-2))"></i><i style="background:color-mix(in srgb,var(--good) 80%,var(--surface-2))"></i><i style="background:var(--good)"></i> বেশি</div>
          </div>
          <div class="panel">
            <div class="panel-head"><h3>রিমাইন্ডার</h3><button class="btn sm ghost" data-newrem>${icon('plus')}নতুন</button></div>
            ${perm !== 'granted' ? `<div class="banner">${icon('bell')}<p>${perm === 'denied' ? 'নোটিফিকেশন ব্লক করা আছে। ব্রাউজারের সাইট সেটিংস থেকে চালু করুন।' : perm === 'unsupported' ? 'এই ব্রাউজারে নোটিফিকেশন নেই। iPhone এ আগে "Add to Home Screen" করুন।' : 'সময়মতো মনে করিয়ে দিতে নোটিফিকেশন চালু করুন।'}</p>${perm === 'default' ? '<button class="btn sm primary" data-perm>চালু করুন</button>' : ''}</div>` : ''}
            <div class="list">${S.reminders.sort((a, b) => String(a.time).localeCompare(String(b.time))).map((r) => {
              const tr = rems.find((x) => x.id === r.id);
              return `<div class="item" data-rem="${esc(r.id)}"><div class="avatar ${r.active === false ? '' : 'accent'}">${icon('bell')}</div><div class="main-col"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.time)} · ${(r.days || []).length === 7 ? 'প্রতিদিন' : (r.days || []).map((x) => BN_DAYS[x]).join(', ')}${tr ? (tr.fired ? ' · আজ দেখানো হয়েছে' : tr.passed ? '' : ' · আজ বাকি') : ''}</div></div>
                <label class="pill ${r.active === false ? '' : 'good'}" style="cursor:pointer"><input type="checkbox" class="sr-only" data-toggle="${esc(r.id)}" ${r.active === false ? '' : 'checked'}>${r.active === false ? 'বন্ধ' : 'চালু'}</label></div>`;
            }).join('') || '<p class="muted">কোনো রিমাইন্ডার নেই</p>'}</div>
            <div class="actions"><button class="btn sm ghost" data-ics>${icon('calendar')}ফোনের ক্যালেন্ডারে যোগ করুন</button><button class="btn sm ghost" data-test>${icon('bell')}টেস্ট নোটিফিকেশন</button></div>
            <p class="hint" style="margin-top:8px">অ্যাপ খোলা থাকলে সময়মতো নোটিফিকেশন আসবে। অ্যাপ বন্ধ থাকলেও নিশ্চিত অ্যালার্মের জন্য ক্যালেন্ডার ফাইলটি একবার ইমপোর্ট করে নিন।</p>
          </div>
        </div>
      </div>`;
  },
  mount(root, ctx) {
    const { S } = ctx;
    const saveDay = (patch) => { const d = dayDoc(S, actDate); store.save('activities', { ...d, ...patch, date: actDate }); };
    const toggle = (el) => {
      const d = dayDoc(S, actDate);
      if (el.dataset.routine) saveDay({ done: { ...(d.done || {}), [el.dataset.routine]: !d.done?.[el.dataset.routine] } });
      if (el.dataset.task) saveDay({ tasks: (d.tasks || []).map((t) => (t.id === el.dataset.task ? { ...t, done: !t.done } : t)) });
      el.classList.toggle('done');
    };
    root.addEventListener('click', async (e) => {
      const dd = e.target.closest('[data-day]');
      if (dd) { const n = Number(dd.dataset.day); actDate = n === 0 ? today() : addDays(actDate, n); if (actDate > today()) actDate = today(); ctx.rerender(); return; }
      const del = e.target.closest('[data-deltask]');
      if (del) { e.stopPropagation(); const d = dayDoc(S, actDate); saveDay({ tasks: (d.tasks || []).filter((t) => t.id !== del.dataset.deltask) }); return; }
      const c = e.target.closest('[data-routine],[data-task]');
      if (c) return toggle(c);
      if (e.target.closest('[data-perm]')) { const r = await askPermission(); toast(r === 'granted' ? 'নোটিফিকেশন চালু হয়েছে' : 'অনুমতি দেওয়া হয়নি', r === 'granted' ? 'ok' : 'err'); ctx.rerender(); return; }
      if (e.target.closest('[data-test]')) { const ok = await notify('Namaari', 'নোটিফিকেশন ঠিকমতো কাজ করছে ✓'); if (!ok) toast('আগে নোটিফিকেশন চালু করুন', 'err'); return; }
      if (e.target.closest('[data-ics]')) { downloadBlob('namaari-reminders.ics', buildICS(S.reminders, S.settings.name), 'text/calendar'); toast('ফাইলটি খুলে ক্যালেন্ডারে যোগ করুন'); return; }
      if (e.target.closest('[data-newrem]')) return openReminderForm(ctx);
      if (e.target.closest('[data-toggle]')) return;
      const r = e.target.closest('[data-rem]');
      if (r) openReminderForm(ctx, r.dataset.rem);
    });
    root.addEventListener('change', (e) => {
      const t = e.target.closest('[data-toggle]');
      if (t) { const r = S.reminders.find((x) => x.id === t.dataset.toggle); store.save('reminders', { ...r, active: t.checked }); }
    });
    root.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && e.target.matches('[data-routine],[data-task]')) { e.preventDefault(); toggle(e.target); } });
    root.querySelector('#task-add').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = e.target.title.value.trim(); if (!v) return;
      const d = dayDoc(S, actDate); saveDay({ tasks: [...(d.tasks || []), { id: uid(), title: v, done: false }] });
    });
    let nt;
    root.querySelector('#day-note').addEventListener('input', (e) => { clearTimeout(nt); const v = e.target.value; nt = setTimeout(() => saveDay({ note: v }), 700); });
  },
};

function openReminderForm(ctx, id) {
  const r = id ? ctx.S.reminders.find((x) => x.id === id) : null;
  const d = r || { title: '', time: '12:00', days: [0, 1, 2, 3, 4, 5, 6], kind: 'post', active: true };
  openSheet({
    title: r ? 'রিমাইন্ডার এডিট' : 'নতুন রিমাইন্ডার',
    body: `<form class="form" id="rf">
      ${field('কী মনে করাবে', input('title', d.title, 'placeholder="যেমন: Instagram রিল দিন"'))}
      <div class="grid-2">${field('সময়', input('time', d.time, 'type="time"'))}${field('ধরন', `<select name="kind">${options([{ value: 'post', label: 'সোশ্যাল পোস্ট' }, { value: 'task', label: 'সাধারণ কাজ' }], d.kind)}</select>`, { hint: 'পোস্টের টার্গেট পূরণ হলে পোস্ট-রিমাইন্ডার আর আসবে না' })}</div>
      ${field('কোন দিন', `<div class="chips" style="flex-wrap:wrap">${BN_DAYS.map((n, i) => `<label class="chip ${d.days.includes(i) ? 'on' : ''}"><input type="checkbox" class="sr-only" data-dayck value="${i}" ${d.days.includes(i) ? 'checked' : ''}>${n}</label>`).join('')}</div>`)}
      ${field('নোট', input('note', d.note || ''))}
    </form>`,
    footer: `${r ? `<button class="btn ghost" data-del>${icon('trash')}</button>` : ''}<button class="btn primary" data-save>সেভ করুন</button>`,
    onMount: (el, close) => {
      const form = el.querySelector('#rf');
      form.addEventListener('change', (e) => { if (e.target.dataset.dayck !== undefined) e.target.closest('.chip').classList.toggle('on', e.target.checked); });
      el.querySelector('[data-save]').addEventListener('click', () => {
        const f = readForm(form);
        const days = [...form.querySelectorAll('[data-dayck]:checked')].map((i) => Number(i.value));
        if (!f.title || !f.time || !days.length) return toast('শিরোনাম, সময় ও দিন দিন', 'err');
        store.save('reminders', { ...(r || { active: true }), title: f.title, time: f.time, kind: f.kind, note: f.note, days });
        close(); toast('রিমাইন্ডার সেভ হয়েছে');
      });
      el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmBox('রিমাইন্ডার মুছবেন?')) { store.remove('reminders', r.id); close(); } });
    },
  });
}

export function ring(pct, label, sub = '') {
  const R = 32, Cc = 2 * Math.PI * R;
  return `<div class="ring" aria-label="${esc(label)}"><svg viewBox="0 0 76 76"><circle class="bg" cx="38" cy="38" r="${R}"/><circle class="fg" cx="38" cy="38" r="${R}" stroke-dasharray="${Cc}" stroke-dashoffset="${Cc}" data-offset="${Cc * (1 - pct)}"/></svg><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
}

function heatmap(S) {
  const t = today();
  const start = addDays(t, -(17 * 7 + parseYMD(t).getDay())); // রবিবার থেকে শুরু
  let html = '';
  for (let d = start; d <= t; d = addDays(d, 1)) {
    const s = dayScore(S, d).total;
    const l = s === 0 ? 0 : s <= 2 ? 1 : s <= 4 ? 2 : s <= 6 ? 3 : 4;
    html += `<i data-l="${l}" class="${d === t ? 'today' : ''}" title="${fmtDate(d)}: ${s} কাজ"></i>`;
  }
  return `<div class="heat" role="img" aria-label="দৈনিক কাজের হিটম্যাপ">${html}</div>`;
}
