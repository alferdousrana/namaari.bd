import { esc, today, toNum, uid } from '../core/utils.js';
import * as store from '../core/store.js';
import { importWorkbook } from '../core/importer.js';
import { icon, openSheet, toast, confirmBox, field, input, readForm } from '../ui/components.js';
import { downloadBlob } from './shared.js';
import { NAV } from '../nav.js';

const LIST_LABELS = {
  categories: 'পণ্যের ক্যাটাগরি', sizes: 'সাইজ', colors: 'রং', payMethods: 'পেমেন্ট মাধ্যম / অ্যাকাউন্ট', channels: 'সেলস চ্যানেল',
  expenseCats: 'খরচের ক্যাটাগরি', couriers: 'কুরিয়ার', platforms: 'সোশ্যাল প্ল্যাটফর্ম', postTypes: 'পোস্টের ধরন',
};

export const settings = {
  title: 'সেটিংস',
  render({ S, user, install }) {
    const st = S.settings;
    const theme = localStorage.getItem('namaari_theme') || 'system';
    return `
      <div class="panel"><div class="panel-head"><h3>ব্যবসার তথ্য</h3></div>
        <form class="form" id="biz"><div class="grid-2">
          ${field('ব্যবসার নাম', input('name', st.name))}${field('মালিকের নাম', input('owner', st.owner))}
          ${field('ফোন', input('phone', st.phone, 'type="tel"'))}${field('ব্যবসা শুরুর তারিখ', input('startDate', st.startDate, 'type="date"'))}
          ${field('ঠিকানা', input('address', st.address), { cls: 'span-2' })}
          ${field('কম স্টকের সতর্কতা (পিস)', input('lowStock', st.lowStock, 'type="number" min="0"'), { hint: 'এর কম হলে "কম স্টক" দেখাবে' })}
          ${field('দৈনিক পোস্টের টার্গেট', input('dailyTarget', st.social.dailyTarget, 'type="number" min="0"'))}
          ${field('ইনভয়েসের নিচের লেখা', input('invoiceNote', st.invoiceNote), { cls: 'span-2' })}
        </div><button class="btn primary" type="submit">সেভ করুন</button></form></div>

      <div class="panel"><div class="panel-head"><h3>চেহারা</h3></div>
        <div class="chips">${[['light', 'লাইট'], ['dark', 'ডার্ক'], ['system', 'ফোনের মতো']].map(([k, l]) => `<button class="chip ${theme === k ? 'on' : ''}" data-theme-set="${k}">${l}</button>`).join('')}</div></div>

      <div class="panel"><div class="panel-head"><h3>লাভ-ক্ষতির নিয়ম</h3></div>
        <p class="hint" style="margin-bottom:10px">যেসব খরচ আসলে ব্যক্তিগত (বাজার, পরিবারের খরচ, লোন শোধ) সেগুলো ব্যবসার লাভ কমায় না — "মালিকের উত্তোলন" হিসেবে আলাদা দেখানো হয়। কোন ক্যাটাগরি ব্যক্তিগত তা বাছুন:</p>
        <div class="chips" style="flex-wrap:wrap" id="drawcats">${st.lists.expenseCats.map((c) => `<label class="chip ${st.drawingCats.includes(c) ? 'on' : ''}"><input type="checkbox" class="sr-only" value="${esc(c)}" ${st.drawingCats.includes(c) ? 'checked' : ''}>${esc(c)}</label>`).join('')}</div></div>

      <div class="panel"><div class="panel-head"><h3>প্রতিদিনের রুটিন</h3></div>
        <p class="hint" style="margin-bottom:8px">প্রতি লাইনে একটি কাজ। "আজকের কাজ" পাতায় প্রতিদিন চেকলিস্ট হিসেবে আসবে।</p>
        <textarea id="routine" rows="7">${esc(st.routine.map((r) => r.title).join('\n'))}</textarea>
        <button class="btn primary" style="margin-top:10px" data-save-routine>রুটিন সেভ করুন</button></div>

      <div class="panel"><div class="panel-head"><h3>ড্রপডাউন তালিকা</h3></div>
        <p class="hint" style="margin-bottom:10px">প্রতি লাইনে একটি। এক্সেলের "03_Lists" শীটের মতো।</p>
        <div class="grid-2" id="lists">${Object.entries(LIST_LABELS).map(([k, l]) => field(l, `<textarea data-list="${k}" rows="5">${esc((st.lists[k] || []).join('\n'))}</textarea>`)).join('')}</div>
        <button class="btn primary" style="margin-top:10px" data-save-lists>তালিকা সেভ করুন</button></div>

      <div class="panel"><div class="panel-head"><h3>ডেটা</h3>${store.isLocal() ? '<span class="pill warn">লোকাল মোড</span>' : '<span class="pill good">ক্লাউড সিঙ্ক</span>'}</div>
        ${store.isLocal() ? '<p class="hint" style="margin-bottom:10px">এখন ডেটা শুধু এই ব্রাউজারে আছে। Firebase সেটআপ করলে সব ডিভাইসে সিঙ্ক হবে — README দেখুন। সেটআপের পর এখান থেকে ব্যাকআপ নিয়ে ক্লাউডে ইমপোর্ট করতে পারবেন।</p>' : `<p class="hint" style="margin-bottom:10px">লগইন: ${esc(user?.email || '')} — ইন্টারনেট না থাকলেও কাজ করা যায়, পরে নিজে থেকে সিঙ্ক হবে।</p>`}
        <div class="actions">
          <label class="btn primary">${icon('upload')}এক্সেল থেকে ইমপোর্ট<input type="file" accept=".xlsx,.xls" hidden data-xlsx></label>
          <button class="btn ghost" data-export>${icon('download')}ব্যাকআপ ডাউনলোড (JSON)</button>
          <label class="btn ghost">${icon('upload')}ব্যাকআপ রিস্টোর<input type="file" accept=".json" hidden data-json></label>
        </div></div>

      <div class="panel"><div class="panel-head"><h3>অ্যাপ হিসেবে ইনস্টল</h3></div>
        ${install.available ? `<button class="btn accent" data-install>${icon('install')}ফোনে / কম্পিউটারে ইনস্টল করুন</button>` : install.installed ? '<p>অ্যাপ হিসেবে চালু আছে ✓</p>' : '<p class="hint"><b>Android (Chrome):</b> মেনু ⋮ → "Install app" / "Add to Home screen"।<br><b>iPhone (Safari):</b> Share বাটন → "Add to Home Screen"।</p>'}
      </div>

      <button class="btn ghost block" style="margin-top:16px" data-logout>${icon('logout')}লগআউট</button>
      <p class="hint" style="text-align:center;margin-top:12px">Namaari ERP · v1.0</p>`;
  },
  mount(root, ctx) {
    const { S } = ctx;
    root.querySelector('#biz').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = readForm(e.target);
      store.saveSettings({ name: f.name, owner: f.owner, phone: f.phone, startDate: f.startDate, address: f.address, lowStock: toNum(f.lowStock), invoiceNote: f.invoiceNote, social: { ...S.settings.social, dailyTarget: toNum(f.dailyTarget) } });
      toast('সেটিংস সেভ হয়েছে');
    });
    root.querySelector('#drawcats').addEventListener('change', (e) => {
      e.target.closest('.chip').classList.toggle('on', e.target.checked);
      store.saveSettings({ drawingCats: [...root.querySelectorAll('#drawcats input:checked')].map((i) => i.value) });
      toast('নিয়ম আপডেট হয়েছে');
    });
    root.querySelector('[data-save-routine]').addEventListener('click', () => {
      const old = S.settings.routine;
      const routine = root.querySelector('#routine').value.split('\n').map((s) => s.trim()).filter(Boolean)
        .map((title) => ({ id: old.find((r) => r.title === title)?.id || uid(), title }));
      store.saveSettings({ routine }); toast('রুটিন সেভ হয়েছে');
    });
    root.querySelector('[data-save-lists]').addEventListener('click', () => {
      const lists = { ...S.settings.lists };
      root.querySelectorAll('[data-list]').forEach((t) => { lists[t.dataset.list] = [...new Set(t.value.split('\n').map((s) => s.trim()).filter(Boolean))]; });
      store.saveSettings({ lists }); toast('তালিকা সেভ হয়েছে');
    });
    root.addEventListener('click', async (e) => {
      const th = e.target.closest('[data-theme-set]');
      if (th) { ctx.setTheme(th.dataset.themeSet); ctx.rerender(); return; }
      if (e.target.closest('[data-export]')) { downloadBlob(`namaari-backup-${today()}.json`, JSON.stringify(store.exportAll(), null, 1), 'application/json'); toast('ব্যাকআপ ডাউনলোড হয়েছে'); return; }
      if (e.target.closest('[data-install]')) return ctx.promptInstall();
      if (e.target.closest('[data-logout]')) { if (await confirmBox('লগআউট করবেন?', { ok: 'লগআউট', danger: false })) ctx.logout(); }
    });
    root.querySelector('[data-json]').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.app !== 'namaari-erp') throw new Error('এটি Namaari ব্যাকআপ ফাইল নয়');
        await confirmImport(data, [`পণ্য ${data.products?.length || 0}`, `অর্ডার ${data.sales?.length || 0}`, `খরচ ${data.expenses?.length || 0}`]);
      } catch (err) { toast(err.message || 'ফাইল পড়া যায়নি', 'err'); }
      e.target.value = '';
    });
    root.querySelector('[data-xlsx]').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        toast('এক্সেল পড়া হচ্ছে…');
        await loadSheetJS();
        const wb = window.XLSX.read(await file.arrayBuffer(), { cellDates: true });
        const sheets = {};
        for (const n of wb.SheetNames) sheets[n] = window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
        const { data, report } = importWorkbook(sheets);
        if (!data.products.length && !data.sales.length) throw new Error('ফাইলে চেনা শীট পাওয়া যায়নি');
        await confirmImport(data, report);
      } catch (err) { toast(err.message || 'এক্সেল পড়া যায়নি', 'err'); }
      e.target.value = '';
    });
  },
};

const BN_KEYS = { products: 'পণ্য', variants: 'সাইজ/রং', customers: 'কাস্টমার', suppliers: 'সাপ্লায়ার', sales: 'অর্ডার', purchases: 'ক্রয়', expenses: 'খরচ', ledger: 'ক্যাশবুক এন্ট্রি' };
function confirmImport(data, report) {
  return new Promise((resolve) => {
    openSheet({
      title: 'ইমপোর্ট নিশ্চিত করুন',
      body: `<p>যা পাওয়া গেছে:</p><div class="chips" style="flex-wrap:wrap;margin:10px 0">${report.map((r) => { const [k, n] = String(r).split(':'); return `<span class="chip">${esc(BN_KEYS[k?.trim()] || k)}${n !== undefined ? ': ' + esc(n) : ''}</span>`; }).join('')}</div>
        <p class="hint">"যোগ করুন" — একই কোডের ডেটা আপডেট হবে, বাকিগুলো থাকবে। "সব মুছে নতুন করে" — বর্তমান সব ডেটা মুছে শুধু ফাইলেরটা থাকবে। দুই ক্ষেত্রেই আগে ব্যাকআপ নিয়ে রাখা ভালো।</p>`,
      footer: '<button class="btn ghost" data-replace>সব মুছে নতুন করে</button><button class="btn primary" data-merge>যোগ করুন</button>',
      onMount: (el, close) => {
        const run = async (replace) => {
          el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          try { await store.importAll(data, { replace }); toast('ইমপোর্ট সম্পন্ন হয়েছে'); } catch (err) { toast(err.message || 'ইমপোর্ট ব্যর্থ', 'err'); }
          close(); resolve();
        };
        el.querySelector('[data-merge]').onclick = () => run(false);
        el.querySelector('[data-replace]').onclick = async () => { if (await confirmBox('বর্তমান সব ডেটা মুছে যাবে। নিশ্চিত?', { ok: 'হ্যাঁ, মুছে নতুন করে' })) run(true); };
      },
    });
  });
}
function loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = res; s.onerror = () => rej(new Error('ইন্টারনেট সংযোগ দরকার'));
    document.head.appendChild(s);
  });
}

// ======================= মোবাইলের "সব" মেনু =======================
export const more = {
  title: 'সব মেনু',
  render() {
    return NAV.map((g) => `<h3 style="font-size:14px;color:var(--muted);margin:16px 4px 8px">${esc(g.group)}</h3><div class="menu-grid">${g.items.map((i) => `<a href="#/${i.id}">${icon(i.icon)}<span>${esc(i.label)}</span></a>`).join('')}</div>`).join('');
  },
  mount() {},
};
