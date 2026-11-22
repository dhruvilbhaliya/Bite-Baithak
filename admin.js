// ══════════════════════════════════════
//  admin.js — Admin Panel, Analytics, Menu Manager
// ══════════════════════════════════════

let adminSelectedRestId = null;
let editingMenuItem     = null;

// ── Tab Router ───────────────────────
function adminTab(tab) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('admin-' + tab).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  const renderers = {
    dashboard:     renderAdminDashboard,
    analytics:     renderAnalytics,
    tables:        renderAdminTables,
    bookings:      renderAdminBookings,
    waitlist:      renderAdminWaitlist,
    cancelled:     renderAdminCancelled,
    restaurants:   renderAdminRestaurants,
    menu:          renderAdminMenu,
    reviews:       renderAdminReviews,
    notifications: renderAdminNotifications,
    users:         renderAdminUsers,
  };
  if (renderers[tab]) renderers[tab]();
}

function renderAdminPanel() {
  if (!currentUser?.isAdmin) { showPage('home'); return; }
  document.getElementById('admin-name-display').textContent = 'Admin';
  renderAdminDashboard();
}

// ── Dashboard ────────────────────────
function renderAdminDashboard() {
  const bookings    = DB.get('bookings')    || [];
  const users       = DB.get('users')       || [];
  const reviews     = DB.get('reviews')     || [];
  const restaurants = DB.get('restaurants') || [];
  const waitlist    = DB.get('waitlist')    || [];

  const confirmed    = bookings.filter(b => b.status === 'confirmed');
  const cancelled    = bookings.filter(b => b.status === 'cancelled');
  const totalRevenue = confirmed.reduce((s, b) => s + b.total, 0);
  const freeTables   = restaurants.reduce((s, r) => s + r.tables.filter(t => t.status === 'free').length, 0);
  const avgRating    = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  document.getElementById('admin-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Bookings</div><div class="stat-value">${bookings.length}</div><div class="stat-change">↑ Confirmed: ${confirmed.length}</div></div>
    <div class="stat-card"><div class="stat-label">Registered Users</div><div class="stat-value">${users.length}</div></div>
    <div class="stat-card"><div class="stat-label">Revenue</div><div class="stat-value">₹${(totalRevenue / 1000).toFixed(1)}K</div></div>
    <div class="stat-card"><div class="stat-label">Free Tables</div><div class="stat-value">${freeTables}</div><div class="stat-change" style="color:var(--red)">Cancelled: ${cancelled.length}</div></div>
    <div class="stat-card"><div class="stat-label">Reviews</div><div class="stat-value">${reviews.length}</div><div class="stat-change">Avg: ${avgRating} ⭐</div></div>
    <div class="stat-card"><div class="stat-label">Waitlist</div><div class="stat-value">${waitlist.filter(w => w.status === 'waiting').length}</div><div class="stat-change">Active entries</div></div>
  `;

  document.getElementById('recent-bookings-body').innerHTML = [...bookings].slice(-8).reverse().map(b => `
    <tr>
      <td>${b.userName || '—'}</td><td>${b.restaurantName}</td>
      <td>${b.date} ${b.time}</td><td>Table ${b.tableNum}</td>
      <td><span class="badge ${b.status === 'confirmed' ? 'badge-green' : 'badge-red'}">${b.status}</span></td>
    </tr>`
  ).join('') || '<tr><td colspan="5" class="text-muted">No bookings yet</td></tr>';
}

// ── Analytics ────────────────────────
function renderAnalytics() {
  const bookings    = DB.get('bookings')    || [];
  const restaurants = DB.get('restaurants') || [];
  const days        = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // Bar chart: bookings by day
  const dayCounts = Object.fromEntries(days.map(d => [d, 0]));
  bookings.forEach(b => { if (b.dayOfWeek) dayCounts[b.dayOfWeek]++; });
  const maxDay = Math.max(...Object.values(dayCounts), 1);
  document.getElementById('bookings-bar-chart').innerHTML = days.map(d => {
    const val = dayCounts[d] || 0;
    const h   = Math.max(4, Math.round((val / maxDay) * 140));
    return `<div class="bar-col">
      <div class="bar-val">${val}</div>
      <div class="bar" style="height:${h}px"></div>
      <div class="bar-label">${d.slice(0, 3)}</div>
    </div>`;
  }).join('');

  // Revenue by restaurant
  const revByRest = Object.fromEntries(restaurants.map(r => [r.name, 0]));
  bookings.filter(b => b.status === 'confirmed').forEach(b => {
    revByRest[b.restaurantName] = (revByRest[b.restaurantName] || 0) + b.total;
  });
  const maxRev = Math.max(...Object.values(revByRest), 1);
  document.getElementById('revenue-bars').innerHTML = Object.entries(revByRest).map(([name, rev]) => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
        <span>${name}</span><span class="text-gold">₹${rev.toLocaleString('en-IN')}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(rev / maxRev * 100)}%"></div></div>
    </div>`
  ).join('');

  // Donut: confirmed vs cancelled
  const conf  = bookings.filter(b => b.status === 'confirmed').length;
  const canc  = bookings.filter(b => b.status === 'cancelled').length;
  const total = conf + canc || 1;
  const confPct = Math.round(conf / total * 100);
  const r = 50, circ = 2 * Math.PI * r;
  document.getElementById('status-donut-wrap').innerHTML = `
    <div class="donut">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(192,57,43,0.2)" stroke-width="18"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--gold)" stroke-width="18"
          stroke-dasharray="${circ * confPct / 100} ${circ * (1 - confPct / 100)}" stroke-linecap="round"/>
      </svg>
      <div class="donut-label"><div class="donut-pct">${confPct}%</div><div class="donut-sub">Confirmed</div></div>
    </div>
    <div class="donut-legend">
      <div class="legend-item"><div class="legend-dot" style="background:var(--gold)"></div> Confirmed: ${conf}</div>
      <div class="legend-item"><div class="legend-dot" style="background:rgba(192,57,43,0.6)"></div> Cancelled: ${canc}</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--muted)"></div> Total: ${total}</div>
    </div>`;

  // Top menu items
  const itemCounts = {};
  bookings.forEach(b => b.cart?.forEach(item => {
    if (!itemCounts[item.name]) itemCounts[item.name] = { count: 0, emoji: item.emoji };
    itemCounts[item.name].count++;
  }));
  const topItems = Object.entries(itemCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
  const maxItem  = topItems.length ? topItems[0][1].count : 1;
  document.getElementById('top-items-chart').innerHTML = topItems.length
    ? topItems.map(([name, { count, emoji }]) => `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <span style="font-size:1.2rem;width:28px">${emoji}</span>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:3px">
              <span>${name}</span><span class="text-gold">${count}x</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(count / maxItem * 100)}%"></div></div>
          </div>
        </div>`).join('')
    : '<div class="text-muted">No orders yet.</div>';
}

// ── Tables ───────────────────────────
function renderAdminTables() {
  const restaurants = DB.get('restaurants') || [];
  if (!adminSelectedRestId) adminSelectedRestId = restaurants[0]?.id;

  document.getElementById('admin-restaurant-tabs').innerHTML = restaurants.map(r =>
    `<div class="menu-tab ${r.id === adminSelectedRestId ? 'active' : ''}" onclick="selectAdminRestaurant('${r.id}')">${r.emoji} ${r.name}</div>`
  ).join('');

  const rest = restaurants.find(r => r.id === adminSelectedRestId);
  if (!rest) return;

  document.getElementById('admin-tables-grid').innerHTML = rest.tables.map(t => `
    <div class="table-slot ${t.status}" onclick="openTableStatusModal('${rest.id}','${t.id}','${t.number}')">
      <div class="table-icon">🪑</div>
      <div class="table-num">Table ${t.number}</div>
      <div class="table-seats">${t.seats} seats</div>
      <div class="table-status">${t.status}</div>
    </div>`
  ).join('');
}

function selectAdminRestaurant(id) {
  adminSelectedRestId = id;
  renderAdminTables();
}

function openTableStatusModal(restId, tableId, tableNum) {
  document.getElementById('ts-restaurant-id').value = restId;
  document.getElementById('ts-table-id').value      = tableId;
  document.getElementById('ts-modal-title').textContent = `Table ${tableNum} – Change Status`;
  openModal('table-status-modal');
}

function setTableStatus(status) {
  const restId  = document.getElementById('ts-restaurant-id').value;
  const tableId = document.getElementById('ts-table-id').value;

  const restaurants = DB.get('restaurants') || [];
  const rIdx = restaurants.findIndex(r => r.id === restId);
  const tIdx = restaurants[rIdx].tables.findIndex(t => t.id === tableId);
  const oldStatus = restaurants[rIdx].tables[tIdx].status;

  restaurants[rIdx].tables[tIdx].status = status;
  DB.set('restaurants', restaurants);

  // Notify waitlist when a table is freed
  if (oldStatus === 'occupied' && status === 'free') notifyWaitlist(tableId);

  closeModal('table-status-modal');
  toast(`Table set to ${status}`, 'success');
  renderAdminTables();
}

// ── All Bookings ─────────────────────
function renderAdminBookings() {
  const bookings = DB.get('bookings') || [];
  document.getElementById('all-bookings-body').innerHTML = [...bookings].reverse().map(b => `
    <tr>
      <td style="color:var(--gold)">${b.id}</td>
      <td>${b.userName}</td><td>${b.restaurantName}</td>
      <td>${b.date} ${b.time}</td><td>Table ${b.tableNum}</td>
      <td>${b.guests}</td><td>₹${b.total.toLocaleString('en-IN')}</td>
      <td><span class="badge badge-purple">${b.pointsEarned || 0} pts</span></td>
      <td><span class="badge ${b.status === 'confirmed' ? 'badge-green' : 'badge-red'}">${b.status}</span></td>
      <td>${b.status === 'confirmed'
        ? `<button class="btn btn-danger btn-sm" onclick="adminCancelBooking('${b.id}')">Cancel</button>`
        : '—'}</td>
    </tr>`
  ).join('') || '<tr><td colspan="10" class="text-muted" style="text-align:center;padding:40px">No bookings yet</td></tr>';
}

function adminCancelBooking(id) {
  const bookings = DB.get('bookings') || [];
  const idx = bookings.findIndex(b => b.id === id);
  if (idx < 0) return;

  bookings[idx].status       = 'cancelled';
  bookings[idx].cancelledAt  = new Date().toLocaleString();
  bookings[idx].pointsEarned = 0;
  DB.set('bookings', bookings);

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
    `Booking Cancelled by Admin – ${id}`,
    `Your booking has been cancelled by the restaurant.`);

  toast('Booking cancelled', 'info');
  renderAdminBookings();
}

// ── Waitlist ─────────────────────────
function renderAdminWaitlist() {
  const waitlist = DB.get('waitlist') || [];
  const el = document.getElementById('admin-waitlist-list');
  if (waitlist.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div>No waitlist entries</div></div>';
    return;
  }

  // Group by tableId
  const grouped = {};
  waitlist.forEach(w => { if (!grouped[w.tableId]) grouped[w.tableId] = []; grouped[w.tableId].push(w); });

  el.innerHTML = Object.entries(grouped).map(([tableId, entries]) => `
    <div class="chart-wrap">
      <div class="chart-title">Table: ${tableId} — ${entries[0].restaurantName}</div>
      ${entries.map(w => `
        <div class="waitlist-card">
          <div class="waitlist-info">
            <span class="waitlist-pos">#${w.position}</span>
            <strong>${w.userName}</strong> · ${w.date} at ${w.time} · ${w.guests} guests
            <div style="font-size:0.72rem;color:var(--muted)">${w.userEmail} · ${w.createdAt}</div>
          </div>
          <span class="badge ${w.status === 'waiting' ? 'badge-gold' : 'badge-green'}">${w.status}</span>
        </div>`).join('')}
    </div>`
  ).join('');
}

// ── Cancelled ────────────────────────
function renderAdminCancelled() {
  const bookings = (DB.get('bookings') || []).filter(b => b.status === 'cancelled');
  document.getElementById('cancelled-bookings-body').innerHTML = bookings.map(b => `
    <tr>
      <td style="color:var(--red)">${b.id}</td><td>${b.userName}</td>
      <td>${b.restaurantName}</td><td>${b.date} ${b.time}</td>
      <td>${b.cancelledAt || '—'}</td><td>${b.notes || '—'}</td>
    </tr>`
  ).join('') || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:40px">No cancelled bookings</td></tr>';
}

// ── Restaurant Manager ────────────────
function renderAdminRestaurants() {
  const restaurants = DB.get('restaurants') || [];
  const bookings    = DB.get('bookings')    || [];
  const grid = document.getElementById('admin-restaurants-grid');

  if (restaurants.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🏠</div><div>No restaurants yet. Add one!</div></div>`;
    return;
  }

  grid.innerHTML = restaurants.map(r => {
    const freeTables  = r.tables.filter(t => t.status === 'free').length;
    const totalTables = r.tables.length;
    const restBookings = bookings.filter(b => b.restaurantId === r.id && b.status === 'confirmed').length;
    return `
      <div class="restaurant-card" style="position:relative">
        <div class="r-img">
          <span style="z-index:1;position:relative;font-size:5rem">${r.emoji}</span>
        </div>
        <div class="r-info">
          <div class="r-name">${r.name}</div>
          <div class="r-cuisine">${r.cuisine}</div>
          <div class="r-desc" style="font-size:0.8rem">${r.desc || ''}</div>
          <div class="r-meta">
            <span>⭐ ${r.rating}</span>
            <span>${r.priceRange}</span>
            <span>🪑 ${freeTables}/${totalTables} free</span>
            <span>📅 ${restBookings} bookings</span>
          </div>
        </div>
        <div class="r-actions">
          <button class="btn btn-danger btn-sm" onclick="deleteRestaurant('${r.id}')">🗑️ Delete Restaurant</button>
        </div>
      </div>`;
  }).join('');
}

function openAddRestaurantModal() {
  document.getElementById('add-rest-modal-title').textContent = 'Add New Restaurant';
  document.getElementById('edit-rest-id').value   = '';
  document.getElementById('rest-name').value      = '';
  document.getElementById('rest-emoji').value     = '';
  document.getElementById('rest-cuisine').value   = '';
  document.getElementById('rest-desc').value      = '';
  document.getElementById('rest-rating').value    = '4.5';
  document.getElementById('rest-table-count').value = '10';
  document.getElementById('rest-price-range').value = '₹₹';
  openModal('add-restaurant-modal');
}

function saveRestaurant() {
  const name       = document.getElementById('rest-name').value.trim();
  const emoji      = document.getElementById('rest-emoji').value.trim() || '🍽️';
  const cuisine    = document.getElementById('rest-cuisine').value.trim();
  const desc       = document.getElementById('rest-desc').value.trim();
  const priceRange = document.getElementById('rest-price-range').value;
  const rating     = parseFloat(document.getElementById('rest-rating').value) || 4.5;
  const tableCount = parseInt(document.getElementById('rest-table-count').value) || 10;
  const priceLevel = priceRange.length;

  if (!name || !cuisine) return toast('Name and cuisine are required', 'error');
  if (rating < 1 || rating > 5) return toast('Rating must be between 1 and 5', 'error');

  // Generate tables
  const id = 'r' + generateId();
  const pool = ['free','free','free','free','occupied','free','free','maintenance','free','free'];
  const tables = [];
  for (let i = 1; i <= tableCount; i++) {
    tables.push({
      id: `${id}_t${i}`, number: i,
      seats: [2,2,4,4,4,6,6,8][Math.floor(Math.random() * 8)],
      status: pool[i % pool.length],
    });
  }

  const restaurant = { id, name, emoji, cuisine, desc, priceRange, priceLevel, rating, tables };
  DB.push('restaurants', restaurant);

  logNotification('Restaurant Added', 'admin@bitebaithak.com',
    `New Restaurant: ${name}`,
    `${emoji} ${name} (${cuisine}) has been added to the platform with ${tableCount} tables.`);

  toast(`${emoji} ${name} added successfully!`, 'success');
  closeModal('add-restaurant-modal');
  renderAdminRestaurants();
  renderLiveStats();
}

function deleteRestaurant(restId) {
  const restaurants = DB.get('restaurants') || [];
  const rest = restaurants.find(r => r.id === restId);
  if (!rest) return;

  // Confirm before deleting
  if (!confirm(`⚠️ Delete "${rest.name}"?\n\nThis will permanently remove the restaurant. Existing bookings will be preserved in history.`)) return;

  // Remove restaurant
  DB.set('restaurants', restaurants.filter(r => r.id !== restId));
  FireDB.deleteDoc('restaurants', restId);

  // Remove its menu items
  const menus = DB.get('menus') || [];
  const menusToDelete = menus.filter(m => m.restId === restId);
  DB.set('menus', menus.filter(m => m.restId !== restId));
  menusToDelete.forEach(m => FireDB.deleteDoc('menus', m.id));

  logNotification('Restaurant Deleted', 'admin@bitebaithak.com',
    `Restaurant Removed: ${rest.name}`,
    `${rest.emoji} ${rest.name} has been removed from the platform.`);

  toast(`${rest.emoji} ${rest.name} deleted`, 'info');
  renderAdminRestaurants();
  renderLiveStats();
}

// ── Menu Manager ─────────────────────
function renderAdminMenu(activeRestId = null) {
  const restaurants = DB.get('restaurants') || [];
  const menus       = DB.get('menus')       || [];
  if (!activeRestId) activeRestId = 'all';

  document.getElementById('admin-menu-rest-tabs').innerHTML = `
    <div class="menu-tab ${activeRestId === 'all' ? 'active' : ''}" onclick="renderAdminMenu('all')">All</div>
    ${restaurants.map(r =>
      `<div class="menu-tab ${r.id === activeRestId ? 'active' : ''}" onclick="renderAdminMenu('${r.id}')">${r.emoji} ${r.name}</div>`
    ).join('')}`;

  const items   = activeRestId === 'all' ? menus : menus.filter(m => m.restId === activeRestId);
  const restMap = Object.fromEntries(restaurants.map(r => [r.id, r.name]));

  document.getElementById('admin-menu-body').innerHTML = items.map(item => `
    <tr>
      <td>${item.emoji} ${item.name}</td>
      <td><span class="badge badge-blue">${item.category}</span></td>
      <td class="text-gold">₹${item.price}</td>
      <td>${restMap[item.restId] || item.restId}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-outline btn-sm" onclick="editMenuItem('${item.id}')">Edit</button>
          <button class="btn btn-danger btn-sm"  onclick="deleteMenuItem('${item.id}')">Delete</button>
        </div>
      </td>
    </tr>`
  ).join('');
}

function openAddMenuItemModal() {
  editingMenuItem = null;
  document.getElementById('menu-item-modal-title').textContent = 'Add Menu Item';
  document.getElementById('edit-item-id').value = '';
  ['item-name', 'item-emoji', 'item-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('item-price').value = '';
  const restaurants = DB.get('restaurants') || [];
  document.getElementById('item-restaurant').innerHTML = restaurants.map(r =>
    `<option value="${r.id}">${r.emoji} ${r.name}</option>`
  ).join('');
  openModal('menu-item-modal');
}

function editMenuItem(id) {
  const menus = DB.get('menus') || [];
  const item  = menus.find(m => m.id === id);
  if (!item) return;

  editingMenuItem = id;
  document.getElementById('menu-item-modal-title').textContent = 'Edit Menu Item';
  document.getElementById('edit-item-id').value   = id;
  document.getElementById('item-name').value      = item.name;
  document.getElementById('item-emoji').value     = item.emoji;
  document.getElementById('item-desc').value      = item.desc;
  document.getElementById('item-price').value     = item.price;
  document.getElementById('item-category').value  = item.category;

  const restaurants = DB.get('restaurants') || [];
  document.getElementById('item-restaurant').innerHTML = restaurants.map(r =>
    `<option value="${r.id}" ${r.id === item.restId ? 'selected' : ''}>${r.emoji} ${r.name}</option>`
  ).join('');
  openModal('menu-item-modal');
}

function saveMenuItem() {
  const name     = document.getElementById('item-name').value.trim();
  const emoji    = document.getElementById('item-emoji').value.trim() || '🍽️';
  const desc     = document.getElementById('item-desc').value.trim();
  const price    = parseInt(document.getElementById('item-price').value) || 0;
  const category = document.getElementById('item-category').value;
  const restId   = document.getElementById('item-restaurant').value;
  if (!name || !price) return toast('Fill required fields', 'error');

  const menus = DB.get('menus') || [];
  if (editingMenuItem) {
    const idx = menus.findIndex(m => m.id === editingMenuItem);
    if (idx >= 0) Object.assign(menus[idx], { name, emoji, desc, price, category, restId });
    DB.set('menus', menus);
    toast('Item updated', 'success');
  } else {
    DB.push('menus', { id: generateId(), restId, name, emoji, category, price, desc });
    toast('Item added', 'success');
  }
  closeModal('menu-item-modal');
  renderAdminMenu();
}

function deleteMenuItem(id) {
  const menus = DB.get('menus') || [];
  DB.set('menus', menus.filter(m => m.id !== id));
  FireDB.deleteDoc('menus', id);
  toast('Item deleted', 'info');
  renderAdminMenu();
}

// ── Reviews ──────────────────────────
function renderAdminReviews() {
  const reviews = DB.get('reviews') || [];
  const el = document.getElementById('admin-reviews-list');
  if (reviews.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div><div>No reviews yet</div></div>';
    return;
  }
  el.innerHTML = reviews.map(r => `
    <div class="review-card">
      <div class="review-header">
        <div>
          <div class="review-user">${r.userName} <span style="color:var(--muted);font-size:0.78rem">on ${r.restaurantName}</span></div>
          <div class="stars">${'⭐'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        </div>
        <div style="font-size:0.72rem;color:var(--muted)">${r.createdAt}</div>
      </div>
      <div class="review-text">${r.text}</div>
    </div>`
  ).join('');
}

// ── Notifications ─────────────────────
function renderAdminNotifications() {
  const notifs = DB.get('notifications') || [];
  const el = document.getElementById('notification-log');
  if (notifs.length === 0) {
    el.innerHTML = '<div class="text-muted" style="text-align:center;padding:20px">No notifications yet</div>';
    return;
  }
  el.innerHTML = notifs.map(n => `
    <div class="notif-item">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <strong style="font-size:0.85rem">${n.subject}</strong>
        <span class="notif-time">${n.time}</span>
      </div>
      <div>To: <span style="color:var(--gold)">${n.recipient}</span></div>
      <div style="color:var(--muted);margin-top:4px;white-space:pre-line">${n.body}</div>
    </div>`
  ).join('');
}

// ── Users ─────────────────────────────
function renderAdminUsers() {
  const users    = DB.get('users')    || [];
  const bookings = DB.get('bookings') || [];
  document.getElementById('admin-users-body').innerHTML = users.map(u => {
    const pts  = getUserPoints(u.id);
    const tier = getLoyaltyTier(pts);
    return `<tr>
      <td>${u.username}</td><td>${u.email}</td><td>${u.createdAt}</td>
      <td>${bookings.filter(b => b.userId === u.id).length}</td>
      <td class="text-gold">${pts}</td>
      <td><span class="loyalty-tier ${tier.class}">${tier.emoji} ${tier.name}</span></td>
      <td><span class="badge ${u.verified ? 'badge-green' : 'badge-gold'}">${u.verified ? 'Verified' : 'Pending'}</span></td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="text-muted" style="text-align:center;padding:40px">No users registered yet</td></tr>';
}