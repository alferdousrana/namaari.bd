// নতুন অ্যাকাউন্টের ডিফল্ট সেটিংস (এক্সেলের 03_Lists থেকে নেওয়া + নতুন কিছু)
export const DEFAULT_SETTINGS = {
  name: 'Namaari',
  owner: '',
  phone: '',
  address: 'ঢাকা, বাংলাদেশ',
  startDate: '',
  capital: 0,
  lowStock: 1,
  drawingCats: ['Personal Cost'],
  invoiceNote: 'Namaari থেকে কেনার জন্য ধন্যবাদ!',
  lists: {
    categories: ['Saree', 'Salwar Kameez', 'Three Piece', 'Kurti', 'Western Dress', 'Gown', 'Palazzo Set', 'Batik Three Piece', 'Arong Cotton Butiquies'],
    sizes: ['Free Size', 'Unstitch', '36', '38', '40', '42', '44', '46', '48'],
    colors: ['Red', 'Blue', 'Black', 'White', 'Green', 'Yellow', 'Pink', 'Eta Color', 'Beguni', 'Lamon', 'Multicolor', 'Others'],
    payMethods: ['Cash', 'bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Card'],
    channels: ['Facebook', 'Instagram', 'WhatsApp', 'TikTok', 'Offline', 'Website'],
    expenseCats: ['Courier', 'Packaging', 'Facebook Boost', 'Transport', 'Mobile Bill', 'Rent', 'Salary', 'Utility Bill', 'Food Bill', 'Banking charge', 'Personal Cost', 'Comission', 'Equipment', 'Subscription', 'Others'],
    couriers: ['Steadfast', 'Pathao', 'RedX', 'Sundarban', 'Hand Delivery'],
    platforms: ['Facebook Page', 'Facebook Group', 'Instagram', 'TikTok', 'WhatsApp Status', 'YouTube'],
    postTypes: ['Photo Post', 'Reel / Video', 'Story', 'Live', 'Boost / Ad', 'Carousel'],
  },
  social: { dailyTarget: 2 },
  // প্রতিদিনের রুটিন চেকলিস্ট — Activity পাতায় প্রতিদিন নতুন করে আসবে
  routine: [
    { id: 'r1', title: 'Facebook পেজে ১টি পোস্ট' },
    { id: 'r2', title: 'Instagram এ পোস্ট / রিল' },
    { id: 'r3', title: 'Story / Status আপডেট' },
    { id: 'r4', title: 'Inbox ও কমেন্টের রিপ্লাই' },
    { id: 'r5', title: 'পেন্ডিং অর্ডার কনফার্ম / প্যাকিং' },
    { id: 'r6', title: 'কাস্টমারের বাকি টাকার ফলো-আপ' },
    { id: 'r7', title: 'দিনের হিসাব এন্ট্রি (বিক্রি/খরচ)' },
  ],
};

export const DEFAULT_REMINDERS = [
  { id: 'rem-morning', title: 'সকালের পোস্ট দেওয়ার সময়', time: '11:00', days: [0, 1, 2, 3, 4, 5, 6], kind: 'post', active: true },
  { id: 'rem-evening', title: 'সন্ধ্যার রিল / লাইভ', time: '20:30', days: [0, 1, 2, 3, 4, 5, 6], kind: 'post', active: true },
  { id: 'rem-account', title: 'আজকের হিসাব লিখে ফেলুন', time: '22:30', days: [0, 1, 2, 3, 4, 5, 6], kind: 'task', active: true },
];

export const COLLECTIONS = ['products', 'variants', 'customers', 'suppliers', 'sales', 'purchases', 'expenses', 'ledger', 'adjustments', 'posts', 'activities', 'reminders'];

export function mergeSettings(s = {}) {
  return {
    ...DEFAULT_SETTINGS, ...s,
    lists: { ...DEFAULT_SETTINGS.lists, ...(s.lists || {}) },
    social: { ...DEFAULT_SETTINGS.social, ...(s.social || {}) },
    routine: s.routine && s.routine.length ? s.routine : DEFAULT_SETTINGS.routine,
    drawingCats: s.drawingCats || DEFAULT_SETTINGS.drawingCats,
  };
}
