// ছোট ছোট সাহায্যকারী ফাংশন — পুরো অ্যাপ জুড়ে ব্যবহার হয়
export const CUR = '৳';

const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export const num = (v) => nf.format(Math.round((Number(v) || 0) * 100) / 100);
export const money = (v) => {
  const n = Number(v) || 0;
  return (n < 0 ? '-' : '') + CUR + nf.format(Math.abs(Math.round(n)));
};
export const toNum = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[৳,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);

// তারিখ — সবসময় 'YYYY-MM-DD' স্ট্রিং হিসেবে রাখা হয় (টাইমজোন ঝামেলা এড়াতে)
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const monthKey = (s) => (s || '').slice(0, 7);
export const parseYMD = (s) => {
  const [y, m, d] = (s || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDays = (s, n) => { const d = parseYMD(s); d.setDate(d.getDate() + n); return ymd(d); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (s) => {
  if (!s) return '';
  const d = parseYMD(s);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
export const fmtMonth = (k) => {
  if (!k) return '';
  const [y, m] = k.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const lastMonths = (n, from = today()) => {
  const d = parseYMD(from); d.setDate(1);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`);
  }
  return out;
};
export const BN_DAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// কোড জেনারেটর: SO-0007, PRD-012 ইত্যাদি
export function nextCode(prefix, existingCodes, width = 3) {
  let max = 0;
  for (const c of existingCodes) {
    const m = String(c || '').match(/(\d+)\s*$/);
    if (m && String(c).toUpperCase().startsWith(prefix.toUpperCase())) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(width, '0')}`;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const groupBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); (m[k] ||= []).push(x); return m; }, {});
export const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.code || '').localeCompare(a.code || '');
export const phoneClean = (p) => String(p || '').replace(/[^\d+]/g, '');
export const waNumber = (p) => { let x = phoneClean(p).replace(/^\+/, ''); if (x.startsWith('01')) x = '88' + x; return x; };
