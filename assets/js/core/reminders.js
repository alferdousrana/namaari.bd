// রিমাইন্ডার ইঞ্জিন
// • অ্যাপ খোলা থাকলে (বা ব্যাকগ্রাউন্ডে ট্যাব চালু থাকলে) সময়মতো নোটিফিকেশন দেয়
// • অ্যাপ বন্ধ থাকলে ব্রাউজার নিজে থেকে নোটিফিকেশন দিতে পারে না (সার্ভার লাগে),
//   তাই নিশ্চিত রিমাইন্ডারের জন্য .ics ফাইল দিয়ে ফোনের ক্যালেন্ডারে যোগ করার ব্যবস্থা আছে
import { today, ymd } from './utils.js';

const firedKey = (id, date) => `namaari_fired_${id}_${date}`;
let timer = null;

export const notifSupported = () => 'Notification' in window;
export const notifPermission = () => (notifSupported() ? Notification.permission : 'unsupported');
export async function askPermission() {
  if (!notifSupported()) return 'unsupported';
  return Notification.requestPermission();
}

export async function notify(title, body, tag = 'namaari') {
  if (notifPermission() !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, tag, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', vibrate: [120, 60, 120], data: { url: './#/activity' } };
    if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
    return true;
  } catch { return false; }
}

const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };

// আজকের রিমাইন্ডারগুলোর অবস্থা
export function todayReminders(state) {
  const now = new Date();
  const d = today();
  const mins = now.getHours() * 60 + now.getMinutes();
  return (state.reminders || []).filter((r) => r.active !== false && (r.days || []).includes(now.getDay()))
    .map((r) => ({ ...r, mins: toMin(r.time), passed: mins >= toMin(r.time), fired: !!localStorage.getItem(firedKey(r.id, d)) }))
    .sort((a, b) => a.mins - b.mins);
}

export function startReminders(getState, onFire) {
  stopReminders();
  const tick = () => {
    const S = getState();
    if (!S.ready) return;
    const d = today();
    const mins = new Date().getHours() * 60 + new Date().getMinutes();
    const postsToday = (S.posts || []).filter((p) => p.date === d && p.status === 'posted').length;
    const target = S.settings?.social?.dailyTarget || 0;
    for (const r of todayReminders(S)) {
      // সময় পার হয়েছে, এখনো দেখানো হয়নি, আর সময় পার হয়েছে ২ ঘণ্টার কম
      if (!r.passed || r.fired || mins - r.mins > 120) continue;
      localStorage.setItem(firedKey(r.id, d), '1');
      if (r.kind === 'post' && target && postsToday >= target) continue; // আজকের পোস্টের টার্গেট পূরণ — বিরক্ত করব না
      const body = r.kind === 'post' ? `আজ ${postsToday}/${target}টি পোস্ট হয়েছে। এখনই একটি পোস্ট দিন।` : (r.note || 'Namaari — আজকের কাজ');
      notify(r.title, body, r.id);
      onFire && onFire(r, body);
    }
  };
  tick();
  timer = setInterval(tick, 30 * 1000);
  document.addEventListener('visibilitychange', tick);
}
export function stopReminders() { if (timer) clearInterval(timer); timer = null; }

// ক্যালেন্ডার (.ics) — Google Calendar / iPhone Calendar এ ইমপোর্ট করলে অ্যাপ বন্ধ থাকলেও অ্যালার্ম বাজবে
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const icsEsc = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
export function buildICS(reminders, bizName = 'Namaari') {
  const d = ymd().replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev = reminders.filter((r) => r.active !== false).map((r) => {
    const [h, m] = String(r.time).split(':');
    const days = (r.days || []).map((x) => BYDAY[x]).join(',');
    return [
      'BEGIN:VEVENT', `UID:${r.id}@namaari-erp`, `DTSTAMP:${stamp}`,
      `DTSTART:${d}T${String(h).padStart(2, '0')}${String(m || 0).padStart(2, '0')}00`, 'DURATION:PT15M',
      `RRULE:FREQ=WEEKLY;BYDAY=${days || BYDAY.join(',')}`,
      `SUMMARY:${icsEsc(`${bizName}: ${r.title}`)}`, `DESCRIPTION:${icsEsc(r.note || 'Namaari ERP রিমাইন্ডার')}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(r.title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT',
    ].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Namaari ERP//BN', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n');
}
