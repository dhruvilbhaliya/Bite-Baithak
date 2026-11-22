// ══════════════════════════════════════
//  booking.js — Table Selection, Payment & Confirmation
// ══════════════════════════════════════

// ── Open Booking Flow ────────────────
function proceedToBook() {
  if (!currentUser) {
    toast('Please login to book a table', 'error');
    closeModal('restaurant-modal');
    openModal('auth-modal');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('book-date').min   = today;
  document.getElementById('book-date').value = today;

  selectedTable   = null;
  selectedPayment = null;
  document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('card-details').style.display   = 'none';
  document.getElementById('paypal-details').style.display = 'none';

  // Show loyalty points info
  const pts       = getUserPoints(currentUser.id);
  const discountEl = document.getElementById('points-discount-info');
  if (pts >= 100) {
    discountEl.style.display = 'block';
    discountEl.innerHTML = `🏆 You have <strong style="color:var(--gold)">${pts} loyalty points</strong>
      (≈ ₹${pts} value). Points are auto-applied to your next booking.`;
  } else {
    discountEl.style.display = 'none';
  }

  renderBookingTables();
  renderOrderSummary();
  openModal('booking-modal');
}

// ── Table Grid ───────────────────────
function renderBookingTables() {
  if (!currentRestaurant) return;
  const restaurants = DB.get('restaurants') || [];
  const rest        = restaurants.find(r => r.id === currentRestaurant.id);
  const waitlist    = DB.get('waitlist')    || [];

  document.getElementById('booking-tables-grid').innerHTML = rest.tables.map(t => {
    const wlCount = waitlist.filter(w => w.tableId === t.id && w.status === 'waiting').length;
    return `
      <div class="table-slot ${t.status} ${selectedTable === t.id ? 'selected' : ''}" onclick="selectTable('${t.id}')">
        <div class="table-icon">🪑</div>
        <div class="table-num">Table ${t.number}</div>
        <div class="table-seats">${t.seats} seats</div>
        <div class="table-status">${t.status}</div>
        ${t.status === 'occupied'
          ? `<button class="table-waitlist-btn" onclick="event.stopPropagation();openWaitlistModal('${t.id}','${rest.id}',${t.number})">
               + Waitlist${wlCount > 0 ? ` (${wlCount})` : ''}
             </button>`
          : ''}
      </div>`;
  }).join('');
}

function selectTable(tableId) {
  const restaurants = DB.get('restaurants') || [];
  const rest = restaurants.find(r => r.id === currentRestaurant.id);
  const tbl  = rest.tables.find(t => t.id === tableId);
  if (tbl.status !== 'free') return toast('This table is not available', 'error');
  selectedTable = tableId;
  renderBookingTables();
}

// ── Order Summary ────────────────────
function renderOrderSummary() {
  const list = document.getElementById('order-summary-list');
  if (cart.length === 0) {
    list.innerHTML = '<div class="text-muted">No items selected. You can still book the table.</div>';
    document.getElementById('order-summary-total').textContent = '0';
    return;
  }
  list.innerHTML = cart.map(i =>
    `<div class="order-item"><span>${i.emoji} ${i.name}</span><span class="text-gold">₹${i.price}</span></div>`
  ).join('');
  const total = cart.reduce((s, i) => s + i.price, 0);
  document.getElementById('order-summary-total').textContent = total.toLocaleString('en-IN');
}

// ── Payment Selection ────────────────
function selectPayment(method, el) {
  selectedPayment = method;
  document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('card-details').style.display   = (method === 'card' || method === 'debit') ? 'block' : 'none';
  document.getElementById('paypal-details').style.display = method === 'paypal' ? 'block' : 'none';
}

// ── Confirm Booking ──────────────────
function confirmBooking() {
  if (!selectedTable)   return toast('Please select a table', 'error');
  if (!selectedPayment) return toast('Please select a payment method', 'error');

  const date   = document.getElementById('book-date').value;
  const time   = document.getElementById('book-time').value;
  const guests = document.getElementById('book-guests').value;
  const notes  = document.getElementById('book-notes').value;
  if (!date) return toast('Please select a date', 'error');

  // Mark table occupied
  const restaurants = DB.get('restaurants') || [];
  const rIdx = restaurants.findIndex(r => r.id === currentRestaurant.id);
  const tIdx = restaurants[rIdx].tables.findIndex(t => t.id === selectedTable);
  restaurants[rIdx].tables[tIdx].status = 'occupied';
  DB.set('restaurants', restaurants);

  const total = cart.reduce((s, i) => s + i.price, 0);
  const pts   = calcPoints(total);

  const booking = {
    id:             'BK' + generateId().toUpperCase().slice(0, 6),
    userId:         currentUser.id,
    userName:       currentUser.username,
    userEmail:      currentUser.email,
    restaurantId:   currentRestaurant.id,
    restaurantName: currentRestaurant.name,
    tableId:        selectedTable,
    tableNum:       restaurants[rIdx].tables[tIdx].number,
    date, time,
    guests:         parseInt(guests),
    cart:           [...cart],
    total,
    paymentMethod:  selectedPayment,
    notes,
    status:         'confirmed',
    createdAt:      new Date().toLocaleString(),
    reviewed:       false,
    pointsEarned:   pts,
    dayOfWeek:      new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
  };
  DB.push('bookings', booking);

  // ── Send real booking confirmation email ──
  sendBookingEmail(booking);

  // Log notifications
  logNotification('Booking Confirmation', currentUser.email,
    `Booking Confirmed – ${currentRestaurant.name}`,
    `Dear ${currentUser.username}, your table at ${currentRestaurant.name} is confirmed for ${date} at ${time}. Total: ₹${total}. Points earned: ${pts}`);
  logNotification('New Booking', 'admin@bitebaithak.com',
    `New Booking – ${booking.id}`,
    `New booking: ${currentUser.username} | ${currentRestaurant.name} | ${date} at ${time}`);

  // Confirmed modal content
  document.getElementById('confirmed-details').innerHTML = `
    <div class="order-item"><span>🆔 Booking ID</span><span style="color:var(--gold)">${booking.id}</span></div>
    <div class="order-item"><span>🏠 Restaurant</span><span>${currentRestaurant.name}</span></div>
    <div class="order-item"><span>📅 Date &amp; Time</span><span>${date} at ${time}</span></div>
    <div class="order-item"><span>🪑 Table</span><span>Table ${booking.tableNum}</span></div>
    <div class="order-item"><span>👥 Guests</span><span>${guests}</span></div>
    <div class="order-item"><span>💳 Payment</span><span>${selectedPayment}</span></div>
    <div class="order-item"><span>💰 Total</span><span class="text-gold">₹${total.toLocaleString('en-IN')}</span></div>
    <div class="order-item"><span>📧 Confirmation</span><span style="color:var(--green)">Sent to ${currentUser.email}</span></div>
  `;

  const ptsMsg = document.getElementById('points-earned-msg');
  if (pts > 0) {
    ptsMsg.style.display = 'block';
    const totalPts = getUserPoints(currentUser.id);
    const tier     = getLoyaltyTier(totalPts);
    ptsMsg.innerHTML = `🏆 You earned <strong>${pts} loyalty points</strong>! Total: ${totalPts} pts | Tier: ${tier.emoji} ${tier.name}`;
  } else {
    ptsMsg.style.display = 'none';
  }

  closeModal('booking-modal');
  closeModal('restaurant-modal');
  openModal('confirmed-modal');
  updateNavUI();
  toast('Booking confirmed! Check your email 📧', 'success');
}

// ── Quick Re-book ────────────────────
function quickRebook(restaurantId) {
  const restaurants = DB.get('restaurants') || [];
  currentRestaurant = restaurants.find(r => r.id === restaurantId);
  if (!currentRestaurant) return;
  cart = [];
  document.getElementById('rest-modal-name').textContent    = currentRestaurant.name;
  document.getElementById('rest-modal-cuisine').textContent = currentRestaurant.cuisine;
  renderRestaurantMenu();
  updateCartUI();
  closeModal('confirmed-modal');
  openModal('restaurant-modal');
}
