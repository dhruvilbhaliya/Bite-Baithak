// ══════════════════════════════════════
//  waitlist.js — Waitlist Join / Leave / Notify
// ══════════════════════════════════════

function openWaitlistModal(tableId, restId, tableNum) {
  if (!currentUser) {
    toast('Please login to join the waitlist', 'error');
    return;
  }

  document.getElementById('wl-table-id').value = tableId;
  document.getElementById('wl-rest-id').value  = restId;

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('wl-date').value = today;
  document.getElementById('wl-date').min   = today;

  const waitlist = DB.get('waitlist') || [];
  const pos = waitlist.filter(w => w.tableId === tableId && w.status === 'waiting').length;

  document.getElementById('wl-info').innerHTML =
    `🪑 Table ${tableNum} is currently occupied. Join the waitlist and we'll notify you when it's free!
     <br><span style="color:var(--gold)">${pos} people ahead of you</span>`;

  closeModal('booking-modal');
  openModal('waitlist-modal');
}

function joinWaitlist() {
  const tableId = document.getElementById('wl-table-id').value;
  const restId  = document.getElementById('wl-rest-id').value;
  const date    = document.getElementById('wl-date').value;
  const time    = document.getElementById('wl-time').value;
  const guests  = document.getElementById('wl-guests').value;

  const waitlist = DB.get('waitlist') || [];
  const already  = waitlist.find(w => w.tableId === tableId && w.userId === currentUser.id && w.status === 'waiting');
  if (already) return toast('Already on waitlist for this table', 'error');

  const restaurants = DB.get('restaurants') || [];
  const rest = restaurants.find(r => r.id === restId);
  const pos  = waitlist.filter(w => w.tableId === tableId && w.status === 'waiting').length + 1;

  const entry = {
    id:             generateId(),
    tableId,        restId,
    restaurantName: rest?.name || restId,
    userId:         currentUser.id,
    userName:       currentUser.username,
    userEmail:      currentUser.email,
    date, time, guests,
    status:         'waiting',
    position:       pos,
    createdAt:      new Date().toLocaleString(),
  };
  DB.push('waitlist', entry);

  logNotification('Waitlist', currentUser.email,
    `Waitlist Confirmed – ${rest?.name}`,
    `You are #${pos} in the waitlist for ${rest?.name}. We'll notify you when the table is free.`);

  toast(`Added to waitlist at position #${pos}!`, 'success');
  closeModal('waitlist-modal');

  // Re-render if profile is visible
  if (document.getElementById('page-profile').classList.contains('active')) {
    renderWaitlistList();
  }
}

function leaveWaitlist(id) {
  const waitlist = DB.get('waitlist') || [];
  const idx = waitlist.findIndex(w => w.id === id);
  if (idx >= 0) {
    waitlist[idx].status = 'left';
    DB.set('waitlist', waitlist);
  }
  toast('Left waitlist', 'info');
  renderWaitlistList();
}

// Called from profile page
function renderWaitlistList() {
  const waitlist = (DB.get('waitlist') || []).filter(w => w.userId === currentUser.id);
  const el = document.getElementById('my-waitlists-list');

  if (waitlist.length === 0) {
    el.innerHTML = `<div class="text-muted">You're not on any waitlists.</div>`;
    return;
  }
  el.innerHTML = waitlist.map(w => `
    <div class="waitlist-card">
      <div class="waitlist-info">
        <span class="waitlist-pos">#${w.position}</span>
        <strong>${w.restaurantName}</strong> · ${w.date} at ${w.time} · ${w.guests} guests
        <div style="font-size:0.72rem;color:var(--muted);margin-top:4px">Added: ${w.createdAt}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="badge ${w.status === 'waiting' ? 'badge-gold' : 'badge-green'}">${w.status}</span>
        ${w.status === 'waiting'
          ? `<button class="btn btn-danger btn-sm" onclick="leaveWaitlist('${w.id}')">Leave</button>`
          : ''}
      </div>
    </div>`
  ).join('');
}