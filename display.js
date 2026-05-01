/* ============================================================
   Clinic Queue Management System — Display Board (display.js)
   ============================================================ */

let lastServingSnapshot = {};

document.addEventListener('DOMContentLoaded', () => {
  QueueStore.subscribe(renderDisplay);
  renderDisplay(QueueStore.getState());

  updateDisplayClock();
  setInterval(updateDisplayClock, 1000);

  // Poll for cross-tab updates (in case storage events don't fire in same tab)
  setInterval(() => renderDisplay(QueueStore.getState()), 2000);
});

/* ---- Main render ---- */
function renderDisplay(state) {
  renderServing(state);
  renderWaiting(state);
  checkFlash(state);
}

function renderServing(s) {
  const grid = document.getElementById('serving-grid');

  grid.innerHTML = s.doctors.map(d => {
    const busy = !!d.currentPatient;
    const deptKey = busy ? d.currentPatient.dept.toLowerCase() : d.dept.toLowerCase();

    return `
    <div class="serving-card ${busy ? 'active' : ''}">
      <span class="sc-dot ${busy ? 'active' : 'idle'}"></span>
      <div class="sc-room">${d.room} · ${d.name}</div>
      ${busy ? `
        <div class="sc-num mono">#${String(d.currentPatient.num).padStart(3,'0')}</div>
        <div class="sc-name">${escHtml(d.currentPatient.name)}</div>
        <div class="sc-doctor">${QueueStore.DEPT_LABELS[d.currentPatient.dept]}</div>
        <span class="sc-badge ${deptKey}">${QueueStore.DEPT_LABELS[d.currentPatient.dept]}</span>
      ` : `
        <div class="sc-num empty mono">—</div>
        <div class="sc-name empty">Available</div>
        <div class="sc-doctor">${QueueStore.DEPT_LABELS[d.dept]}</div>
      `}
    </div>`;
  }).join('');
}

function renderWaiting(s) {
  const grid = document.getElementById('waiting-grid');

  if (!s.queue.length) {
    grid.innerHTML = '<div class="waiting-empty">No patients waiting</div>';
    return;
  }

  grid.innerHTML = s.queue.map(p => `
    <div class="waiting-row">
      <span class="wr-num mono">${String(p.num).padStart(3,'0')}</span>
      <span class="wr-name">${escHtml(p.name)}</span>
      <span class="wr-priority ${p.priority}">${p.priority}</span>
    </div>
  `).join('');
}

/* ---- Flash when a new patient is called ---- */
function checkFlash(s) {
  s.doctors.forEach(d => {
    const prev = lastServingSnapshot[d.id];
    const cur  = d.currentPatient;

    if (cur && (!prev || prev.id !== cur.id)) {
      // New patient just called for this doctor
      showFlash(cur.num, cur.name, d.room, d.name);
    }

    lastServingSnapshot[d.id] = cur ? { id: cur.id } : null;
  });
}

function showFlash(num, name, room, doctor) {
  document.getElementById('flash-num').textContent  = '#' + String(num).padStart(3,'0');
  document.getElementById('flash-name').textContent = name;
  document.getElementById('flash-room').textContent = `Please proceed to ${room} · ${doctor}`;

  const overlay = document.getElementById('flash-overlay');
  overlay.classList.add('show');
  setTimeout(() => overlay.classList.remove('show'), 4500);
}

/* ---- Clock ---- */
function updateDisplayClock() {
  const now = new Date();
  const timeEl = document.getElementById('display-time');
  const dateEl = document.getElementById('display-date');
  if (timeEl) timeEl.textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  if (dateEl) dateEl.textContent = now.toLocaleDateString([], {weekday:'long', year:'numeric', month:'long', day:'numeric'});
}

/* ---- Marquee duplication for seamless loop ---- */
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('marquee-text');
  if (el) {
    const original = el.textContent;
    el.textContent = original + original + original;
  }
});

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
