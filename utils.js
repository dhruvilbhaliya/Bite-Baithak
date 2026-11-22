// ══════════════════════════════════════
//  utils.js — Shared Utilities & State
// ══════════════════════════════════════
 
// ── Global State ─────────────────────
let currentUser       = null;
let currentRestaurant = null;
let cart              = [];
let selectedTable     = null;
let selectedPayment   = null;
let otpStore          = {};
let activeFilter      = 'all';
let activeBookingFilter = 'all';
 
// ── EmailJS Config ────────────────────
// ⚠️ Replace these with your actual IDs from EmailJS dashboard
const EMAILJS_SERVICE_ID  = 'service_9lp8ube';
const EMAILJS_BOOKING_TID = 'template_kdtrb5o';
const EMAILJS_OTP_TID     = 'template_38e8oo3';
const EMAILJS_WELCOME_TID = 'YOUR_WELCOME_TEMPLATE_ID'; // Optional — leave as is if not needed
 
// ── Send Booking Confirmation Email ──
async function sendBookingEmail(booking) {
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_BOOKING_TID, {
      email:           booking.userEmail,
      user_name:       booking.userName,
      restaurant_name: booking.restaurantName,
      booking_id:      booking.id,
      date:            booking.date,
      time:            booking.time,
      table_num:       booking.tableNum,
      guests:          booking.guests,
      total:           '₹' + booking.total.toLocaleString('en-IN'),
      payment:         booking.paymentMethod,
      items:           booking.cart.length > 0
                         ? booking.cart.map(i => i.emoji + ' ' + i.name).join(', ')
                         : 'No pre-ordered items',
    });
    console.log('✅ Booking confirmation email sent to', booking.userEmail);
  } catch (err) {
    console.error('❌ Booking email failed:', err);
    // Don't block the user — booking is still confirmed even if email fails
  }
}
 
// ── Send Password Reset OTP Email ────
async function sendOTPEmail(toEmail, toName, otp) {
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_OTP_TID, {
      // Recipient info
      email:      toEmail,
      to_email:   toEmail,   // alternate name some templates use
      to_name:    toName || toEmail,
      user_name:  toName || toEmail,
 
      // OTP — sent under every common variable name so it works
      // regardless of what your EmailJS template uses
      otp:        otp,
      passcode:   otp,
      code:       otp,
      message:    `Your BiteBaithak OTP is: ${otp}. It expires in 10 minutes.`,
 
      subject:    'BiteBaithak – OTP Verification',
    });
    console.log('✅ OTP email sent to', toEmail);
  } catch (err) {
    console.error('❌ OTP email failed:', err);
    toast('Could not send email. Check notification log for OTP.', 'error');
  }
}
 
// ── Send Welcome Email ────────────────
async function sendWelcomeEmail(user) {
  // Only send if a welcome template ID is configured
  if (EMAILJS_WELCOME_TID === 'YOUR_WELCOME_TEMPLATE_ID') return;
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_WELCOME_TID, {
      email:     user.email,
      user_name: user.username,
    });
    console.log('✅ Welcome email sent to', user.email);
  } catch (err) {
    console.error('❌ Welcome email failed:', err);
  }
}
 
// ── Crypto / ID ──────────────────────
function hashPassword(p) { return btoa(unescape(encodeURIComponent(p))); }
function generateOTP()   { return Math.floor(100000 + Math.random() * 900000).toString(); }
function generateId()    { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
 
// ── Toast ────────────────────────────
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
 
// ── Modal ────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
 
// ── Page Router ──────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (id === 'restaurants') renderRestaurants();
  if (id === 'profile')     renderProfile();
  if (id === 'admin')       renderAdminPanel();
  if (id === 'home')        renderLiveStats();
  window.scrollTo(0, 0);
}
 
// ── Notification Logger ──────────────
function logNotification(type, recipient, subject, body) {
  const notifs = DB.get('notifications') || [];
  notifs.unshift({ id: generateId(), type, recipient, subject, body, time: new Date().toLocaleString() });
  DB.set('notifications', notifs);
}
 
// ── Theme Toggle ─────────────────────
function toggleTheme() {
  const html  = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-btn').textContent = isDark ? '☀️' : '🌙';
  toast(isDark ? 'Light mode on' : 'Dark mode on', 'info');
}
 
// ── Offers Banner ────────────────────
function renderOffersBanner() {
  const offers = DB.get('offers') || [];
  const track  = document.getElementById('offers-track');
  const pills  = offers.map(o =>
    `<div class="offer-pill">🎁 ${o.text} <span>${o.code}</span></div>`
  ).join('');
  track.innerHTML = pills + pills; // doubled for seamless CSS loop
}
 
// ── Live Stats (Home) ────────────────
function renderLiveStats() {
  const restaurants = DB.get('restaurants') || [];
  const bookings    = DB.get('bookings')    || [];
  const freeTables  = restaurants.reduce((s, r) => s + r.tables.filter(t => t.status === 'free').length, 0);
  const confirmed   = bookings.filter(b => b.status === 'confirmed').length;
  document.getElementById('live-stats-bar').innerHTML = `
    <div class="live-stat"><div class="live-stat-val">${restaurants.length}</div><div class="live-stat-label">Restaurants</div></div>
    <div class="live-stat"><div class="live-stat-val"><span class="live-dot"></span>${freeTables}</div><div class="live-stat-label">Tables Free Now</div></div>
    <div class="live-stat"><div class="live-stat-val">${confirmed}</div><div class="live-stat-label">Total Bookings</div></div>
  `;
}
 
// ── Loyalty System ───────────────────
function calcPoints(total)      { return Math.floor(total / 10); }
 
function getUserPoints(userId) {
  return (DB.get('bookings') || [])
    .filter(b => b.userId === userId && b.status === 'confirmed')
    .reduce((s, b) => s + (b.pointsEarned || 0), 0);
}
 
function getLoyaltyTier(pts) {
  if (pts >= 1000) return { name:'Platinum', class:'tier-platinum', next:null,  emoji:'💎' };
  if (pts >=  500) return { name:'Gold',     class:'tier-gold',     next:1000,  emoji:'🥇' };
  if (pts >=  200) return { name:'Silver',   class:'tier-silver',   next:500,   emoji:'🥈' };
  return               { name:'Bronze',   class:'tier-bronze',   next:200,   emoji:'🥉' };
}
 
function renderLoyaltyBar(userId) {
  const pts  = getUserPoints(userId);
  const tier = getLoyaltyTier(pts);
  const pct  = tier.next ? Math.min(100, Math.round(pts / tier.next * 100)) : 100;
  return `<div class="loyalty-bar">
    <div class="loyalty-info">
      <div class="loyalty-icon">${tier.emoji}</div>
      <div>
        <div class="loyalty-pts">${pts} Points</div>
        <div class="loyalty-label">Loyalty Balance</div>
        ${tier.next
          ? `<div class="points-bar"><div class="points-fill" style="width:${pct}%"></div></div>
             <div style="font-size:0.72rem;color:var(--muted);margin-top:4px">${tier.next - pts} pts to ${getLoyaltyTier(tier.next).name}</div>`
          : `<div style="font-size:0.72rem;color:var(--gold);margin-top:4px">Max tier achieved! 🎉</div>`
        }
      </div>
    </div>
    <div style="text-align:right">
      <span class="loyalty-tier ${tier.class}">${tier.emoji} ${tier.name}</span>
      <div style="font-size:0.72rem;color:var(--muted);margin-top:6px">Earn 1 pt per ₹10 spent</div>
    </div>
  </div>`;
}
 
// ── Nav UI ───────────────────────────
function updateNavUI() {
  if (currentUser) {
    document.getElementById('nav-auth').style.display = 'none';
    const navUser = document.getElementById('nav-user');
    navUser.style.display = 'flex';
    if (currentUser.isAdmin) {
      navUser.innerHTML = `<span class="chip">⚙️ Admin</span>
        <button class="nav-btn" onclick="showPage('admin')">Admin Panel</button>
        <button class="nav-btn outline" onclick="logout()">Logout</button>`;
    } else {
      const pts  = getUserPoints(currentUser.id);
      const tier = getLoyaltyTier(pts);
      navUser.innerHTML = `<span class="chip">${tier.emoji} ${pts} pts</span>
        <button class="nav-btn" onclick="showPage('profile')">My Bookings</button>
        <button class="nav-btn" onclick="openDiningPassport()">🛂 Passport</button>
        <button class="nav-btn outline" onclick="logout()">Logout</button>`;
    }
  } else {
    document.getElementById('nav-auth').style.display = 'flex';
    document.getElementById('nav-user').style.display = 'none';
  }
}
 
function logout() {
  currentUser = null; cart = []; selectedTable = null; selectedPayment = null;
  updateNavUI();
  showPage('home');
  toast('Logged out', 'info');
}
 
// ── Cart UI ──────────────────────────
function updateCartUI() {
  const total = cart.reduce((s, i) => s + i.price, 0);
  document.getElementById('cart-count').textContent = `${cart.length} items`;
  document.getElementById('cart-total').textContent  = total.toLocaleString('en-IN');
}
 
// ── Card formatting ──────────────────
function formatCard(el) {
  let v = el.value.replace(/\D/g, '').substring(0, 16);
  el.value = v.replace(/(.{4})/g, '$1 ').trim();
}
 
// ── Waitlist table-side helper ────────
function notifyWaitlist(tableId) {
  const waitlist = DB.get('waitlist') || [];
  const first    = waitlist.find(w => w.tableId === tableId && w.status === 'waiting');
  if (first) {
    logNotification('Waitlist Notification', first.userEmail, 'Table Available!',
      `Great news! The table you were waiting for at ${first.restaurantName} is now available. Book quickly!`);
    toast(`Waitlist notification sent to ${first.userName}`, 'info');
  }
}
 