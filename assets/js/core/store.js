// ডেটা লেয়ার: Firebase (অনলাইন + অফলাইন ক্যাশ) অথবা লোকাল মোড (শুধু এই ডিভাইস)
import { firebaseConfig, BUSINESS_ID } from '../firebase-config.js';
import { COLLECTIONS, DEFAULT_REMINDERS, mergeSettings } from './defaults.js';
import { uid } from './utils.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const firebaseReady = !!firebaseConfig.apiKey && !/PASTE/i.test(firebaseConfig.apiKey);

const state = { settings: mergeSettings({}), ready: false };
for (const c of COLLECTIONS) state[c] = [];
const listeners = new Set();
let notifyQueued = false;
const notify = () => {
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => { notifyQueued = false; listeners.forEach((fn) => fn(state)); });
};
export const onData = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getState = () => state;

let adapter = null;
let errorHandler = (e) => console.error(e);
export const onError = (fn) => { errorHandler = fn; };
const clean = (o) => JSON.parse(JSON.stringify(o)); // undefined বাদ দেয়

// ================= Firebase adapter =================
let fb = null; // { app, auth, db, mods }
async function loadFirebase() {
  if (fb) return fb;
  const [appM, authM, fsM] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js'),
  ]);
  const app = appM.initializeApp(firebaseConfig);
  const auth = authM.getAuth(app);
  let db;
  try {
    db = fsM.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }),
    });
  } catch { db = fsM.getFirestore(app); }
  fb = { app, auth, db, A: authM, F: fsM };
  return fb;
}

export const auth = {
  async watch(cb) {
    if (!firebaseReady) { cb(localStorage.getItem('namaari_local_session') ? { email: 'local@device', local: true } : null); return; }
    const { auth: a, A } = await loadFirebase();
    A.onAuthStateChanged(a, (u) => cb(u ? { email: u.email, uid: u.uid } : null));
  },
  async login(email, pass) {
    const { auth: a, A } = await loadFirebase();
    await A.signInWithEmailAndPassword(a, email, pass);
  },
  async reset(email) {
    const { auth: a, A } = await loadFirebase();
    await A.sendPasswordResetEmail(a, email);
  },
  startLocal() { localStorage.setItem('namaari_local_session', '1'); },
  async logout() {
    localStorage.removeItem('namaari_local_session');
    if (firebaseReady && fb) await fb.A.signOut(fb.auth);
  },
};

function firebaseAdapter() {
  const { db, F } = fb;
  const base = ['businesses', BUSINESS_ID];
  const col = (c) => F.collection(db, ...base, c);
  const unsubs = [];
  return {
    start() {
      let pending = COLLECTIONS.length + 1;
      const done = () => { if (--pending === 0) { state.ready = true; } notify(); };
      for (const c of COLLECTIONS) {
        let first = true;
        unsubs.push(F.onSnapshot(col(c), (snap) => {
          state[c] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          if (first) { first = false; done(); } else notify();
        }, (e) => { errorHandler(e); if (first) { first = false; done(); } }));
      }
      let firstS = true;
      unsubs.push(F.onSnapshot(F.doc(db, ...base, 'meta', 'settings'), (d) => {
        state.settings = mergeSettings(d.exists() ? d.data() : {});
        if (firstS) { firstS = false; done(); } else notify();
      }, (e) => { errorHandler(e); if (firstS) { firstS = false; done(); } }));
    },
    stop() { unsubs.splice(0).forEach((u) => u()); },
    save(c, o) { return F.setDoc(F.doc(db, ...base, c, o.id), clean(o)); },
    remove(c, id) { return F.deleteDoc(F.doc(db, ...base, c, id)); },
    saveSettings(s) { return F.setDoc(F.doc(db, ...base, 'meta', 'settings'), clean(s), { merge: true }); },
    async bulk(ops) { // ops: [{c, o}] or [{c, del:id}]
      for (let i = 0; i < ops.length; i += 400) {
        const b = F.writeBatch(db);
        for (const op of ops.slice(i, i + 400)) {
          if (op.del) b.delete(F.doc(db, ...base, op.c, op.del));
          else b.set(F.doc(db, ...base, op.c, op.o.id), clean(op.o));
        }
        await b.commit();
      }
    },
  };
}

// ================= Local adapter =================
function localAdapter() {
  const KEY = 'namaari_local_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  let data = load();
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { errorHandler(e); }
    for (const c of COLLECTIONS) state[c] = Object.values(data[c] || {});
    state.settings = mergeSettings(data.settings || {});
    notify();
  };
  return {
    start() { state.ready = true; persist(); },
    stop() {},
    async save(c, o) { (data[c] ||= {})[o.id] = clean(o); persist(); },
    async remove(c, id) { if (data[c]) delete data[c][id]; persist(); },
    async saveSettings(s) { data.settings = { ...(data.settings || {}), ...clean(s) }; persist(); },
    async bulk(ops) {
      for (const op of ops) {
        if (op.del) { if (data[op.c]) delete data[op.c][op.del]; } else (data[op.c] ||= {})[op.o.id] = clean(op.o);
      }
      persist();
    },
  };
}

// ================= Public API =================
export async function startData() {
  if (adapter) adapter.stop();
  if (firebaseReady) { await loadFirebase(); adapter = firebaseAdapter(); } else adapter = localAdapter();
  adapter.start();
}
export function stopData() { if (adapter) adapter.stop(); adapter = null; state.ready = false; }

// লেখা: অফলাইনে Firestore প্রমিস সার্ভার কনফার্ম না হওয়া পর্যন্ত অপেক্ষা করে,
// তাই UI কে আটকে রাখি না — লোকাল ক্যাশ সাথে সাথে আপডেট হয়।
const fire = (p) => { Promise.resolve(p).catch(errorHandler); };
export function save(c, o) { const obj = { ...o, id: o.id || uid(), updatedAt: Date.now() }; fire(adapter.save(c, obj)); return obj; }
export function remove(c, id) { fire(adapter.remove(c, id)); }
export function saveSettings(patch) { fire(adapter.saveSettings(patch)); }
export function bulk(ops) { const p = adapter.bulk(ops); p.catch(errorHandler); return p; }

export function ensureDefaults() {
  if (state.ready && !state.reminders.length && !localStorage.getItem('namaari_rem_seeded')) {
    localStorage.setItem('namaari_rem_seeded', '1');
    for (const r of DEFAULT_REMINDERS) save('reminders', r);
  }
}

export function exportAll() {
  const out = { app: 'namaari-erp', version: 1, exportedAt: new Date().toISOString(), settings: state.settings };
  for (const c of COLLECTIONS) out[c] = state[c];
  return out;
}
export async function importAll(data, { replace = false } = {}) {
  const ops = [];
  if (replace) for (const c of COLLECTIONS) for (const o of state[c]) ops.push({ c, del: o.id });
  for (const c of COLLECTIONS) for (const o of data[c] || []) ops.push({ c, o: { ...o, id: o.id || uid() } });
  await bulk(ops);
  if (data.settings) await adapter.saveSettings({ ...state.settings, ...data.settings, lists: { ...state.settings.lists, ...(data.settings.lists || {}) } });
}
export const isLocal = () => !firebaseReady;
