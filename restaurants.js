// ══════════════════════════════════════
//  restaurants.js — Listing, Search, Menu
// ══════════════════════════════════════

// ── Search / Filter / Sort ───────────
function setFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterRestaurants();
}

function filterRestaurants() {
  const q    = document.getElementById('search-input').value.toLowerCase();
  const sort = document.getElementById('sort-select').value;
  let restaurants = DB.get('restaurants') || [];

  // Filter by search query & cuisine tag
  restaurants = restaurants.filter(r => {
    const matchQ = !q || r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q);
    const matchF = activeFilter === 'all' || r.cuisine.includes(activeFilter);
    return matchQ && matchF;
  });

  // Sort
  if (sort === 'rating')     restaurants.sort((a, b) => b.rating - a.rating);
  if (sort === 'price-asc')  restaurants.sort((a, b) => a.priceLevel - b.priceLevel);
  if (sort === 'price-desc') restaurants.sort((a, b) => b.priceLevel - a.priceLevel);
  if (sort === 'tables')     restaurants.sort((a, b) =>
    b.tables.filter(t => t.status === 'free').length - a.tables.filter(t => t.status === 'free').length
  );

  // Show / hide cards by id
  const visibleIds = new Set(restaurants.map(r => r.id));
  document.querySelectorAll('.restaurant-card').forEach(card => {
    card.classList.toggle('hidden', !visibleIds.has(card.dataset.id));
  });
  document.getElementById('no-results').style.display = restaurants.length === 0 ? 'block' : 'none';
}

// ── Render Grid ──────────────────────
function renderRestaurants() {
  const restaurants = DB.get('restaurants') || [];
  const grid        = document.getElementById('restaurants-grid');

  grid.innerHTML = restaurants.map(r => {
    const freeTables = r.tables.filter(t => t.status === 'free').length;
    const isPopular  = r.rating >= 4.8;
    return `
      <div class="restaurant-card" data-id="${r.id}">
        <div class="r-img">
          ${isPopular ? `<div class="r-badge">⭐ Popular</div>` : ''}
          <span style="z-index:1;position:relative;font-size:5rem">${r.emoji}</span>
        </div>
        <div class="r-info">
          <div class="r-name">${r.name}</div>
          <div class="r-cuisine">${r.cuisine}</div>
          <div class="r-desc">${r.desc}</div>
          <div class="r-meta">
            <span>⭐ ${r.rating}</span>
            <span>${r.priceRange}</span>
            <span style="color:${freeTables > 0 ? 'var(--green)' : '#E74C3C'}">🪑 ${freeTables} free</span>
          </div>
        </div>
        <div class="r-actions">
          <button class="btn btn-gold btn-sm"    onclick="openRestaurant('${r.id}')">View Menu &amp; Book</button>
          <button class="btn btn-outline btn-sm" onclick="openRestaurant('${r.id}')">Explore</button>
        </div>
      </div>`;
  }).join('');
}

// ── Open Restaurant Modal ────────────
function openRestaurant(id) {
  const restaurants = DB.get('restaurants') || [];
  currentRestaurant = restaurants.find(r => r.id === id);
  if (!currentRestaurant) return;

  cart = [];
  document.getElementById('rest-modal-name').textContent    = currentRestaurant.name;
  document.getElementById('rest-modal-cuisine').textContent = currentRestaurant.cuisine;
  renderRestaurantMenu();
  updateCartUI();
  openModal('restaurant-modal');
}

// ── Menu Tabs + Items ────────────────
function renderRestaurantMenu(activeCategory = null) {
  const menus  = DB.get('menus') || [];
  const items  = menus.filter(m => m.restId === currentRestaurant.id);
  const cats   = [...new Set(items.map(m => m.category))];
  if (!activeCategory) activeCategory = cats[0];

  document.getElementById('rest-menu-tabs').innerHTML = cats.map(c =>
    `<div class="menu-tab ${c === activeCategory ? 'active' : ''}" onclick="renderRestaurantMenu('${c}')">${c}</div>`
  ).join('');

  const cartIds = cart.map(c => c.id);
  document.getElementById('rest-menu-items').innerHTML = items
    .filter(m => m.category === activeCategory)
    .map(item => `
      <div class="menu-item">
        <div class="menu-emoji">${item.emoji}</div>
        <div style="flex:1">
          <div class="menu-name">${item.name}</div>
          <div class="menu-desc">${item.desc}</div>
          <div class="menu-footer">
            <div class="menu-price">₹${item.price}</div>
            <button class="menu-add ${cartIds.includes(item.id) ? 'added' : ''}" onclick="toggleCart('${item.id}')">
              ${cartIds.includes(item.id) ? '✓ Added' : '+ Add'}
            </button>
          </div>
        </div>
      </div>`)
    .join('');
}

// ── Cart Toggle ──────────────────────
function toggleCart(itemId) {
  const menus = DB.get('menus') || [];
  const item  = menus.find(m => m.id === itemId);
  if (!item) return;

  const idx = cart.findIndex(c => c.id === itemId);
  if (idx >= 0) cart.splice(idx, 1);
  else          cart.push(item);

  const activeTab = document.querySelector('#rest-menu-tabs .menu-tab.active');
  renderRestaurantMenu(activeTab?.textContent);
  updateCartUI();
}