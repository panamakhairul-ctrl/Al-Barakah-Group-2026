// ============================================================
// Al Barakah Group - Business Management App
// Offline-first PWA for property lease & subletting management
// ============================================================

const STORAGE_KEY = 'albarakah_data_v1';
const PIN_KEY = 'albarakah_pin';
const FIREBASE_CONFIG_KEY = 'albarakah_firebase_config';
const DEFAULT_CONTRIB = 6100;
const START_YM = '2026-10'; // চাঁদা শুরুর মাস
const END_YM = '2036-09';   // ১০ বছর পূর্ণ: সেপ্টেম্বর 2036

// Role & Lock state
let currentRole = 'admin'; // 'admin' | 'viewer'
let pinBuffer = '';
let isLocked = false;

// Cloud sync
// সব সদস্যের ডিভাইসে নিজে নিজে সংযোগ চাইলে এখানে Firebase config বসান (না চাইলে null থাকুক)
const DEFAULT_FIREBASE_CONFIG = {
  "apiKey": "AIzaSyCB-GJWxlPwWzX3M3FC1x8Qop6nB8aOhPo",
  "authDomain": "al-barakah-3a22f.firebaseapp.com",
  "databaseURL": "https://al-barakah-3a22f-default-rtdb.asia-southeast1.firebasedatabase.app",
  "projectId": "al-barakah-3a22f",
  "storageBucket": "al-barakah-3a22f.firebasestorage.app",
  "messagingSenderId": "43942793993",
  "appId": "1:43942793993:web:db312104cab5b2aecb79d8"
};
function parseFirebaseConfig(raw) {
  try { return JSON.parse(raw); } catch (e) {}
  // Firebase কনসোলের `const firebaseConfig = { apiKey: "..." }` ফরম্যাটও চলবে
  const cfg = {}; const re = /(\w+)\s*:\s*["']([^"']*)["']/g; let m;
  while ((m = re.exec(raw)) !== null) cfg[m[1]] = m[2];
  if (!Object.keys(cfg).length) throw new Error('Invalid config');
  return cfg;
}
let firebaseApp = null;
let firebaseDb = null;
let cloudEnabled = false;
let syncing = false;
let cloudListener = null;

// -------------------- i18n --------------------
const i18n = {
  en: {
    appTitle: 'Al Barakah',
    navDashboard: 'Home',
    navMembers: 'Members',
    navFinance: 'Finance',
    navReports: 'Reports',
    navDocs: 'Docs',
    navSettings: 'Settings',
    txtRecentTxn: 'Recent Transactions',
    txtQuickActions: 'Quick Actions',
    txtMembers: 'Members',
    txtTransactions: 'Transactions',
    txtDocuments: 'Documents',
    txtSettings: 'Settings',
    txtLanguage: 'Language / ভাষা',
    txtMonthlyContribution: 'Monthly Contribution (BDT)',
    totalBalance: 'Total Balance',
    thisMonthIncome: 'This Month Income',
    thisMonthExpense: 'This Month Expense',
    pendingDues: 'Pending Dues',
    membersPaid: 'Members Paid',
    noTransactions: 'No transactions yet',
    noMembers: 'No members yet. Add your first member.',
    noDocs: 'No documents yet. Upload the group constitution or other PDFs.',
    addIncome: 'Add Income',
    addExpense: 'Add Expense',
    addContribution: 'Record Contribution',
    addMember: 'Add Member',
    addTxn: 'Add Transaction',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    name: 'Full Name',
    phone: 'Phone Number',
    joinDate: 'Join Date',
    photo: 'Photo',
    amount: 'Amount (BDT)',
    category: 'Category',
    date: 'Date',
    note: 'Note / Description',
    type: 'Type',
    income: 'Income',
    expense: 'Expense',
    contribution: 'Contribution',
    paid: 'Paid',
    pending: 'Pending',
    shareReport: 'Share Report',
    dailyReport: 'Daily Cash Summary',
    monthlyReport: 'Monthly Financial Statement',
    contribReport: 'Member Contribution Report',
    openingBalance: 'Opening Balance',
    closingBalance: 'Closing Balance',
    totalIncome: 'Total Income',
    totalExpense: 'Total Expense',
    net: 'Net',
    confirmReset: 'Are you sure you want to delete ALL data? This cannot be undone.',
    dataExported: 'Data exported successfully',
    dataImported: 'Data imported successfully',
    dataReset: 'All data has been reset',
    saved: 'Saved successfully',
    deleted: 'Deleted',
    memberAdded: 'Member added',
    txnAdded: 'Transaction recorded',
    docUploaded: 'Document uploaded',
    offlineMode: 'You are offline. Changes will sync when online.',
    selectMember: 'Select Member',
    allCategories: 'All Categories',
    rent: 'Shop / Property Rent',
    advance: 'Advance Deposit',
    otherIncome: 'Other Income',
    leasePayment: 'Lease Payment',
    maintenance: 'Maintenance & Repairs',
    utility: 'Utilities',
    legal: 'Legal & Admin',
    bankCharge: 'Bank Charges',
    otherExpense: 'Other Expense',
    searchMembers: 'Search members...',
    viewAll: 'View All',
    exportData: 'Export All Data (JSON)',
    importData: 'Import Data',
    resetData: 'Reset All Data',
    about: 'About',
    enterPin: 'Enter PIN to unlock',
    wrongPin: 'Wrong PIN',
    viewOnly: 'View Only Mode',
    pinSet: 'PIN set successfully',
    pinRemoved: 'PIN removed',
    pinRequired: 'Enter 4-6 digit PIN',
    admin: 'Admin',
    viewer: 'Viewer',
    lockApp: 'Lock',
    setPin: 'Set PIN',
    removePin: 'Remove PIN',
    pinLabel: 'Admin PIN (4-6 digits)',
    noPermission: 'Only Admin can do this',
    clearTransactions: 'Clear All Transactions',
    confirmClearTxns: 'Are you sure you want to delete ALL transactions? Member list will remain. This cannot be undone.',
    txnsCleared: 'All transactions cleared',
  },
  bn: {
    appTitle: 'আল বারাকাহ',
    navDashboard: 'হোম',
    navMembers: 'সদস্য',
    navFinance: 'হিসাব',
    navReports: 'রিপোর্ট',
    navDocs: 'ডকুমেন্ট',
    navSettings: 'সেটিংস',
    txtRecentTxn: 'সাম্প্রতিক লেনদেন',
    txtQuickActions: 'দ্রুত কাজ',
    txtMembers: 'সদস্যবৃন্দ',
    txtTransactions: 'লেনদেনসমূহ',
    txtDocuments: 'ডকুমেন্টসমূহ',
    txtSettings: 'সেটিংস',
    txtLanguage: 'Language / ভাষা',
    txtMonthlyContribution: 'মাসিক চাঁদা (টাকা)',
    totalBalance: 'মোট ব্যালেন্স',
    thisMonthIncome: 'এই মাসের আয়',
    thisMonthExpense: 'এই মাসের খরচ',
    pendingDues: 'বকেয়া চাঁদা',
    membersPaid: 'চাঁদা পরিশোধ',
    noTransactions: 'এখনো কোনো লেনদেন নেই',
    noMembers: 'এখনো কোনো সদস্য নেই। প্রথম সদস্য যোগ করুন।',
    noDocs: 'এখনো কোনো ডকুমেন্ট নেই। সংবিধান বা অন্যান্য পিডিএফ আপলোড করুন।',
    addIncome: 'আয় যোগ করুন',
    addExpense: 'খরচ যোগ করুন',
    addContribution: 'চাঁদা রেকর্ড করুন',
    addMember: 'সদস্য যোগ করুন',
    addTxn: 'লেনদেন যোগ করুন',
    save: 'সংরক্ষণ',
    cancel: 'বাতিল',
    delete: 'মুছুন',
    edit: 'সম্পাদনা',
    name: 'পুরো নাম',
    phone: 'মোবাইল নম্বর',
    joinDate: 'যোগদানের তারিখ',
    photo: 'ছবি',
    amount: 'পরিমাণ (টাকা)',
    category: 'ক্যাটাগরি',
    date: 'তারিখ',
    note: 'নোট / বিবরণ',
    type: 'ধরন',
    income: 'আয়',
    expense: 'খরচ',
    contribution: 'চাঁদা',
    paid: 'পরিশোধিত',
    pending: 'বকেয়া',
    shareReport: 'রিপোর্ট শেয়ার করুন',
    dailyReport: 'দৈনিক নগদ সারসংক্ষেপ',
    monthlyReport: 'মাসিক আর্থিক বিবরণী',
    contribReport: 'সদস্য চাঁদা রিপোর্ট',
    openingBalance: 'শুরুর ব্যালেন্স',
    closingBalance: 'শেষ ব্যালেন্স',
    totalIncome: 'মোট আয়',
    totalExpense: 'মোট খরচ',
    net: 'নিট',
    confirmReset: 'আপনি কি সব ডেটা মুছে ফেলতে চান? এটি পূর্বাবস্থায় ফেরানো যাবে না।',
    dataExported: 'ডেটা সফলভাবে এক্সপোর্ট হয়েছে',
    dataImported: 'ডেটা সফলভাবে ইমপোর্ট হয়েছে',
    dataReset: 'সব ডেটা রিসেট করা হয়েছে',
    saved: 'সফলভাবে সংরক্ষিত',
    deleted: 'মুছে ফেলা হয়েছে',
    memberAdded: 'সদস্য যোগ করা হয়েছে',
    txnAdded: 'লেনদেন রেকর্ড করা হয়েছে',
    docUploaded: 'ডকুমেন্ট আপলোড হয়েছে',
    offlineMode: 'আপনি অফলাইনে আছেন। অনলাইনে এলে পরিবর্তন সিঙ্ক হবে।',
    selectMember: 'সদস্য নির্বাচন করুন',
    allCategories: 'সব ক্যাটাগরি',
    rent: 'দোকান / সম্পত্তি ভাড়া',
    advance: 'অগ্রিম জমা',
    otherIncome: 'অন্যান্য আয়',
    leasePayment: 'লিজ পেমেন্ট',
    maintenance: 'রক্ষণাবেক্ষণ ও মেরামত',
    utility: 'ইউটিলিটি',
    legal: 'আইনি ও প্রশাসনিক',
    bankCharge: 'ব্যাংক চার্জ',
    otherExpense: 'অন্যান্য খরচ',
    searchMembers: 'সদস্য খুঁজুন...',
    viewAll: 'সব দেখুন',
    exportData: 'সব ডেটা এক্সপোর্ট (JSON)',
    importData: 'ডেটা ইমপোর্ট',
    resetData: 'সব ডেটা রিসেট',
    about: 'সম্পর্কে',
    enterPin: 'আনলক করতে পিন দিন',
    wrongPin: 'ভুল পিন',
    viewOnly: 'শুধু দেখার মোড',
    pinSet: 'পিন সফলভাবে সেট হয়েছে',
    pinRemoved: 'পিন মুছে ফেলা হয়েছে',
    pinRequired: '৪-৬ সংখ্যার পিন দিন',
    admin: 'অ্যাডমিন',
    viewer: 'দর্শক',
    lockApp: 'লক',
    setPin: 'পিন সেট করুন',
    removePin: 'পিন মুছুন',
    pinLabel: 'অ্যাডমিন পিন (৪-৬ সংখ্যা)',
    noPermission: 'শুধুমাত্র অ্যাডমিন এটি করতে পারবেন',
    clearTransactions: 'সব লেনদেন মুছুন',
    confirmClearTxns: 'আপনি কি সব লেনদেন মুছে ফেলতে চান? সদস্য তালিকা থাকবে। এটি পূর্বাবস্থায় ফেরানো যাবে না।',
    txnsCleared: 'সব লেনদেন মুছে ফেলা হয়েছে',
  }
};

let lang = localStorage.getItem('albarakah_lang') || 'en';
let data = null;
let currentView = 'dashboard';
let currentTxnFilter = 'all';
let currentReport = 'daily';
let tempPhoto = null;

// -------------------- Data Management --------------------
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      data = JSON.parse(raw);
      if (data.settings.openingBalance === undefined) data.settings.openingBalance = 0;
      if (!data.contributions) data.contributions = {};
      setTimeout(() => { try { migrateV2(); fillPhotos(); renderAll(); } catch (e) { console.error(e); } }, 0);
      // Migrate old contribution transactions → contributions tracker
      if (data.transactions && data.transactions.length) {
        const kept = [];
        data.transactions.forEach(t => {
          if (t.type === 'contribution' && t.memberId) {
            const ym = (t.date || '').slice(0, 7);
            if (ym) {
              const prev = getContribAmount(t.memberId, ym);
              setContribAmount(t.memberId, ym, prev + (t.amount || 0));
            }
          } else {
            kept.push(t);
          }
        });
        data.transactions = kept;
      }
    } else {
      data = getDefaultData();
      saveData();
    }
  } catch (e) {
    console.error(e);
    data = getDefaultData();
  }
}


// Excel-এর নাম ও চাঁদা শুরুর মাস (অক্টোবর 2026) অনুযায়ী পুরোনো সেভ করা ডেটা ঠিক করা
// Excel-এর ছবি: যাদের ছবি নেই তাদের বসানো (নিজে আপলোড করা ছবি অপরিবর্তিত থাকে)
function fillPhotos() {
  if (typeof MEMBER_PHOTOS === 'undefined') return;
  let changed = false;
  data.members.forEach(m => { if (!m.photo && MEMBER_PHOTOS[m.id]) { m.photo = MEMBER_PHOTOS[m.id]; changed = true; } });
  if (changed) saveData();
}

function migrateV2() {
  if (data.migV2) return;
  const fresh = getDefaultData();
  data.members.forEach((m, i) => {
    const f = fresh.members[i];
    if (f && /^m\d+$/.test(m.id)) { m.name = f.name; m.position = f.position; m.profession = f.profession; m.phone = f.phone; }
  });
  const c = data.contributions || {};
  const isSeed = ym => c[ym] && Object.keys(c[ym]).length === 50 && Object.values(c[ym]).every(v => v === 6100);
  if (isSeed('2026-09') && isSeed('2026-10') && !c['2026-11']) {
    c['2026-11'] = c['2026-10']; c['2026-10'] = c['2026-09']; delete c['2026-09'];
  }
  data.migV2 = true;
  saveData();
}

function getDefaultData() {
  const now = new Date().toISOString().slice(0, 10);
  const memberList = []; // সদস্যদের তথ্য কোডে নেই — Firebase ক্লাউড থেকে লোড হয়
  return {
    settings: {
      businessName: 'Al Barakah Group',
      monthlyContribution: DEFAULT_CONTRIB,
      openingBalance: 0,
      address: 'Shibganj Bus Stand, Shibganj, Chapainawabganj'
    },
    members: memberList.map((m, i) => ({
      id: 'm' + (i + 1),
      name: m.name,
      position: m.position,
      profession: m.profession,
      phone: m.phone,
      joinDate: '2026-01-01',
      photo: (typeof MEMBER_PHOTOS !== 'undefined' && MEMBER_PHOTOS['m' + (i + 1)]) || null,
      status: 'active'
    })),
    // লেনদেন = শুধু আয় ও খরচ (চাঁদা নয়)
    transactions: [],
    // চাঁদা ট্র্যাকার: { 'YYYY-MM': { memberId: amount, ... } } — 2026-2035
    contributions: (function() {
      const c = {};
      const sep = {}, oct = {};  // sep=অক্টোবর, oct=নভেম্বর (শুরু অক্টোবর 2026)
      for (let i = 1; i <= 50; i++) {
        sep['m' + i] = 6100;
        oct['m' + i] = 6100;
      }
      c['2026-10'] = sep;
      c['2026-11'] = oct;
      return c;
    })(),
    documents: [],
    migV2: true,
    createdAt: new Date().toISOString()
  };
}

// --- Contribution helpers (Excel-style tracker) ---
function ensureContributions() {
  if (!data.contributions) data.contributions = {};
}

function getContribAmount(memberId, ym) {
  ensureContributions();
  return (data.contributions[ym] && data.contributions[ym][memberId]) || 0;
}

function setContribAmount(memberId, ym, amount) {
  ensureContributions();
  if (!data.contributions[ym]) data.contributions[ym] = {};
  if (amount > 0) data.contributions[ym][memberId] = amount;
  else delete data.contributions[ym][memberId];
}

function getMonthContribTotal(ym) {
  ensureContributions();
  const map = data.contributions[ym] || {};
  return Object.values(map).reduce((s, a) => s + (a || 0), 0);
}

function getAllContribTotal() {
  ensureContributions();
  let total = 0;
  Object.keys(data.contributions).forEach(ym => {
    total += getMonthContribTotal(ym);
  });
  return total;
}

// saveData is defined later (with cloud sync support)

// -------------------- Translation --------------------
function t(key) {
  return (i18n[lang] && i18n[lang][key]) || i18n.en[key] || key;
}

function applyTranslations() {
  const map = {
    appTitle: 'appTitle',
    navDashboard: 'navDashboard',
    navMembers: 'navMembers',
    navFinance: 'navFinance',
    navReports: 'navReports',
    navDocs: 'navDocs',
    navSettings: 'navSettings',
    txtRecentTxn: 'txtRecentTxn',
    txtQuickActions: 'txtQuickActions',
    txtMembers: 'txtMembers',
    txtTransactions: 'txtTransactions',
    txtDocuments: 'txtDocuments',
    txtSettings: 'txtSettings',
    txtLanguage: 'txtLanguage',
    txtMonthlyContribution: 'txtMonthlyContribution',
  };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(map[id]);
  });
  document.getElementById('langBtn').textContent = lang === 'en' ? 'বাংলা' : 'English';
  document.getElementById('langSelect').value = lang;
  const searchEl = document.getElementById('memberSearch');
  if (searchEl) searchEl.placeholder = t('searchMembers');
  const membersTitle = document.getElementById('txtMembers');
  if (membersTitle && data) membersTitle.textContent = `${t('txtMembers')} (${data.members.length})`;

  // Lock screen texts
  const lockSub = document.getElementById('lockSubtitle');
  if (lockSub) lockSub.textContent = t('enterPin');
  const viewerBtn = document.getElementById('viewerBtn');
  if (viewerBtn) viewerBtn.textContent = t('viewOnly');
  const pinLabel = document.getElementById('txtPinLabel');
  if (pinLabel) pinLabel.textContent = t('pinLabel');
  const btnSet = document.getElementById('btnSetPin');
  if (btnSet) btnSet.textContent = t('setPin');
  const btnRem = document.getElementById('btnRemovePin');
  if (btnRem) btnRem.textContent = t('removePin');
  updatePinStatus();
  updateRoleUI();
}

function setLanguage(l) {
  lang = l;
  localStorage.setItem('albarakah_lang', lang);
  applyTranslations();
  renderAll();
}

function toggleLanguage() {
  setLanguage(lang === 'en' ? 'bn' : 'en');
}

// -------------------- Formatting --------------------
function formatBDT(n) {
  return '৳' + Number(n || 0).toLocaleString('en-BD');
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function thisMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

// -------------------- Calculations --------------------
function getBalance() {
  const opening = Number(data.settings.openingBalance) || 0;
  let income = 0, expense = 0;
  data.transactions.forEach(t => {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  });
  return opening + income + getAllContribTotal() - expense;
}

function getMonthStats(ym) {
  const txns = data.transactions.filter(t => t.date.startsWith(ym));
  let income = 0, expense = 0;
  txns.forEach(t => {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  });
  const contrib = getMonthContribTotal(ym);
  return { income, expense, contrib, net: income + contrib - expense };
}

function getMemberContributionStatus(memberId, ym) {
  const paid = getContribAmount(memberId, ym);
  const target = data.settings.monthlyContribution;
  return { paid, target, pending: Math.max(0, target - paid), isPaid: paid >= target };
}

// -------------------- Rendering --------------------
function showView(view) {
  currentView = view;
  document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  document.getElementById('fabBtn').style.display = (view === 'finance' || view === 'dashboard') ? 'flex' : 'none';
  window.scrollTo(0, 0);
  renderAll();
}

function renderAll() {
  applyTranslations();
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'members') renderMembers();
  else if (currentView === 'contrib') renderContrib();
  else if (currentView === 'finance') renderTransactions();
  else if (currentView === 'reports') showReport(currentReport);
  else if (currentView === 'documents') renderDocuments();
  else if (currentView === 'settings') {
    document.getElementById('contribAmount').value = data.settings.monthlyContribution;
    document.getElementById('openingBalance').value = data.settings.openingBalance || 0;
    document.getElementById('businessName').value = data.settings.businessName;
  }
}

function renderDashboard() {
  const balance = getBalance();
  const month = thisMonth();
  const stats = getMonthStats(month);
  const paidCount = data.members.filter(m => getMemberContributionStatus(m.id, month).isPaid).length;
  const pendingAmount = data.members.reduce((s, m) => s + getMemberContributionStatus(m.id, month).pending, 0);

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">${t('totalBalance')}</div>
      <div class="stat-value ${balance >= 0 ? 'positive' : 'negative'}">${formatBDT(balance)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${lang==='bn'?'এই মাসের আয়':'Month Income'}</div>
      <div class="stat-value positive">${formatBDT(stats.income)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${lang==='bn'?'এই মাসের চাঁদা':'Month Contribution'}</div>
      <div class="stat-value positive">${formatBDT(stats.contrib)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t('thisMonthExpense')}</div>
      <div class="stat-value negative">${formatBDT(stats.expense)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t('pendingDues')}</div>
      <div class="stat-value">${formatBDT(pendingAmount)}</div>
      <div style="font-size:0.75rem;color:var(--muted);margin-top:4px">${paidCount}/${data.members.length} ${t('membersPaid')}</div>
    </div>
  `;

  const recent = [...data.transactions].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5);
  const container = document.getElementById('recentTxns');
  if (recent.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>${t('noTransactions')}</p></div>`;
  } else {
    container.innerHTML = recent.map(txnHtml).join('');
  }

  // Hide quick action buttons for viewers
  const quickCard = document.querySelector('#view-dashboard .card:last-of-type');
  if (quickCard) {
    quickCard.style.display = currentRole === 'admin' ? '' : 'none';
  }
}

function txnHtml(txn) {
  const isIn = txn.type === 'income';
  const member = txn.memberId ? data.members.find(m => m.id === txn.memberId) : null;
  const catLabel = t(txn.category) || txn.category;
  return `
    <div class="txn-item">
      <div class="txn-icon ${isIn ? 'income' : 'expense'}">${isIn ? '↓' : '↑'}</div>
      <div class="txn-details">
        <div class="txn-title">${catLabel}${member ? ' · ' + member.name : ''}</div>
        <div class="txn-meta">${formatDate(txn.date)}${txn.note ? ' · ' + txn.note : ''}</div>
      </div>
      <div class="txn-amount ${isIn ? 'income' : 'expense'}">${isIn ? '+' : '-'}${formatBDT(txn.amount)}</div>
    </div>
  `;
}

function renderMembers() {
  const q = (document.getElementById('memberSearch').value || '').toLowerCase();
  let list = data.members;
  if (q) list = list.filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.phone || '').includes(q) ||
    (m.position || '').toLowerCase().includes(q) ||
    (m.profession || '').toLowerCase().includes(q)
  );
  const month = thisMonth();
  const container = document.getElementById('membersList');
  // Show/hide Add button
  const addBtn = document.querySelector('#view-members .btn-primary');
  if (addBtn) addBtn.style.display = currentRole === 'admin' ? '' : 'none';

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>${t('noMembers')}</p></div>`;
    return;
  }
  container.innerHTML = list.map(m => {
    const status = getMemberContributionStatus(m.id, month);
    const badge = status.isPaid
      ? `<span class="badge badge-success">${t('paid')}</span>`
      : `<span class="badge badge-warning">${t('pending')}</span>`;
    const avatar = m.photo
      ? `<img class="member-avatar" src="${m.photo}" alt="">`
      : `<div class="member-avatar">${m.name.charAt(0)}</div>`;
    const pos = m.position ? ` · ${m.position}` : '';
    return `
      <div class="member-item" onclick="openMemberDetail('${m.id}')">
        ${avatar}
        <div class="member-info">
          <div class="member-name">${m.name}</div>
          <div class="member-meta">${m.phone || ''}${pos}</div>
          <div class="member-meta">${formatBDT(status.paid)} / ${formatBDT(status.target)}</div>
        </div>
        ${badge}
      </div>
    `;
  }).join('');
}

function filterTxns(filter) {
  currentTxnFilter = filter;
  document.querySelectorAll('#view-finance .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === filter);
  });
  renderTransactions();
}

function renderTransactions() {
  let list = [...data.transactions].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  // লেনদেন তালিকায় চাঁদা দেখায় না — চাঁদা শুধু Contributions রিপোর্টে
  list = list.filter(t => t.type === 'income' || t.type === 'expense');
  if (currentTxnFilter === 'income') list = list.filter(t => t.type === 'income');
  if (currentTxnFilter === 'expense') list = list.filter(t => t.type === 'expense');
  const container = document.getElementById('txnsList');
  // Hide add button for viewers
  const addBtn = document.querySelector('#view-finance .btn-primary');
  if (addBtn) addBtn.style.display = currentRole === 'admin' ? '' : 'none';

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>${t('noTransactions')}</p></div>`;
  } else {
    container.innerHTML = list.map(txnHtml).join('');
  }
}

let reportMonth = (function(){ const m = thisMonthSafe(); return (m >= '2026-10' && m <= '2036-09') ? m : '2026-10'; })();
function thisMonthSafe(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); } // YYYY-MM selected for reports

function getReportMonth() {
  if (reportMonth) return reportMonth;
  return thisMonth();
}

function setReportMonth(ym) {
  reportMonth = ym;
  showReport(currentReport);
}

function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const namesBn = ['', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const namesEn = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const n = parseInt(m, 10);
  return lang === 'bn' ? `${namesBn[n]} ${y}` : `${namesEn[n]} ${y}`;
}

function buildMonthOptions() {
  // 2026 অক্টোবর থেকে 2036 সেপ্টেম্বর (১২০ মাস)
  const opts = [];
  for (let y = 2026; y <= 2036; y++) {
    for (let m = 1; m <= 12; m++) {
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      if (ym >= '2026-10' && ym <= '2036-09') opts.push(ym);
    }
  }
  return opts;
}

function showReport(type) {
  currentReport = type;
  document.querySelectorAll('#view-reports .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === type);
  });
  const container = document.getElementById('reportContent');
  const month = getReportMonth();
  const todayStr = today();
  const monthOpts = buildMonthOptions();
  const monthSelector = (type === 'daily') ? '' : `
    <div class="form-group" style="margin-bottom:12px;">
      <label style="font-size:0.85rem;">${lang==='bn'?'মাস নির্বাচন করুন':'Select Month'}</label>
      <select class="form-control" id="reportMonthSelect" onchange="setReportMonth(this.value)">
        ${monthOpts.map(ym => `<option value="${ym}" ${ym===month?'selected':''}>${monthLabel(ym)}</option>`).join('')}
      </select>
    </div>
  `;

  if (type === 'daily') {
    // দৈনিক = শুধু আয় ও খরচ (চাঁদা নয়)
    const dayTxns = data.transactions.filter(t => t.date === todayStr && t.type !== 'contribution');
    let income = 0, expense = 0;
    dayTxns.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    });
    container.innerHTML = `
      <div class="report-box" id="reportBox">
        <div class="report-header">
          <h3>${data.settings.businessName}</h3>
          <p>${t('dailyReport')} (${lang==='bn'?'চাঁদা ছাড়া':'excl. contribution'})</p>
          <p style="font-size:0.85rem;color:var(--muted)">${formatDate(todayStr)}</p>
        </div>
        <div class="report-row"><span>${t('totalIncome')}</span><span class="positive">+${formatBDT(income)}</span></div>
        <div class="report-row"><span>${t('totalExpense')}</span><span class="negative">-${formatBDT(expense)}</span></div>
        <div class="report-row total"><span>${lang==='bn'?'দিনের নিট':'Day Net'}</span><span>${formatBDT(income - expense)}</span></div>
      </div>
    `;
  } else if (type === 'monthly') {
    const stats = getMonthStats(month);
    container.innerHTML = `
      ${monthSelector}
      <div class="report-box" id="reportBox">
        <div class="report-header">
          <h3>${data.settings.businessName}</h3>
          <p>${t('monthlyReport')}</p>
          <p style="font-size:0.85rem;color:var(--muted)">${monthLabel(month)}</p>
        </div>
        <div class="report-row"><span>${t('totalIncome')} (Rent + Other)</span><span class="positive">+${formatBDT(stats.income)}</span></div>
        <div class="report-row"><span>${t('contribution')}</span><span class="positive">+${formatBDT(stats.contrib)}</span></div>
        <div class="report-row"><span>${t('totalExpense')}</span><span class="negative">-${formatBDT(stats.expense)}</span></div>
        <div class="report-row total"><span>${t('net')}</span><span>${formatBDT(stats.net)}</span></div>
        <div class="report-row total"><span>${t('totalBalance')}</span><span>${formatBDT(getBalance())}</span></div>
      </div>
    `;
  } else {
    // Contribution report for selected month
    let rows = data.members.map(m => {
      const s = getMemberContributionStatus(m.id, month);
      return `<div class="report-row"><span>${m.name}</span><span>${s.isPaid ? '✓ ' + formatBDT(s.paid) : formatBDT(s.paid) + ' / ' + formatBDT(s.target)}</span></div>`;
    }).join('');
    const totalPaid = data.members.reduce((s, m) => s + getMemberContributionStatus(m.id, month).paid, 0);
    const totalTarget = data.members.length * data.settings.monthlyContribution;
    container.innerHTML = `
      ${monthSelector}
      <div class="report-box" id="reportBox">
        <div class="report-header">
          <h3>${data.settings.businessName}</h3>
          <p>${t('contribReport')}</p>
          <p style="font-size:0.85rem;color:var(--muted)">${monthLabel(month)}</p>
        </div>
        ${rows}
        <div class="report-row total"><span>${lang==='bn'?'মোট সংগৃহীত':'Total Collected'}</span><span>${formatBDT(totalPaid)} / ${formatBDT(totalTarget)}</span></div>
      </div>
    `;
  }
}

async function shareReport() {
  const box = document.getElementById('reportBox');
  if (!box) return;
  const text = box.innerText;
  const title = data.settings.businessName + ' - Report';

  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (e) { /* user cancelled or failed */ }
  }
  // Fallback: copy + WhatsApp link
  try {
    await navigator.clipboard.writeText(text);
    toast('Report copied to clipboard');
  } catch (e) {}
  const waUrl = 'https://wa.me/?text=' + encodeURIComponent(text);
  window.open(waUrl, '_blank');
}

function renderDocuments() {
  const list = data.documents;
  const container = document.getElementById('docsList');
  const empty = document.getElementById('docsEmpty');
  // Hide upload for viewers
  const uploadBtn = document.querySelector('#view-documents .btn-primary');
  if (uploadBtn) uploadBtn.style.display = currentRole === 'admin' ? '' : 'none';

  if (list.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  container.innerHTML = list.map(doc => `
    <div class="doc-item">
      <div class="doc-icon">📄</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:0.9rem">${doc.name}</div>
        <div style="font-size:0.75rem;color:var(--muted)">${formatDate(doc.date)} · ${(doc.size/1024).toFixed(1)} KB</div>
      </div>
      <button class="btn btn-sm btn-outline" onclick="viewDocument('${doc.id}')">View</button>
      ${currentRole === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteDocument('${doc.id}')">×</button>` : ''}
    </div>
  `).join('');
}

// -------------------- Modals --------------------
function openModal(type, extra = null) {
  // Viewers can only view member details, not add/edit
  if (['addMember', 'addIncome', 'addExpense', 'addTxn', 'addContribution'].includes(type) && currentRole !== 'admin') {
    return toast(t('noPermission'));
  }
  if (type === 'editMember' && currentRole !== 'admin') {
    // allow view but we can still open for now
  }
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  tempPhoto = null;

  let html = '';
  if (type === 'addMember' || type === 'editMember') {
    const m = extra ? data.members.find(x => x.id === extra) : null;
    const isEdit = !!m;
    html = `
      <div class="modal-header">
        <h2>${isEdit ? t('edit') : t('addMember')}</h2>
        <button class="close-btn" onclick="closeModal()">×</button>
      </div>
      <div class="text-center">
        <img id="photoPreview" class="photo-preview" src="${m && m.photo ? m.photo : ''}" style="${m && m.photo ? '' : 'display:none'}">
        <label class="photo-upload-btn">
          📷 ${t('photo')}
          <input type="file" accept="image/*" capture="user" class="hidden" onchange="previewPhoto(event)">
        </label>
      </div>
      <div class="form-group">
        <label>${t('name')}</label>
        <input type="text" class="form-control" id="mName" value="${m ? m.name : ''}" required>
      </div>
      <div class="form-group">
        <label>${lang==='bn'?'পদবী':'Position'}</label>
        <input type="text" class="form-control" id="mPosition" value="${m ? (m.position || '') : ''}">
      </div>
      <div class="form-group">
        <label>${lang==='bn'?'পেশা / প্রতিষ্ঠান':'Profession'}</label>
        <input type="text" class="form-control" id="mProfession" value="${m ? (m.profession || '') : ''}">
      </div>
      <div class="form-group">
        <label>${t('phone')}</label>
        <input type="tel" class="form-control" id="mPhone" value="${m ? m.phone || '' : ''}">
      </div>
      <div class="form-group">
        <label>${t('joinDate')}</label>
        <input type="date" class="form-control" id="mJoin" value="${m ? m.joinDate : today()}">
      </div>
      <button class="btn btn-primary btn-block" onclick="saveMember('${m ? m.id : ''}')">${t('save')}</button>
      ${isEdit && currentRole === 'admin' ? `
        <button class="btn btn-danger btn-block mt-8" onclick="deleteMember('${m.id}')" style="margin-top:12px;">
          🗑 ${t('delete')} ${lang === 'bn' ? 'সদস্য' : 'Member'}
        </button>
      ` : ''}
    `;
  } else if (type === 'addIncome' || type === 'addExpense' || type === 'addTxn' || type === 'addContribution') {
    const defaultType = type === 'addIncome' ? 'income' : type === 'addExpense' ? 'expense' : type === 'addContribution' ? 'contribution' : 'income';
    const memberOptions = data.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    html = `
      <div class="modal-header">
        <h2>${defaultType === 'contribution' ? t('addContribution') : t('addTxn')}</h2>
        <button class="close-btn" onclick="closeModal()">×</button>
      </div>
      <div class="form-group">
        <label>${t('type')}</label>
        <select class="form-control" id="txnType" onchange="updateCategoryOptions()">
          <option value="income" ${defaultType==='income'?'selected':''}>${t('income')}</option>
          <option value="expense" ${defaultType==='expense'?'selected':''}>${t('expense')}</option>
          <option value="contribution" ${defaultType==='contribution'?'selected':''}>${t('contribution')}</option>
        </select>
      </div>
      <div class="form-group" id="memberGroup" style="${defaultType==='contribution'?'':'display:none'}">
        <label>${t('selectMember')}</label>
        <select class="form-control" id="txnMember">
          <option value="">-- ${t('selectMember')} --</option>
          ${memberOptions}
        </select>
      </div>
      <div class="form-group">
        <label>${t('category')}</label>
        <select class="form-control" id="txnCategory"></select>
      </div>
      <div class="form-group">
        <label>${t('amount')}</label>
        <input type="number" class="form-control" id="txnAmount" value="${defaultType==='contribution' ? data.settings.monthlyContribution : ''}" min="0" step="1">
      </div>
      <div class="form-group">
        <label>${t('date')}</label>
        <input type="date" class="form-control" id="txnDate" value="${today()}">
      </div>
      <div class="form-group">
        <label>${t('note')}</label>
        <textarea class="form-control" id="txnNote" rows="2"></textarea>
      </div>
      <button class="btn btn-primary btn-block" onclick="saveTransaction()">${t('save')}</button>
    `;
  }

  content.innerHTML = html;
  overlay.classList.add('active');
  if (type === 'addIncome' || type === 'addExpense' || type === 'addTxn' || type === 'addContribution') {
    updateCategoryOptions();
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

function updateCategoryOptions() {
  const type = document.getElementById('txnType').value;
  const catSelect = document.getElementById('txnCategory');
  const memberGroup = document.getElementById('memberGroup');
  memberGroup.style.display = type === 'contribution' ? 'block' : 'none';

  let options = [];
  if (type === 'income') {
    options = ['rent', 'advance', 'otherIncome'];
  } else if (type === 'expense') {
    options = ['leasePayment', 'maintenance', 'utility', 'legal', 'bankCharge', 'otherExpense'];
  } else {
    options = ['contribution'];
  }
  catSelect.innerHTML = options.map(o => `<option value="${o}">${t(o)}</option>`).join('');
  if (type === 'contribution') {
    document.getElementById('txnAmount').value = data.settings.monthlyContribution;
  }
}

function previewPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    tempPhoto = ev.target.result;
    const img = document.getElementById('photoPreview');
    img.src = tempPhoto;
    img.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function saveMember(id) {
  if (!requireAdmin()) return;
  const name = document.getElementById('mName').value.trim();
  if (!name) return toast('Name required');
  const phone = document.getElementById('mPhone').value.trim();
  const joinDate = document.getElementById('mJoin').value || today();
  const position = (document.getElementById('mPosition') || {}).value || '';
  const profession = (document.getElementById('mProfession') || {}).value || '';

  if (id) {
    const m = data.members.find(x => x.id === id);
    if (m) {
      m.name = name;
      m.phone = phone;
      m.joinDate = joinDate;
      m.position = position.trim();
      m.profession = profession.trim();
      if (tempPhoto) m.photo = tempPhoto;
    }
  } else {
    data.members.push({
      id: 'm' + Date.now(),
      name, phone, joinDate,
      position: position.trim(),
      profession: profession.trim(),
      photo: tempPhoto,
      status: 'active'
    });
  }
  saveData();
  closeModal();
  toast(t('memberAdded'));
  renderAll();
}

function deleteMember(id) {
  if (!requireAdmin()) return;
  const m = data.members.find(x => x.id === id);
  if (!m) return;

  const confirmMsg = lang === 'bn'
    ? `"${m.name}" কে মুছে ফেলতে চান? এই সদস্যের চাঁদার হিসাব থাকবে, কিন্তু সদস্য তালিকা থেকে সরে যাবে।`
    : `Delete "${m.name}"? Their contribution records will remain, but they will be removed from the member list.`;

  if (!confirm(confirmMsg)) return;

  data.members = data.members.filter(x => x.id !== id);
  // Note: We keep contribution transactions for historical accuracy
  saveData();
  closeModal();
  toast(t('deleted'));
  renderAll();
}

function saveTransaction() {
  if (!requireAdmin()) return;
  const type = document.getElementById('txnType').value;
  const category = document.getElementById('txnCategory').value;
  const amount = parseFloat(document.getElementById('txnAmount').value) || 0;
  const date = document.getElementById('txnDate').value || today();
  const note = document.getElementById('txnNote').value.trim();
  const memberId = type === 'contribution' ? document.getElementById('txnMember').value : null;

  if (amount <= 0) return toast('Amount required');
  if (type === 'contribution' && !memberId) return toast('Select a member');

  // চাঁদা → contributions tracker (Excel style); আয়/খরচ → transactions
  if (type === 'contribution') {
    const ym = date.slice(0, 7); // YYYY-MM
    const prev = getContribAmount(memberId, ym);
    setContribAmount(memberId, ym, prev + amount);
  } else {
    data.transactions.push({
      id: 't' + Date.now(),
      type, category, amount, date, note, memberId: null
    });
  }
  saveData();
  closeModal();
  toast(t('txnAdded'));
  renderAll();
}

function openMemberDetail(id) {
  openModal('editMember', id);
}

// -------------------- Documents --------------------
function uploadDocument(e) {
  if (!requireAdmin()) {
    e.target.value = '';
    return;
  }
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('File too large (max 5MB)');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    data.documents.push({
      id: 'd' + Date.now(),
      name: file.name,
      type: file.type,
      size: file.size,
      date: today(),
      data: ev.target.result
    });
    saveData();
    toast(t('docUploaded'));
    renderDocuments();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function viewDocument(id) {
  const doc = data.documents.find(d => d.id === id);
  if (!doc) return;
  const win = window.open();
  if (doc.type.startsWith('image/')) {
    win.document.write(`<img src="${doc.data}" style="max-width:100%">`);
  } else {
    win.document.write(`<iframe src="${doc.data}" style="width:100%;height:100%;border:none"></iframe>`);
  }
}

function deleteDocument(id) {
  if (!requireAdmin()) return;
  if (!confirm(t('delete') + '?')) return;
  data.documents = data.documents.filter(d => d.id !== id);
  saveData();
  toast(t('deleted'));
  renderDocuments();
}

// -------------------- Settings & Data --------------------
function saveSettings() {
  if (!requireAdmin()) return;
  data.settings.monthlyContribution = parseInt(document.getElementById('contribAmount').value) || DEFAULT_CONTRIB;
  data.settings.openingBalance = parseFloat(document.getElementById('openingBalance').value) || 0;
  data.settings.businessName = document.getElementById('businessName').value || 'Al Barakah Group';
  saveData();
  toast(t('saved'));
  renderAll();
}

function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `al-barakah-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast(t('dataExported'));
}

function importData(e) {
  if (!requireAdmin()) { e.target.value = ''; return; }
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (imported.members && imported.transactions) {
        data = imported;
        saveData();
        toast(t('dataImported'));
        renderAll();
      } else {
        toast('Invalid file');
      }
    } catch (err) {
      toast('Invalid JSON');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function resetAllData() {
  if (currentRole !== 'admin') return toast(t('noPermission'));
  localStorage.removeItem(STORAGE_KEY);
  data = getDefaultData();
  saveData();
  toast(t('dataReset'));
  renderAll();
}

function clearAllTransactions() {
  if (!requireAdmin()) return;
  if (!confirm(t('confirmClearTxns'))) return;
  data.transactions = [];
  saveData();
  toast(t('txnsCleared'));
  renderAll();
}

// -------------------- Login (Firebase Auth) & Roles --------------------
// এডমিন = শুধু এই UID. বাকি সবাই শুধু দেখতে পারবে। (ডেটা লেখার নিয়ম Firebase Rules-এও একই UID-এ বাঁধা)
const ADMIN_UID = 'RdFAzrQ0enRuF4nFszDtg6pirnl1';
let authUser = null;

function initAuth() {
  if (!firebaseApp || !firebase.auth) return;
  firebase.auth().onAuthStateChanged(user => {
    authUser = user;
    currentRole = (user && user.uid === ADMIN_UID) ? 'admin' : 'viewer';
    document.getElementById('lockScreen').classList.add('hidden');
    updateRoleUI();
    updateAuthStatus();
    if (currentRole === 'admin') pullFromCloud(); // ক্লাউড ফাঁকা থাকলে এডমিনের ডেটা আপলোড হবে
    renderAll();
  });
}

function lockApp() { // হেডারের 🔑 / 🚪 বাটন
  if (currentRole === 'admin') {
    if (confirm(lang === 'bn' ? 'লগআউট করবেন?' : 'Log out?')) logoutAdmin();
    return;
  }
  document.getElementById('loginError').classList.add('hidden');
  document.getElementById('lockScreen').classList.remove('hidden');
}

function enterViewerMode() {
  document.getElementById('lockScreen').classList.add('hidden');
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function doLogin() {
  const bn = lang === 'bn';
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  if (!email || !pass) return showLoginError(bn ? 'ইমেইল ও পাসওয়ার্ড দিন' : 'Enter email and password');
  if (!firebaseApp || !firebase.auth) return showLoginError(bn ? 'ইন্টারনেট সংযোগ দরকার' : 'Internet connection required');
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  firebase.auth().signInWithEmailAndPassword(email, pass)
    .then(cred => {
      document.getElementById('loginPass').value = '';
      if (cred.user.uid !== ADMIN_UID) {
        toast(bn ? 'এটি এডমিন অ্যাকাউন্ট নয় — শুধু দেখা যাবে' : 'Not the admin account — view only');
      } else {
        toast(bn ? 'এডমিন হিসেবে লগইন হয়েছে ✓' : 'Logged in as admin ✓');
      }
    })
    .catch(err => {
      const c = err && err.code || '';
      let msg = bn ? 'লগইন হয়নি, আবার চেষ্টা করুন' : 'Login failed';
      if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) msg = bn ? 'ইমেইল বা পাসওয়ার্ড ভুল' : 'Wrong email or password';
      else if (/network/.test(c)) msg = bn ? 'ইন্টারনেট সংযোগ নেই' : 'No internet connection';
      else if (/too-many/.test(c)) msg = bn ? 'অনেকবার ভুল হয়েছে, কিছুক্ষণ পর চেষ্টা করুন' : 'Too many attempts, try later';
      showLoginError(msg);
    })
    .finally(() => { btn.disabled = false; });
}

function logoutAdmin() {
  if (firebase.auth) firebase.auth().signOut().then(() => toast(lang === 'bn' ? 'লগআউট হয়েছে' : 'Logged out'));
}

function updateAuthStatus() {
  const bn = lang === 'bn';
  const st = document.getElementById('authStatus'), btn = document.getElementById('btnAuth');
  if (!st || !btn) return;
  const admin = currentRole === 'admin';
  st.textContent = admin ? (bn ? 'এডমিন: ' : 'Admin: ') + (authUser && authUser.email || '')
                         : (bn ? 'আপনি শুধু দেখতে পারবেন (ভিউ-অনলি)' : 'View-only mode');
  btn.textContent = admin ? (bn ? 'লগআউট' : 'Logout') : (bn ? 'এডমিন লগইন' : 'Admin login');
}
function updatePinStatus() { updateAuthStatus(); }

function updateRoleUI() {
  const badge = document.getElementById('roleBadge');
  if (badge) {
    badge.textContent = currentRole === 'admin' ? t('admin') : t('viewer');
    badge.style.display = 'inline-block';
  }
  // Hide admin-only buttons for viewers
  const isAdmin = currentRole === 'admin';
  document.querySelectorAll('.admin-only, [data-admin-only]').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  const lb = document.getElementById('lockBtn');
  if (lb) { lb.textContent = isAdmin ? '🚪' : '🔑'; lb.title = isAdmin ? 'Logout' : 'Admin Login'; }
  // FAB
  const fab = document.getElementById('fabBtn');
  if (fab) fab.style.display = isAdmin && (currentView === 'finance' || currentView === 'dashboard') ? 'flex' : 'none';
}

function requireAdmin() {
  if (currentRole !== 'admin') {
    toast(t('noPermission'));
    return false;
  }
  return true;
}

// -------------------- Contribution list (২০২৬–২০৩৫: বছর + মাস ক্লিক) --------------------
let cYear = (function(){ const y = new Date().getFullYear(); return (y >= 2026 && y <= 2036) ? y : 2026; })();
let cMonth = (function(){ return (cYear === new Date().getFullYear()) ? new Date().getMonth() + 1 : 10; })();
let cFilter = 'all';
if (ymOfSafe(cYear, cMonth) < '2026-10') { cYear = 2026; cMonth = 10; }
if (ymOfSafe(cYear, cMonth) > '2036-09') { cYear = 2036; cMonth = 9; }
function ymOfSafe(y, m) { return y + '-' + String(m).padStart(2, '0'); }
const MONTHS_BN = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টে','অক্টো','নভে','ডিসে'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ymOf = (y, m) => y + '-' + String(m).padStart(2, '0');

function setContribYear(y) { cYear = y; if (ymOf(cYear, cMonth) < START_YM) cMonth = 10; if (ymOf(cYear, cMonth) > END_YM) cMonth = 9; renderContrib(); }
function setContribMonth(m) { cMonth = m; renderContrib(); }
function setContribFilter(f) { cFilter = f; renderContrib(); }

function renderContrib() {
  const bn = lang === 'bn';
  document.getElementById('txtContrib').textContent = bn ? 'চাঁদা তালিকা' : 'Contribution List';
  document.getElementById('lblYear').textContent = bn ? 'বছর' : 'Year';
  document.getElementById('lblMonth').textContent = bn ? 'মাস' : 'Month';
  document.getElementById('navContrib').textContent = bn ? 'চাঁদা' : 'Dues';
  const names = bn ? MONTHS_BN : MONTHS_EN;
  const target = Number(data.settings.monthlyContribution) || 0;
  const full = data.members.length * target;

  document.getElementById('yearChips').innerHTML = Array.from({length: 11}, (_, i) => 2026 + i)
    .map(y => `<button class="chip ${y === cYear ? 'active' : ''}" onclick="setContribYear(${y})">${y}</button>`).join('');

  document.getElementById('monthChips').innerHTML = names.map((n, i) => {
    const m = i + 1, tot = getMonthContribTotal(ymOf(cYear, m));
    const off = ymOf(cYear, m) < START_YM || ymOf(cYear, m) > END_YM;
    const state = off ? 'off' : (tot <= 0 ? '' : (tot >= full ? 'full' : 'part'));
    return `<button class="mchip ${m === cMonth ? 'active' : ''} ${state}" ${off ? 'disabled' : ''} onclick="setContribMonth(${m})">
      <span>${n}</span><small>${off ? '·' : tot > 0 ? (tot / 1000).toFixed(tot % 1000 ? 1 : 0) + 'k' : '–'}</small></button>`;
  }).join('');

  const ym = ymOf(cYear, cMonth);
  const rows = data.members.map((m, i) => ({ m, i, s: getMemberContributionStatus(m.id, ym) }));
  const paidRows = rows.filter(r => r.s.isPaid);
  const collected = rows.reduce((s, r) => s + r.s.paid, 0);
  document.getElementById('contribStats').innerHTML = `
    <div class="stat-card"><div class="stat-label">${bn ? 'সংগৃহীত' : 'Collected'}</div><div class="stat-value positive">${formatBDT(collected)}</div></div>
    <div class="stat-card"><div class="stat-label">${bn ? 'বকেয়া' : 'Pending'}</div><div class="stat-value negative">${formatBDT(rows.reduce((s, r) => s + r.s.pending, 0))}</div></div>
    <div class="stat-card"><div class="stat-label">${bn ? 'পরিশোধ করেছেন' : 'Paid'}</div><div class="stat-value">${paidRows.length}/${rows.length}</div></div>
    <div class="stat-card"><div class="stat-label">${bn ? 'লক্ষ্য' : 'Target'}</div><div class="stat-value">${formatBDT(full)}</div></div>`;

  const tabNames = { all: bn ? 'সব' : 'All', paid: bn ? 'পরিশোধিত' : 'Paid', pending: bn ? 'বকেয়া' : 'Pending' };
  document.querySelectorAll('#view-contrib .tab').forEach(b => {
    b.textContent = tabNames[b.dataset.ctab];
    b.classList.toggle('active', b.dataset.ctab === cFilter);
  });
  let list = rows;
  if (cFilter === 'paid') list = paidRows;
  if (cFilter === 'pending') list = rows.filter(r => !r.s.isPaid);

  const label = `${bn ? MONTHS_BN[cMonth - 1] : MONTHS_EN[cMonth - 1]} ${cYear}`;
  const bulk = (currentRole === 'admin' && paidRows.length < rows.length)
    ? `<button class="btn btn-gold btn-block" style="margin:10px 0" onclick="fillAllContrib()">${bn ? '✓ বাকি সবাইকে পূর্ণ চাঁদা দিন' : '✓ Mark all pending as fully paid'}</button>` : '';
  document.getElementById('contribList').innerHTML = `<div class="contrib-head">${label}</div>` + bulk +
    (list.length ? list.map(r => {
      const { m, i, s } = r;
      const badge = s.isPaid ? `<span class="badge badge-success">${t('paid')}</span>`
        : s.paid > 0 ? `<span class="badge badge-warning">${bn ? 'আংশিক' : 'Partial'}</span>`
        : `<span class="badge badge-danger">${bn ? 'বকেয়া' : 'Due'}</span>`;
      return `<div class="contrib-row" onclick="editContrib('${m.id}')">
        <span class="contrib-no">${i + 1}</span>
        <div class="member-info"><div class="member-name">${m.name}</div><div class="member-meta">${m.position || ''}</div></div>
        <div class="contrib-amt"><b>${formatBDT(s.paid)}</b>${badge}</div></div>`;
    }).join('') : `<div class="empty-state"><p>${t('noMembers')}</p></div>`);
}

function fillAllContrib() {
  if (!requireAdmin()) return;
  const bn = lang === 'bn';
  if (!confirm(bn ? 'যাদের জমা নেই তাদের সবার পূর্ণ চাঁদা জমা হিসেবে ধরা হবে। নিশ্চিত?' : 'Mark every unpaid member as fully paid?')) return;
  const ym = ymOf(cYear, cMonth), target = Number(data.settings.monthlyContribution) || 0;
  data.members.forEach(m => { if (!getContribAmount(m.id, ym)) setContribAmount(m.id, ym, target); });
  saveData(); renderContrib(); toast(bn ? 'সংরক্ষিত ✓' : 'Saved ✓');
}

function editContrib(memberId) {
  if (currentRole !== 'admin') return toast(t('noPermission'));
  const m = data.members.find(x => x.id === memberId);
  const ym = ymOf(cYear, cMonth);
  const bn = lang === 'bn';
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-header"><h2>${m.name}</h2><button class="close-btn" onclick="closeModal()">×</button></div>
    <p style="color:var(--muted);margin-bottom:12px">${bn ? MONTHS_BN[cMonth - 1] : MONTHS_EN[cMonth - 1]} ${cYear} · ${bn ? 'ধার্য' : 'Due'} ${formatBDT(data.settings.monthlyContribution)}</p>
    <div class="form-group"><label>${bn ? 'জমার পরিমাণ (৳)' : 'Amount paid (BDT)'}</label>
      <input type="number" inputmode="numeric" class="form-control" id="cAmount" value="${getContribAmount(memberId, ym) || ''}" placeholder="0"></div>
    <div class="flex gap-8" style="flex-wrap:wrap">
      <button class="btn btn-gold" onclick="document.getElementById('cAmount').value=${Number(data.settings.monthlyContribution) || 0}">${bn ? 'পুরো চাঁদা' : 'Full amount'}</button>
      <button class="btn btn-outline" onclick="document.getElementById('cAmount').value=''">${bn ? 'মুছুন' : 'Clear'}</button>
      <button class="btn btn-primary" style="margin-left:auto" onclick="saveContrib('${memberId}')">${t('save')}</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('active');
}

function saveContrib(memberId) {
  if (!requireAdmin()) return;
  const v = Math.max(0, Number(document.getElementById('cAmount').value) || 0);
  setContribAmount(memberId, ymOf(cYear, cMonth), v);
  saveData();
  closeModal();
  renderContrib();
  toast(lang === 'bn' ? 'সংরক্ষিত ✓' : 'Saved ✓');
}

// -------------------- Cloud Sync (Firebase) --------------------
function initFirebase() {
  const raw = DEFAULT_FIREBASE_CONFIG ? JSON.stringify(DEFAULT_FIREBASE_CONFIG) : localStorage.getItem(FIREBASE_CONFIG_KEY);
  if (!raw) {
    cloudEnabled = false;
    updateSyncStatus();
    return;
  }
  try {
    const config = JSON.parse(raw);
    if (!config.apiKey || !config.databaseURL) {
      cloudEnabled = false;
      updateSyncStatus('Config incomplete');
      return;
    }
    if (firebaseApp) {
      // already initialized
      cloudEnabled = true;
      updateSyncStatus('Connected');
      startCloudListener();
      return;
    }
    firebaseApp = firebase.initializeApp(config);
    firebaseDb = firebase.database();
    initAuth();
    cloudEnabled = true;
    updateSyncStatus('Connected');
    startCloudListener();
    // Load from cloud on start
    pullFromCloud();
  } catch (e) {
    console.error('Firebase init error', e);
    cloudEnabled = false;
    updateSyncStatus('Error: ' + e.message);
  }
}

function saveFirebaseConfig() {
  if (!requireAdmin()) return;
  const raw = document.getElementById('firebaseConfig').value.trim();
  if (!raw) {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
    cloudEnabled = false;
    if (cloudListener) { cloudListener(); cloudListener = null; }
    updateSyncStatus('Cloud: Off');
    toast('Cloud disconnected');
    return;
  }
  try {
    const config = parseFirebaseConfig(raw);
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    // Reset app instance
    firebaseApp = null;
    firebaseDb = null;
    initFirebase();
    toast('Cloud connected!');
  } catch (e) {
    toast('Invalid JSON config');
  }
}

function updateSyncStatus(msg) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
  } else {
    el.textContent = cloudEnabled ? '☁ Cloud: Connected' : 'Cloud: Off';
  }
  el.style.color = cloudEnabled ? 'var(--success)' : 'var(--muted)';
}

function pushToCloud() {
  if (!cloudEnabled || !firebaseDb || syncing || currentRole !== 'admin') return;
  syncing = true;
  updateSyncStatus('Syncing...');
  const payload = {
    settings: data.settings,
    members: data.members,
    transactions: data.transactions,
    contributions: data.contributions || {},
    migV2: true,
    documents: data.documents.map(d => ({
      id: d.id, name: d.name, type: d.type, size: d.size, date: d.date
      // skip large base64 data for documents to keep DB light - optional
    })),
    updatedAt: new Date().toISOString()
  };
  // Keep document data too if small
  payload.documents = data.documents;

  firebaseDb.ref('albarakah/data').set(payload)
    .then(() => {
      syncing = false;
      updateSyncStatus('☁ Synced ' + new Date().toLocaleTimeString());
    })
    .catch(err => {
      syncing = false;
      updateSyncStatus('Sync error');
      console.error(err);
    });
}

function applyRemote(remote) {
  data.settings = remote.settings || data.settings;
  data.members = remote.members || [];
  data.transactions = remote.transactions || [];
  data.documents = remote.documents || [];
  if (remote.contributions) data.contributions = remote.contributions;
  data.migV2 = remote.migV2 === true;
  if (!data.migV2) { data.migV2 = false; migrateV2(); }
  fillPhotos();
}

function pullFromCloud() {
  if (!cloudEnabled || !firebaseDb) return;
  updateSyncStatus('Loading...');
  firebaseDb.ref('albarakah/data').once('value')
    .then(snap => {
      const remote = snap.val();
      if (remote && remote.members) {
        applyRemote(remote);
        saveData(); // also save locally
        renderAll();
        updateSyncStatus('☁ Loaded from cloud');
      } else {
        // nothing in cloud yet - push local
        pushToCloud();
      }
    })
    .catch(err => {
      updateSyncStatus('Load error');
      console.error(err);
    });
}

function startCloudListener() {
  if (!firebaseDb) return;
  if (cloudListener) return;
  cloudListener = firebaseDb.ref('albarakah/data').on('value', snap => {
    if (syncing) return; // ignore our own writes
    const remote = snap.val();
    if (!remote || !remote.members) return;
    // Only update if remote is newer
    const localUpdated = data.updatedAt || '';
    const remoteUpdated = remote.updatedAt || '';
    if (remoteUpdated && remoteUpdated > localUpdated) {
      applyRemote(remote);
      data.updatedAt = remote.updatedAt;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      renderAll();
      updateSyncStatus('☁ Updated from cloud');
    }
  });
}

function syncNow() {
  if (!cloudEnabled) {
    toast(lang === 'bn' ? 'আগে Firebase কনফিগ সেট করুন' : 'Set Firebase config first');
    return;
  }
  pushToCloud();
  toast(lang === 'bn' ? 'সিঙ্ক করা হচ্ছে...' : 'Syncing...');
}

// Override saveData to also push to cloud
const _originalSaveData = null;
function saveData() {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (cloudEnabled && currentRole === 'admin') {
    pushToCloud();
  }
}

// -------------------- Utils --------------------
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// Offline detection
function updateOnlineStatus() {
  const badge = document.getElementById('offlineBadge');
  if (!navigator.onLine) {
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

// -------------------- Init --------------------
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  applyTranslations();
  updatePinStatus();
  initFirebase();

  // Restore firebase config in textarea
  const savedConfig = localStorage.getItem(FIREBASE_CONFIG_KEY);
  if (savedConfig && document.getElementById('firebaseConfig')) {
    document.getElementById('firebaseConfig').value = savedConfig;
  }

  // শুরুতে সবাই ভিউয়ার; এডমিন লগইন হলে initAuth() রোল বদলে দেয়
  currentRole = 'viewer';

  showView('dashboard');
  updateRoleUI();
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Close modal on overlay click
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
});
