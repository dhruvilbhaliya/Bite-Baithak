// ══════════════════════════════════════
//  profile.js — My Bookings, Reviews, Loyalty
// ══════════════════════════════════════

// ── Profile Page ─────────────────────
function renderProfile() {
  if (!currentUser) { showPage('home'); openModal('auth-modal'); return; }

  document.getElementById('profile-header').innerHTML = `
    <div class="avatar">${currentUser.username[0].toUpperCase()}</div>
    <div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;color:var(--cream)">${currentUser.username}</div>
      <div style="color:var(--muted);font-size:0.85rem">${currentUser.email}</div>
      <div class="chip mt-4">✓ Verified Account</div>
    </div>
  `;
  document.getElementById('loyalty-bar-wrap').innerHTML = renderLoyaltyBar(currentUser.id);
  renderBookingList();
  renderWaitlistList();
}

// ── Booking Filter ───────────────────
function setBookingFilter(filter, btn) {
  activeBookingFilter = filter;
  document.querySelectorAll('.filter-btn[data-bfilter]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBookingList();
}

function renderBookingList() {
  let bookings = (DB.get('bookings') || []).filter(b => b.userId === currentUser.id);
  if (activeBookingFilter !== 'all') {
    bookings = bookings.filter(b => b.status === activeBookingFilter);
  }

  const list = document.getElementById('my-bookings-list');
  if (bookings.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍽️</div>
        <div>No bookings yet</div>
        <button class="btn btn-gold btn-sm" onclick="showPage('restaurants')" style="margin-top:16px">Book a Table</button>
      </div>`;
    return;
  }

  list.innerHTML = [...bookings].reverse().map(b => `
    <div class="booking-card">
      <div class="booking-card-header">
        <div>
          <div class="booking-rest">${b.restaurantName}</div>
          <div class="booking-info">📅 ${b.date} at ${b.time} · 👥 ${b.guests} guests · Table ${b.tableNum}</div>
          <div class="booking-info">🆔 ${b.id} · 💳 ${b.paymentMethod} · 🏆 ${b.pointsEarned || 0} pts earned</div>
        </div>
        <span class="badge ${b.status === 'confirmed' ? 'badge-green' : 'badge-red'}">${b.status}</span>
      </div>
      ${b.cart.length > 0
        ? `<div style="font-size:0.82rem;color:var(--muted);margin-bottom:12px">
             Items: ${b.cart.map(i => i.emoji + ' ' + i.name).join(', ')}
           </div>`
        : ''}
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <span style="color:var(--gold);font-weight:600">₹${b.total.toLocaleString('en-IN')}</span>
        ${b.status === 'confirmed'
          ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking('${b.id}')">Cancel</button>`
          : ''}
        ${b.status === 'confirmed' && !b.reviewed
          ? `<button class="btn btn-success btn-sm" onclick="openReviewModal('${b.id}')">Review</button>`
          : ''}
        ${b.reviewed ? `<span class="badge badge-green">✓ Reviewed</span>` : ''}
        <button class="btn btn-purple btn-sm" onclick="quickRebook('${b.restaurantId}')">🔄 Rebook</button>
      </div>
    </div>`
  ).join('');
}

// ── Cancel Booking ───────────────────
function cancelBooking(bookingId) {
  const bookings = DB.get('bookings') || [];
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx < 0) return;

  bookings[idx].status      = 'cancelled';
  bookings[idx].cancelledAt = new Date().toLocaleString();
  bookings[idx].pointsEarned = 0; // forfeit points
  DB.set('bookings', bookings);

  // Free the table & notify waitlist
  const restaurants = DB.get('restaurants') || [];
  const rIdx = restaurants.findIndex(r => r.id === bookings[idx].restaurantId);
  if (rIdx >= 0) {
    const tIdx = restaurants[rIdx].tables.findIndex(t => t.id === bookings[idx].tableId);
    if (tIdx >= 0) {
      restaurants[rIdx].tables[tIdx].status = 'free';
      notifyWaitlist(bookings[idx].tableId);
    }
    DB.set('restaurants', restaurants);
  }

  logNotification('Cancellation', bookings[idx].userEmail,
    `Booking Cancelled – ${bookingId}`,
    `Your booking at ${bookings[idx].restaurantName} has been cancelled.`);

  toast('Booking cancelled', 'info');
  updateNavUI();
  renderProfile();
}

// ── Reviews ──────────────────────────
let reviewStars = 5;

function openReviewModal(bookingId) {
  document.getElementById('review-booking-id').value = bookingId;
  reviewStars = 5;
  setupStarRating();
  openModal('review-modal');
}

function setupStarRating() {
  const el = document.getElementById('star-rating');
  el.textContent = '⭐'.repeat(reviewStars) + '☆'.repeat(5 - reviewStars);
  el.onclick = function (e) {
    const rect = el.getBoundingClientRect();
    reviewStars = Math.ceil((e.clientX - rect.left) / (rect.width / 5));
    el.textContent = '⭐'.repeat(reviewStars) + '☆'.repeat(5 - reviewStars);
    document.getElementById('review-rating').value = reviewStars;
  };
}

function submitReview() {
  const bookingId = document.getElementById('review-booking-id').value;
  const text      = document.getElementById('review-text').value.trim();
  const rating    = parseInt(document.getElementById('review-rating').value) || 5;
  if (!text) return toast('Please write a review', 'error');

  const bookings = DB.get('bookings') || [];
  const booking  = bookings.find(b => b.id === bookingId);
  if (!booking) return;

  DB.push('reviews', {
    id:             generateId(),
    bookingId,
    userId:         currentUser.id,
    userName:       currentUser.username,
    restaurantId:   booking.restaurantId,
    restaurantName: booking.restaurantName,
    rating, text,
    createdAt:      new Date().toLocaleString(),
  });

  const idx = bookings.findIndex(b => b.id === bookingId);
  bookings[idx].reviewed = true;
  DB.set('bookings', bookings);

  closeModal('review-modal');
  toast('Review submitted!', 'success');
  renderProfile();
}