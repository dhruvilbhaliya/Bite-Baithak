// ══════════════════════════════════════
//  firebase-init.js
//  Initializes Firebase & provides a
//  sync-like DB wrapper for the app
// ══════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Your Firebase Config ──────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBGoFsY0EImiDAq9Gfyd8qxiJkUXnWZJns",
  authDomain:        "bite-baithak.firebaseapp.com",
  projectId:         "bite-baithak",
  storageBucket:     "bite-baithak.firebasestorage.app",
  messagingSenderId: "217195451253",
  appId:             "1:217195451253:web:6f547bdf7568722b89393c",
  measurementId:     "G-5V0EH3PN8E"
};

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDB = getFirestore(firebaseApp);

// ── In-memory cache (sync layer) ──────
// All Firestore data is loaded into this
// cache so your existing sync code works
window._cache = {};

// ── Async DB (used internally) ────────
window.FireDB = {

  async getAll(col) {
    const snap = await getDocs(collection(firestoreDB, col));
    return snap.docs.map(d => d.data());
  },

  async getDoc(col, id) {
    const d = await getDoc(doc(firestoreDB, col, id));
    return d.exists() ? d.data() : null;
  },

  async setDoc(col, id, data) {
    await setDoc(doc(firestoreDB, col, id), data);
  },

  async deleteDoc(col, id) {
    await deleteDoc(doc(firestoreDB, col, id));
  },

  async where(col, field, op, val) {
    const q    = query(collection(firestoreDB, col), where(field, op, val));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  },

  listen(col, callback) {
    return onSnapshot(collection(firestoreDB, col), snap => {
      const data = snap.docs.map(d => d.data());
      window._cache[col] = data;
      callback(data);
    });
  }
};

// ── Sync DB wrapper (replaces old DB) ─
// Your existing code calls DB.get/set/push
// These now read/write Firestore AND cache
window.DB = {

  get(k) {
    const cached = window._cache[k];
    if (cached === undefined) return null;
    return JSON.parse(JSON.stringify(cached));
  },

  set(k, v) {
    window._cache[k] = JSON.parse(JSON.stringify(v));
    // Persist to Firestore async
    if (k === 'admin') {
      FireDB.setDoc('admin', 'admin', v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(item => {
        const id = item.id || item._docId || generateId();
        FireDB.setDoc(k, id, { ...item, id });
      });
    } else if (typeof v === 'object' && v !== null) {
      const id = v.id || v._docId || generateId();
      FireDB.setDoc(k, id, { ...v, id });
    }
  },

  push(k, item) {
    const arr = this.get(k) || [];
    const id  = item.id || generateId();
    const newItem = { ...item, id };
    arr.push(newItem);
    window._cache[k] = arr;
    FireDB.setDoc(k, id, newItem);
    return newItem;
  },
};

// ══════════════════════════════════════
//  Seed Data
// ══════════════════════════════════════
function genTables(restId, count) {
  const pool = ['free','free','free','free','occupied','free','free','maintenance','free','free'];
  const tables = [];
  for (let i = 1; i <= count; i++) {
    tables.push({
      id: `${restId}_t${i}`, number: i,
      seats: [2,2,4,4,4,6,6,8][Math.floor(Math.random() * 8)],
      status: pool[i % pool.length],
    });
  }
  return tables;
}

async function seedIfEmpty() {
  const existing = await FireDB.getAll('restaurants');
  if (existing.length > 0) {
    console.log('✅ Bite Baithak: DB already has data');
    return false;
  }

  console.log('🌱 Seeding Bite Baithak database for the first time...');

  // Admin
  await FireDB.setDoc('admin', 'admin', { username:'admin', password: btoa('admin123'), name:'Admin' });

  // Restaurants
  const rests = [
    { id:'r1', name:'La Maison',     cuisine:'French Fine Dining', emoji:'🥐', priceRange:'₹₹₹₹', priceLevel:4, rating:4.8, desc:'An elegant escape into the heart of French culinary tradition.',       tables: genTables('r1',12) },
    { id:'r2', name:'Sakura Garden', cuisine:'Japanese & Sushi',   emoji:'🍣', priceRange:'₹₹₹',  priceLevel:3, rating:4.7, desc:'Authentic Japanese cuisine from sashimi to ramen in a serene setting.', tables: genTables('r2',10) },
    { id:'r3', name:'Spice Route',   cuisine:'North Indian',        emoji:'🍛', priceRange:'₹₹',   priceLevel:2, rating:4.6, desc:'A celebration of bold Indian flavors — aromatic curries and tandoori.', tables: genTables('r3',14) },
    { id:'r4', name:'Bella Italia',  cuisine:'Italian Trattoria',   emoji:'🍝', priceRange:'₹₹₹',  priceLevel:3, rating:4.9, desc:'Wood-fired pizzas and hand-rolled pasta in a Mediterranean setting.',   tables: genTables('r4',10) },
  ];
  for (const r of rests) await FireDB.setDoc('restaurants', r.id, r);

  // Menus
  const menus = [
    { id:'m1',  restId:'r1', name:'Escargot',           emoji:'🐌', category:'Starters',    price:380,  desc:'Classic French snails in garlic herb butter' },
    { id:'m2',  restId:'r1', name:'French Onion Soup',  emoji:'🥣', category:'Starters',    price:290,  desc:'Caramelized onion broth with gruyère crouton' },
    { id:'m3',  restId:'r1', name:'Duck Confit',         emoji:'🦆', category:'Main Course', price:890,  desc:'Slow-cooked duck leg with cherry reduction' },
    { id:'m4',  restId:'r1', name:'Beef Bourguignon',    emoji:'🥩', category:'Main Course', price:1100, desc:'Braised beef in Burgundy wine with root vegetables' },
    { id:'m5',  restId:'r1', name:'Crème Brûlée',        emoji:'🍮', category:'Desserts',    price:280,  desc:'Classic vanilla custard with caramelized sugar' },
    { id:'m6',  restId:'r1', name:'French Press Coffee', emoji:'☕', category:'Beverages',   price:180,  desc:'Premium single-origin arabica' },
    { id:'m7',  restId:'r2', name:'Edamame',             emoji:'🫘', category:'Starters',    price:180,  desc:'Steamed salted soybeans' },
    { id:'m8',  restId:'r2', name:'Miso Soup',           emoji:'🍜', category:'Starters',    price:150,  desc:'Traditional dashi with tofu and wakame' },
    { id:'m9',  restId:'r2', name:'Salmon Sashimi',      emoji:'🐟', category:'Main Course', price:650,  desc:'12 pieces of premium Atlantic salmon' },
    { id:'m10', restId:'r2', name:'Dragon Roll',          emoji:'🍣', category:'Main Course', price:580,  desc:'Spicy tuna inside, avocado outside' },
    { id:'m11', restId:'r2', name:'Matcha Ice Cream',    emoji:'🍦', category:'Desserts',    price:220,  desc:'Ceremonial grade matcha gelato' },
    { id:'m12', restId:'r2', name:'Sake',                 emoji:'🍶', category:'Beverages',   price:350,  desc:'Premium junmai daiginjo' },
    { id:'m13', restId:'r3', name:'Samosa Chaat',        emoji:'🥟', category:'Starters',    price:160,  desc:'Crispy samosas with tangy tamarind chutney' },
    { id:'m14', restId:'r3', name:'Seekh Kebab',         emoji:'🍢', category:'Starters',    price:280,  desc:'Spiced minced lamb grilled on skewers' },
    { id:'m15', restId:'r3', name:'Butter Chicken',      emoji:'🍗', category:'Main Course', price:380,  desc:'Creamy tomato-based chicken curry' },
    { id:'m16', restId:'r3', name:'Dal Makhani',         emoji:'🫕', category:'Main Course', price:260,  desc:'Slow-cooked black lentils in butter and cream' },
    { id:'m17', restId:'r3', name:'Gulab Jamun',         emoji:'🍩', category:'Desserts',    price:150,  desc:'Soft milk solids in rose sugar syrup' },
    { id:'m18', restId:'r3', name:'Masala Chai',         emoji:'🍵', category:'Beverages',   price:80,   desc:'Spiced milk tea' },
    { id:'m19', restId:'r4', name:'Bruschetta',          emoji:'🥖', category:'Starters',    price:220,  desc:'Grilled bread with tomato, basil and EVOO' },
    { id:'m20', restId:'r4', name:'Caprese Salad',       emoji:'🥗', category:'Starters',    price:280,  desc:'Buffalo mozzarella, heirloom tomatoes, pesto' },
    { id:'m21', restId:'r4', name:'Truffle Pasta',       emoji:'🍝', category:'Main Course', price:720,  desc:'Hand-rolled tagliatelle with black truffle' },
    { id:'m22', restId:'r4', name:'Margherita Pizza',    emoji:'🍕', category:'Main Course', price:480,  desc:'San Marzano tomatoes, fior di latte, basil' },
    { id:'m23', restId:'r4', name:'Tiramisu',            emoji:'🍰', category:'Desserts',    price:290,  desc:'Mascarpone, espresso, savoiardi biscuits' },
    { id:'m24', restId:'r4', name:'Limoncello',          emoji:'🍋', category:'Beverages',   price:250,  desc:'House-made Amalfi lemon liqueur' },
  ];
  for (const m of menus) await FireDB.setDoc('menus', m.id, m);

  // Offers
  const offers = [
    { id:'o1', text:'20% OFF your first booking!',                   code:'FIRST20'   },
    { id:'o2', text:'Free dessert on orders above ₹1500',            code:'SWEET1500' },
    { id:'o3', text:'Double loyalty points this weekend',            code:'WEEKEND2X' },
    { id:'o4', text:'Book for 4+ guests & get complimentary drinks', code:'GROUP4'    },
    { id:'o5', text:'Early bird: Book before noon, save 10%',        code:'EARLYBIRD' },
  ];
  for (const o of offers) await FireDB.setDoc('offers', o.id, o);

  console.log('✅ Seed complete!');
  return true;
}

// ══════════════════════════════════════
//  Load all collections into cache
//  then boot the app
// ══════════════════════════════════════
async function loadAllData() {
  const collections = ['restaurants','menus','users','bookings','reviews','notifications','waitlist','offers'];

  // Show loading overlay
  document.getElementById('app-loading').style.display = 'flex';

  try {
    // Seed if first run
    await seedIfEmpty();

    // Load all collections into cache
    for (const col of collections) {
      const data = await FireDB.getAll(col);
      window._cache[col] = data;
    }

    // Load admin (single doc)
    const adminData = await FireDB.getDoc('admin', 'admin');
    window._cache['admin'] = adminData;

    // Setup real-time listeners for live data
    FireDB.listen('bookings', data => {
      window._cache['bookings'] = data;
      if (typeof renderLiveStats === 'function') renderLiveStats();
    });

    FireDB.listen('restaurants', data => {
      window._cache['restaurants'] = data;
      if (typeof renderLiveStats === 'function') renderLiveStats();
    });

    console.log('✅ All data loaded from Firestore!');

    // Hide loading & boot app
    document.getElementById('app-loading').style.display = 'none';
    bootApp();

  } catch (e) {
    console.error('❌ Failed to load data:', e);
    document.getElementById('app-loading').innerHTML =
      `<div style="text-align:center;color:#E74C3C">
        ❌ Failed to connect to database.<br>
        <small>Check your internet connection and try refreshing.</small>
       </div>`;
  }
}

// Boot app after data is ready
function bootApp() {
  if (typeof renderOffersBanner === 'function') renderOffersBanner();
  if (typeof renderLiveStats    === 'function') renderLiveStats();
  if (typeof updateNavUI        === 'function') updateNavUI();
}

// Start loading when DOM is ready
document.addEventListener('DOMContentLoaded', loadAllData);
