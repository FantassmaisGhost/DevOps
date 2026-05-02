/* ============================================================
   CareQueue — Admin Panel (admin.js)
   ============================================================ */

let selectedPatientId = null;

document.addEventListener('DOMContentLoaded', () => {
    QueueStore.subscribe(render);
    render(QueueStore.getState());
    QueueStore.loadQueueFromSupabase();

//   const s = QueueStore.getState();
//   if (s.totalToday === 0) seedDemo();

  setInterval(updateElapsed, 1000);
  updateClock();
  setInterval(updateClock, 1000);

  document.getElementById('btn-add-patient').addEventListener('click', handleAddPatient);
  document.getElementById('inp-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddPatient();
  });
  document.getElementById('btn-add-doctor').addEventListener('click', handleAddDoctor);
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset all data for today?')) QueueStore.resetDay();
  });
  document.getElementById('btn-display').addEventListener('click', () => {
    window.open('display.html', '_blank');
  });
});

function seedDemo() {
  QueueStore.addPatient('Thandiwe Mokoena',   'Emergency', 'urgent');
  QueueStore.addPatient('Sipho Dlamini',      'GP',        'high');
  QueueStore.addPatient('Ayesha Patel',       'Lab',       'normal');
  QueueStore.addPatient('James van der Berg', 'Specialist','normal');
  QueueStore.addPatient('Nomsa Zulu',         'GP',        'normal');
}

async function handleAddPatient() {
  const name = document.getElementById("inp-name").value.trim();
  const dept = document.getElementById("inp-dept").value;
  const priority = document.getElementById("inp-priority").value;

  if (!name) {
    document.getElementById("inp-name").focus();
    return;
  }

  const result = await QueueStore.addPatient(name, dept, priority);

  if (!result) return;

  document.getElementById("inp-name").value = "";
  document.getElementById("inp-name").focus();
}

function handleAddDoctor() {
  const name = document.getElementById('doc-name').value.trim();
  const dept = document.getElementById('doc-dept').value;
  const room = document.getElementById('doc-room').value.trim() || 'Room ?';
  if (!name) { document.getElementById('doc-name').focus(); return; }
  QueueStore.addDoctor(name, dept, room);
  document.getElementById('doc-name').value = '';
  document.getElementById('doc-room').value = '';
}

/* ---- Render ---- */
function render(state) {
  state = state || QueueStore.getState();
  renderQueue(state);
  renderDoctors(state);
  renderStats(state);
  renderCompleted(state);
}

function renderQueue(s) {
  const list  = document.getElementById('queue-list');
  const count = document.getElementById('queue-count');
  count.textContent = s.queue.length;

  if (!s.queue.length) {
    list.innerHTML = '<div class="empty-msg">Queue is empty</div>';
    return;
  }

  list.innerHTML = s.queue.map(p => `
    <div class="queue-item ${p.id === selectedPatientId ? 'selected' : ''} fade-in"
         onclick="selectPatient('${p.id}')">
      <div class="q-num-badge ${p.priority === 'urgent' ? 'urgent' : ''}">${String(p.num).padStart(3,'0')}</div>
      <div class="q-info">
        <div class="q-name">${escHtml(p.name)}</div>
        <div class="q-meta">
          <span class="badge badge-${p.dept.toLowerCase()}">${QueueStore.DEPT_LABELS[p.dept]}</span>
          <span class="priority-pill priority-${p.priority}">${p.priority}</span>
        </div>
        <div class="q-wait">${formatWait(p.addedAt)}</div>
      </div>
      <div class="q-right" onclick="event.stopPropagation()">
        <select class="assign-select" onchange="assignPatient('${p.id}', this.value)">
          <option value="">Assign…</option>
          ${s.doctors.filter(d => d.available).map(d =>
            `<option value="${d.id}">${d.name.split(' ').pop()} · ${d.room}</option>`
          ).join('')}
        </select>
        <button class="btn-icon danger" onclick="QueueStore.removeFromQueue('${p.id}')" title="Remove">✕</button>
      </div>
    </div>
  `).join('');
}

function renderDoctors(s) {
  const grid = document.getElementById('doctor-grid');
  grid.innerHTML = s.doctors.map(d => {
    const busy = !!d.currentPatient;
    const initials = d.name.replace('Dr.', '').trim().split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const statusLabel = busy ? 'With Patient' : (d.available ? 'Available' : 'Offline');
    const statusCls   = busy ? 'status-busy' : (d.available ? 'status-avail' : 'status-off');
    const cardCls     = busy ? 'doctor-card busy' : (d.available ? 'doctor-card' : 'doctor-card offline');

    return `
    <div class="${cardCls}">
      <div class="doctor-top">
        <div class="doctor-avatar ${busy ? 'busy-av' : ''}">${initials}</div>
        <div class="doctor-meta">
          <div class="doctor-name">${escHtml(d.name)}</div>
          <div class="doctor-room-line">
            ${d.room}
            <span class="badge badge-${d.dept.toLowerCase()}">${d.dept}</span>
          </div>
        </div>
        <div class="doctor-status-row">
          <span class="status-dot ${statusCls} ${busy ? 'blink' : ''}"></span>
          <span class="status-label">${statusLabel}</span>
        </div>
      </div>

      ${busy ? `
        <div class="patient-slot">
          <div class="slot-ticket">#${String(d.currentPatient.num).padStart(3,'0')}</div>
          <div class="slot-info">
            <div class="slot-name">${escHtml(d.currentPatient.name)}</div>
            <div class="slot-dept"><span class="badge badge-${d.currentPatient.dept.toLowerCase()}">${QueueStore.DEPT_LABELS[d.currentPatient.dept]}</span></div>
          </div>
          <div class="slot-elapsed" id="elapsed-${d.id}">0m 0s</div>
        </div>
        <div class="doctor-actions">
          <button class="btn btn-success" onclick="QueueStore.completeDoctor('${d.id}')">✓ Done</button>
          <button class="btn btn-danger"  onclick="QueueStore.skipDoctor('${d.id}')">Skip</button>
          <button class="btn btn-blue"    onclick="QueueStore.callNextForDoctor('${d.id}')">Next →</button>
        </div>
      ` : `
        <div class="doctor-empty">No patient assigned</div>
        <div class="doctor-actions">
          <button class="btn btn-primary" onclick="QueueStore.callNextForDoctor('${d.id}')">Call next</button>
          <button class="btn btn-neutral" onclick="QueueStore.toggleDoctorAvailability('${d.id}')">
            ${d.available ? 'Set offline' : 'Set available'}
          </button>
          <button class="btn btn-danger" style="margin-left:auto" onclick="removeDoc('${d.id}')">Remove</button>
        </div>
      `}
    </div>`;
  }).join('');
}

function renderStats(s) {
  const avg = s.waitTimes.length
    ? Math.round(s.waitTimes.reduce((a,b) => a+b, 0) / s.waitTimes.length)
    : null;
  document.getElementById('s-total').textContent   = s.totalToday;
  document.getElementById('s-done').textContent    = s.completed.length;
  document.getElementById('s-waiting').textContent = s.queue.length;
  document.getElementById('s-avg').textContent     = avg !== null ? avg + 'm' : '—';
  document.getElementById('s-doctors').textContent = s.doctors.filter(d => d.available || d.currentPatient).length;
}

function renderCompleted(s) {
  const el = document.getElementById('completed-list');
  if (!s.completed.length) {
    el.innerHTML = '<div class="empty-msg">No completed visits yet</div>';
    return;
  }
  el.innerHTML = s.completed.slice(0, 14).map(p => `
    <div class="completed-item">
      <div class="ci-tick">✓</div>
      <div class="ci-info">
        <div class="ci-name">${escHtml(p.name)}</div>
        <div class="ci-meta">${p.doctorName}</div>
      </div>
      <div class="ci-right">
        <span class="ci-dur">${p.duration}m</span>
        <span class="ci-time">${p.completedAt}</span>
      </div>
    </div>
  `).join('');
}

/* ---- Helpers ---- */
function selectPatient(id) {
  selectedPatientId = selectedPatientId === id ? null : id;
  render();
}

function assignPatient(patientId, doctorId) {
  if (!doctorId) return;
  QueueStore.assignToDoctor(doctorId, patientId);
}

function removeDoc(doctorId) {
  if (confirm('Remove this doctor?')) QueueStore.removeDoctor(doctorId);
}

function updateElapsed() {
  const s = QueueStore.getState();
  s.doctors.forEach(d => {
    if (d.currentPatient && d.currentPatient.serveStart) {
      const el = document.getElementById('elapsed-' + d.id);
      if (!el) return;
      const secs = Math.floor((Date.now() - d.currentPatient.serveStart) / 1000);
      el.textContent = `${Math.floor(secs/60)}m ${secs%60}s`;
    }
  });
  document.querySelectorAll('.q-wait').forEach((el, i) => {
    const p = s.queue[i];
    if (p) el.textContent = formatWait(p.addedAt);
  });
}

function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}

function formatWait(addedAt) {
  const secs = Math.floor((Date.now() - addedAt) / 1000);
  if (secs < 60) return secs + 's ago';
  const m = Math.floor(secs / 60);
  if (m < 60) return m + 'm ago';
  return Math.floor(m/60) + 'h ' + (m%60) + 'm ago';
}

function escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}