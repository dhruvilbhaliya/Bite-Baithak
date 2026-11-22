// ══════════════════════════════════════
//  features.js — Unique New Features
//  1. Vibe Match Smart Recommender
//  2. Dining Passport (stats + achievements)
//  3. Live Table Timer
//  4. Surprise Me Booking
// ══════════════════════════════════════

// 1. VIBE MATCH RECOMMENDER
// ─────────────────────────────────────────
const vibeQuestions = [
  {
    q: "What's the occasion?",
    options: ['💑 Romantic Date', '👨‍👩‍👧 Family Dinner', '💼 Business Lunch', '🎉 Celebration', '😌 Solo Treat']
  },
  {
    q: "What's your budget vibe?",
    options: ['💸 Keep it light', '💰 Moderate spend', '💎 Splash out tonight']
  },
  {
    q: "What flavors are calling you?",
    options: ['🌿 Light & fresh', '🌶️ Bold & spicy', '🧀 Rich & indulgent', '🍣 Clean & precise', '🥐 Classic & refined']
  }
];

let vibeAnswers = [];
let vibeStep    = 0;

function openVibeMatcher() {
  vibeAnswers = [];
  vibeStep    = 0;
  renderVibeStep();
  openModal('vibe-modal');
}

function renderVibeStep() {
  const container = document.getElementById('vibe-content');
  if (vibeStep < vibeQuestions.length) {
    const q = vibeQuestions[vibeStep];
    container.innerHTML = `
      <div class="vibe-progress">
        ${vibeQuestions.map((_, i) => `<div class="vibe-dot ${i < vibeStep ? 'done' : i === vibeStep ? 'active' : ''}"></div>`).join('')}
      </div>
      <div class="vibe-question">${q.q}</div>
      <div class="vibe-options">
        ${q.options.map(o => `<button class="vibe-option" onclick="selectVibeOption('${encodeURIComponent(o)}')">${o}</button>`).join('')}
      </div>`;
  } else {
    showVibeResult();
  }
}

function selectVibeOption(opt) {
  vibeAnswers.push(decodeURIComponent(opt));
  vibeStep++;
  renderVibeStep();
}

function showVibeResult() {
  const restaurants = DB.get('restaurants') || [];

  // Scoring logic
  const scores = restaurants.map(r => {
    let score = 0;
    const occasion = vibeAnswers[0] || '';
    const budget   = vibeAnswers[1] || '';
    const flavor   = vibeAnswers[2] || '';

    // Occasion
    if (occasion.includes('Romantic') && (r.cuisine.includes('French') || r.cuisine.includes('Italian'))) score += 3;
    if (occasion.includes('Family')   && (r.cuisine.includes('Indian') || r.cuisine.includes('Italian'))) score += 3;
    if (occasion.includes('Business') && (r.cuisine.includes('French') || r.cuisine.includes('Japanese'))) score += 3;
    if (occasion.includes('Celebrat') ) score += r.rating >= 4.8 ? 3 : 1;
    if (occasion.includes('Solo')     ) score += r.priceLevel <= 2 ? 2 : 0;

    // Budget
    if (budget.includes('light')    && r.priceLevel <= 2) score += 3;
    if (budget.includes('Moderate') && r.priceLevel === 3) score += 3;
    if (budget.includes('Splash')   && r.priceLevel >= 4) score += 3;

    // Flavor
    if (flavor.includes('Light')    && r.cuisine.includes('Japanese')) score += 3;
    if (flavor.includes('Bold')     && r.cuisine.includes('Indian')) score += 3;
    if (flavor.includes('Rich')     && (r.cuisine.includes('French') || r.cuisine.includes('Italian'))) score += 3;
    if (flavor.includes('precise')  && r.cuisine.includes('Japanese')) score += 3;
    if (flavor.includes('refined')  && r.cuisine.includes('French')) score += 3;

    score += r.rating * 0.5;
    return { ...r, score };
  });

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const runner = scores[1];

  const freeTables = top.tables.filter(t => t.status === 'free').length;

  document.getElementById('vibe-content').innerHTML = `
    <div class="vibe-result">
      <div class="vibe-match-badge">✨ Your Perfect Match</div>
      <div class="vibe-match-emoji">${top.emoji}</div>
      <div class="vibe-match-name">${top.name}</div>
      <div class="vibe-match-cuisine">${top.cuisine}</div>
      <div class="vibe-match-meta">
        <span>⭐ ${top.rating}</span>
        <span>${top.priceRange}</span>
        <span style="color:${freeTables > 0 ? 'var(--green)' : '#E74C3C'}">🪑 ${freeTables} free</span>
      </div>
      <div class="vibe-match-desc">${top.desc}</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;flex-wrap:wrap">
        <button class="btn btn-gold" onclick="closeModal('vibe-modal');openRestaurant('${top.id}')">View Menu & Book</button>
        <button class="btn btn-outline btn-sm" onclick="openVibeMatcher()">Try Again</button>
      </div>
      ${runner ? `<div class="vibe-runner-up">Runner up: ${runner.emoji} <strong>${runner.name}</strong>
        <button class="btn btn-outline btn-sm" onclick="closeModal('vibe-modal');openRestaurant('${runner.id}')">View</button>
      </div>` : ''}
    </div>`;
}

// ─────────────────────────────────────────
// 2. DINING PASSPORT
// ─────────────────────────────────────────
const achievements = [
  { id:'first_booking',   emoji:'🍽️',  name:'First Reservation',   desc:'Made your very first booking',         check: (b) => b.length >= 1 },
  { id:'foodie',          emoji:'🧑‍🍳', name:'Foodie',               desc:'Booked at 3 different restaurants',    check: (b) => new Set(b.map(x=>x.restaurantId)).size >= 3 },
  { id:'globetrotter',    emoji:'🌏',  name:'Globe Trotter',        desc:'Tried all 4 cuisines',                 check: (b) => new Set(b.map(x=>x.restaurantId)).size >= 4 },
  { id:'high_roller',     emoji:'💎',  name:'High Roller',          desc:'Single booking over ₹3000',            check: (b) => b.some(x=>x.total>=3000) },
  { id:'party_planner',   emoji:'🎉',  name:'Party Planner',        desc:'Booked for 6+ guests',                 check: (b) => b.some(x=>x.guests>=6) },
  { id:'loyal_diner',     emoji:'🏆',  name:'Loyal Diner',          desc:'Reached 200 loyalty points',           check: (b,pts) => pts>=200 },
  { id:'platinum_elite',  emoji:'💍',  name:'Platinum Elite',       desc:'Reached 1000 loyalty points',          check: (b,pts) => pts>=1000 },
  { id:'reviewer',        emoji:'📝',  name:'Critic',               desc:'Left your first review',               check: (b) => b.some(x=>x.reviewed) },
  { id:'comeback',        emoji:'🔄',  name:'Regular',              desc:'Rebooked the same restaurant twice',   check: (b) => { const c={}; b.forEach(x=>{c[x.restaurantId]=(c[x.restaurantId]||0)+1;}); return Object.values(c).some(v=>v>=2); } },
  { id:'big_spender',     emoji:'💸',  name:'Big Spender',          desc:'Spent ₹5000+ total',                   check: (b) => b.filter(x=>x.status==='confirmed').reduce((s,x)=>s+x.total,0)>=5000 },
];

function openDiningPassport() {
  if (!currentUser) { toast('Please login to view your Dining Passport', 'error'); openModal('auth-modal'); return; }
  renderDiningPassport();
  openModal('passport-modal');
}

function renderDiningPassport() {
  const bookings = (DB.get('bookings') || []).filter(b => b.userId === currentUser.id);
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const pts = getUserPoints(currentUser.id);
  const tier = getLoyaltyTier(pts);

  const totalSpend  = confirmed.reduce((s,b)=>s+b.total,0);
  const restaurants = DB.get('restaurants') || [];
  const visited     = [...new Set(confirmed.map(b => b.restaurantId))];
  const reviews     = (DB.get('reviews') || []).filter(r => r.userId === currentUser.id);
  const avgRating   = reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : '—';
  const favRest     = (() => {
    const c={};confirmed.forEach(b=>{c[b.restaurantId]=(c[b.restaurantId]||0)+1;});
    const topId=Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0];
    return restaurants.find(r=>r.id===topId);
  })();

  // Stamps
  const stamps = visited.map(id => {
    const r = restaurants.find(x=>x.id===id);
    const count = confirmed.filter(b=>b.restaurantId===id).length;
    return r ? `<div class="passport-stamp ${count>=3?'stamp-gold':''}" title="${r.name} × ${count}">
      <div class="stamp-emoji">${r.emoji}</div>
      <div class="stamp-name">${r.name.split(' ')[0]}</div>
      <div class="stamp-count">×${count}</div>
    </div>` : '';
  }).join('');

  const emptyStamps = Array(Math.max(0, 4 - visited.length)).fill(
    `<div class="passport-stamp empty"><div class="stamp-emoji">?</div><div class="stamp-name">Unvisited</div></div>`
  ).join('');

  // Achievement badges
  const badgeHTML = achievements.map(a => {
    const earned = a.check(confirmed, pts);
    return `<div class="achievement-badge ${earned ? 'earned' : 'locked'}" title="${a.desc}">
      <div class="achievement-emoji">${earned ? a.emoji : '🔒'}</div>
      <div class="achievement-name">${a.name}</div>
      ${earned ? '' : `<div class="achievement-hint">${a.desc}</div>`}
    </div>`;
  }).join('');

  // Timeline
  const timelineHTML = [...confirmed].reverse().slice(0, 8).map(b => {
    const r = restaurants.find(x=>x.id===b.restaurantId);
    return `<div class="passport-timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-body">
        <div class="timeline-title">${r?.emoji||'🍽️'} ${b.restaurantName}</div>
        <div class="timeline-meta">${b.date} · Table ${b.tableNum} · ${b.guests} guests · <span class="text-gold">₹${b.total.toLocaleString('en-IN')}</span></div>
      </div>
    </div>`;
  }).join('') || '<div class="text-muted">No dining history yet. Start your journey!</div>';

  document.getElementById('passport-content').innerHTML = `
    <div class="passport-header-strip">
      <div class="passport-user-info">
        <div class="passport-avatar">${currentUser.username[0].toUpperCase()}</div>
        <div>
          <div class="passport-username">${currentUser.username}</div>
          <div class="passport-tier">${tier.emoji} ${tier.name} Member</div>
        </div>
      </div>
      <div class="passport-stats-row">
        <div class="passport-stat"><div class="passport-stat-val">${confirmed.length}</div><div class="passport-stat-label">Bookings</div></div>
        <div class="passport-stat"><div class="passport-stat-val">${visited.length}</div><div class="passport-stat-label">Restaurants</div></div>
        <div class="passport-stat"><div class="passport-stat-val">₹${(totalSpend/1000).toFixed(1)}K</div><div class="passport-stat-label">Total Spent</div></div>
        <div class="passport-stat"><div class="passport-stat-val">${avgRating}⭐</div><div class="passport-stat-label">Avg Rating Given</div></div>
      </div>
    </div>

    <div class="passport-section-title">🗺️ Restaurant Stamps</div>
    <div class="passport-stamps">
      ${stamps || '<div class="text-muted" style="grid-column:1/-1">No visits yet — go explore!</div>'}
      ${emptyStamps}
    </div>

    ${favRest ? `<div class="passport-fav">
      ❤️ Favourite: <strong>${favRest.emoji} ${favRest.name}</strong>
    </div>` : ''}

    <div class="passport-section-title">🏅 Achievements</div>
    <div class="achievements-grid">${badgeHTML}</div>

    <div class="passport-section-title">📅 Dining Timeline</div>
    <div class="passport-timeline">${timelineHTML}</div>
  `;
}

// ─────────────────────────────────────────
// 3. LIVE TABLE TIMER (estimated wait)
// ─────────────────────────────────────────
function getEstimatedWait(tableId) {
  // Simulate based on table id hash → 15–75 min
  const hash = tableId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return 15 + (hash % 61); // 15–75 mins
}

// Patched into renderBookingTables — adds wait estimate to occupied tables
function renderBookingTablesWithTimer() {
  if (!currentRestaurant) return;
  const restaurants = DB.get('restaurants') || [];
  const rest = restaurants.find(r => r.id === currentRestaurant.id);
  const waitlist = DB.get('waitlist') || [];

  document.getElementById('booking-tables-grid').innerHTML = rest.tables.map(t => {
    const wlCount  = waitlist.filter(w => w.tableId === t.id && w.status === 'waiting').length;
    const waitMins = t.status === 'occupied' ? getEstimatedWait(t.id) : null;
    return `
      <div class="table-slot ${t.status} ${selectedTable === t.id ? 'selected' : ''}" onclick="selectTable('${t.id}')">
        <div class="table-icon">🪑</div>
        <div class="table-num">Table ${t.number}</div>
        <div class="table-seats">${t.seats} seats</div>
        <div class="table-status">${t.status}</div>
        ${t.status === 'occupied' ? `
          <div class="table-wait-badge">~${waitMins}m wait</div>
          <button class="table-waitlist-btn" onclick="event.stopPropagation();openWaitlistModal('${t.id}','${rest.id}',${t.number})">
            + Waitlist${wlCount > 0 ? ` (${wlCount})` : ''}
          </button>` : ''}
        ${t.status === 'maintenance' ? `<div class="table-wait-badge maintenance-badge">🔧</div>` : ''}
      </div>`;
  }).join('');
}

// Override original
function renderBookingTables() { renderBookingTablesWithTimer(); }

// ─────────────────────────────────────────
// 4. SURPRISE ME
// ─────────────────────────────────────────
function surpriseMe() {
  if (!currentUser) {
    toast('Please login for the Surprise Me experience!', 'error');
    openModal('auth-modal');
    return;
  }

  const restaurants = DB.get('restaurants') || [];
  const free = restaurants.filter(r => r.tables.some(t => t.status === 'free'));
  if (free.length === 0) { toast('No restaurants have free tables right now!', 'error'); return; }

  const pick = free[Math.floor(Math.random() * free.length)];
  const menus = DB.get('menus') || [];
  const items = menus.filter(m => m.restId === pick.id);

  // Pick 1–2 random dishes
  const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, 2);

  const overlay = document.createElement('div');
  overlay.id = 'surprise-overlay';
  overlay.innerHTML = `
    <div class="surprise-card">
      <div class="surprise-reveal-text">✨ Tonight's Surprise...</div>
      <div class="surprise-emoji">${pick.emoji}</div>
      <div class="surprise-name">${pick.name}</div>
      <div class="surprise-cuisine">${pick.cuisine}</div>
      <div class="surprise-dishes">
        We've pre-selected for you:<br>
        ${shuffled.map(s=>`<span class="surprise-dish">${s.emoji} ${s.name}</span>`).join(' · ')}
      </div>
      <div class="surprise-actions">
        <button class="btn btn-gold" onclick="acceptSurprise('${pick.id}', '${encodeURIComponent(JSON.stringify(shuffled.map(s=>s.id)))}')">Accept & Book →</button>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('surprise-overlay').remove();surpriseMe()">🎲 Re-roll</button>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('surprise-overlay').remove()">No thanks</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('visible'), 10);
}

function acceptSurprise(restId, itemIds) {
  document.getElementById('surprise-overlay').remove();
  const parsedIds = typeof itemIds === 'string' ? JSON.parse(decodeURIComponent(itemIds)) : itemIds;
  const restaurants = DB.get('restaurants') || [];
  const menus = DB.get('menus') || [];
  currentRestaurant = restaurants.find(r => r.id === restId);
  cart = parsedIds.map(id => menus.find(m => m.id === id)).filter(Boolean);

  document.getElementById('rest-modal-name').textContent    = currentRestaurant.name;
  document.getElementById('rest-modal-cuisine').textContent = currentRestaurant.cuisine;
  renderRestaurantMenu();
  updateCartUI();
  openModal('restaurant-modal');
  toast('🎲 Surprise selection loaded! Feel free to adjust your order.', 'info');
}
