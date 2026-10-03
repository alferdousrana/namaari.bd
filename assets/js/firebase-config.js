// ⚙️ Firebase Console → Project settings → Your apps → Web app থেকে কনফিগ কপি করে এখানে বসান।
// README.md তে ধাপে ধাপে লেখা আছে।
// apiKey ফাঁকা বা "PASTE" থাকলে অ্যাপ "লোকাল মোডে" চলবে (ডেটা শুধু এই ডিভাইসে থাকবে)।
export const firebaseConfig = {
  apiKey: "AIzaSyBe3YJ8EFAkynFY1n9M8FccrfPdu3b1o1c",
  authDomain: "namaari-c8185.firebaseapp.com",
  projectId: "namaari-c8185",
  storageBucket: "namaari-c8185.firebasestorage.app",
  messagingSenderId: "437834946442",
  appId: "1:437834946442:web:bf60174731e55d2efdda73",
  measurementId: "G-BF1M2XS4Z6",
};

// সব ডেটা Firestore এ businesses/{BUSINESS_ID}/... এর নিচে থাকবে
export const BUSINESS_ID = 'namaari';
