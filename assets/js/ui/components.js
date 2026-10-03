import { esc } from '../core/utils.js';

// ---------- আইকন (Lucide-স্টাইল লাইন আইকন) ----------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  bag: '<path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4.5L21 12.5V16h-8"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2Z"/><circle cx="16" cy="14.5" r="1.2"/>',
  chart: '<path d="M3 21h18"/><path d="M6 17V11"/><path d="M11 17V6"/><path d="M16 17v-4"/><path d="M20 17V8"/>',
  megaphone: '<path d="M3 10v4h3l7 4V6L6 10H3Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
  check: '<path d="m4.5 12.5 5 5L20 7"/>',
  checklist: '<path d="m3.5 6.5 2 2 3.5-4"/><path d="m3.5 15.5 2 2 3.5-4"/><path d="M12 7h9"/><path d="M12 16h9"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Z"/><path d="M10 21h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/>',
  chat: '<path d="M4 19.5 5.5 15A8 8 0 1 1 9 18.5L4 19.5Z"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 16V5"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17v.5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v.01M18 14.5v.01"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-1.5-2-1.5-3C7 10 6 12.5 6 15a6 6 0 0 0 6 6Z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v7m-3-3 3 3 3-3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

// ---------- Toast ----------
export function toast(msg, type = 'ok') {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon(type === 'err' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  host.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2600);
}

// ---------- Sheet (মোবাইলে নিচ থেকে, ডেস্কটপে মাঝে) ----------
let sheetStack = [];
export function openSheet({ title, body, footer = '', wide = false, onMount }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <section class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grip" aria-hidden="true"></div>
      <header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="বন্ধ করুন">${icon('x')}</button></header>
      <div class="sheet-body">${body}</div>
      ${footer ? `<footer class="sheet-foot">${footer}</footer>` : ''}
    </section>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    wrap.classList.remove('open');
    sheetStack = sheetStack.filter((x) => x !== close);
    if (!sheetStack.length) document.body.classList.remove('no-scroll');
    setTimeout(() => wrap.remove(), 280);
  };
  sheetStack.push(close);
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  const first = wrap.querySelector('input:not([type=hidden]):not([readonly]), select, textarea');
  if (first && window.matchMedia('(min-width: 760px)').matches) setTimeout(() => first.focus(), 250);
  onMount && onMount(wrap.querySelector('.sheet'), close);
  return close;
}
export const closeTopSheet = () => { const c = sheetStack[sheetStack.length - 1]; if (c) { c(); return true; } return false; };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTopSheet(); });

export function confirmBox(message, { ok = 'হ্যাঁ, মুছুন', danger = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const close = openSheet({
      title: 'নিশ্চিত করুন',
      body: `<p class="confirm-text">${esc(message)}</p>`,
      footer: `<button class="btn ghost" data-no>না</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button>`,
      onMount: (el, c) => {
        el.querySelector('[data-no]').onclick = () => { done = true; resolve(false); c(); };
        el.querySelector('[data-yes]').onclick = () => { done = true; resolve(true); c(); };
        el.closest('.sheet-wrap').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { if (!done) resolve(false); }));
      },
    });
    void close;
  });
}

// ---------- ফর্ম হেল্পার ----------
export const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(label ?? v)}</option>`;
export const options = (list, sel, { blank } = {}) => (blank !== undefined ? opt('', blank, sel) : '') + list.map((x) => (typeof x === 'object' ? opt(x.value, x.label, sel) : opt(x, x, sel))).join('');

export function field(label, inner, { hint = '', cls = '' } = {}) {
  return `<label class="field ${cls}"><span class="field-label">${esc(label)}</span>${inner}${hint ? `<small class="hint">${esc(hint)}</small>` : ''}</label>`;
}
export const input = (name, val = '', attrs = '') => `<input name="${name}" value="${esc(val)}" ${attrs}>`;
export const select = (name, list, val, attrs = '', blank) => `<select name="${name}" ${attrs}>${options(list, val, { blank })}</select>`;
export const textarea = (name, val = '', attrs = '') => `<textarea name="${name}" rows="2" ${attrs}>${esc(val)}</textarea>`;

export function readForm(root) {
  const o = {};
  root.querySelectorAll('[name]').forEach((el) => {
    if (el.closest('[data-row]')) return; // ডায়নামিক সারি আলাদা পড়া হয়
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'number') o[el.name] = el.value === '' ? '' : Number(el.value);
    else o[el.name] = el.value.trim();
  });
  return o;
}

export const empty = (title, text, action = '') => `<div class="empty"><div class="stitch-ring" aria-hidden="true"></div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
export const pill = (text, tone = '') => `<span class="pill ${tone}">${esc(text)}</span>`;
