// Admin.js
import { supabase } from './supabase.js';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export class AdminHoursController {
  constructor(clinicID, clinicName, clinicType, clinicSector, clinicSubtype, clinicProvince) {
    this.clinicID = clinicID;
    this.clinicName = clinicName;
    this.type = clinicType;
    this.sector = clinicSector;
    this.subtype = clinicSubtype;
    this.province = clinicProvince;
    this.originalHours = [];
    this.currentHours = [];
    this.staffList = [];
    this.nextStaffId = 100;
  }

  showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async loadHours() {
    const { data, error } = await supabase.from('operating_hours').select('*').eq('clinicid', this.clinicID).order('operatingid', { ascending: true });
    if (error || !data || data.length === 0) {
      this.originalHours = DAY_NAMES.map((day, i) => ({
        operatingid: null, clinicid: this.clinicID, day,
        opentime: ['Saturday', 'Sunday'].includes(day) ? '09:00:00' : '08:00:00',
        closingtime: day === 'Saturday' ? '13:00:00' : day === 'Sunday' ? null : '17:00:00',
        isopen: day !== 'Sunday',
      }));
    } else {
      this.originalHours = DAY_NAMES.map(day => data.find(r => r.day === day) || {
        operatingid: null, clinicid: this.clinicID, day,
        opentime: '08:00:00', closingtime: '17:00:00', isopen: false
      });
    }
    this.currentHours = this.originalHours.map(r => ({ ...r }));
  }

  renderClinicHeader() {
    const typeLabel = this.type === 'hospital' ? 'HOSPITAL' : 'CLINIC / CHC';
    const typeClass = this.type === 'hospital' ? 'chip-hosp' : 'chip-clinic';
    const sectClass = this.sector === 'public' ? 'chip-public' : 'chip-private';
    const headerHtml = `
      <div class="clinic-header">
        <a href="index.html" class="back-link">← Back to map</a>
        <h1 class="clinic-name">${this.escapeHtml(this.clinicName)}</h1>
        <div class="clinic-meta"><span>${this.escapeHtml(this.province)}</span> ${this.subtype ? `<span>· ${this.escapeHtml(this.subtype)}</span>` : ''}</div>
        <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
          <span class="chip ${typeClass}">${typeLabel}</span>
          <span class="chip ${sectClass}">${this.sector.toUpperCase()}</span>
          <span class="chip chip-prov">${this.escapeHtml(this.province).toUpperCase()}</span>
          <span class="chip chip-id">ID: ${this.escapeHtml(this.clinicID)}</span>
        </div>
      </div>
    `;
    const app = document.getElementById('app');
    app.innerHTML = headerHtml + app.innerHTML;
  }

  generateTimeOptions(selected) {
    const times = [];
    for (let h = 6; h <= 20; h++) {
      for (let m = 0; m < 60; m += 30) {
        const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        const lbl = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const isSel = selected && selected.startsWith(lbl);
        times.push(`<option value="${val}"${isSel ? ' selected' : ''}>${lbl}</option>`);
      }
    }
    return times.join('');
  }

  isRowChanged(i) {
    const cur = this.currentHours[i];
    const orig = this.originalHours[i];
    return cur.opentime !== orig.opentime || cur.closingtime !== orig.closingtime || cur.isopen !== orig.isopen;
  }

  updateSaveBar() {
    const changedCount = this.currentHours.filter((_, i) => this.isRowChanged(i)).length;
    const badge = document.getElementById('change-badge');
    const saveBtn = document.getElementById('save-hours-btn');
    const discardBtn = document.getElementById('discard-btn');
    if (changedCount > 0) {
      if (badge) { badge.textContent = `${changedCount} unsaved change${changedCount > 1 ? 's' : ''}`; badge.style.display = 'inline-block'; }
      if (saveBtn) saveBtn.disabled = false;
      if (discardBtn) discardBtn.style.display = 'inline-block';
    } else {
      if (badge) badge.style.display = 'none';
      if (saveBtn) saveBtn.disabled = true;
      if (discardBtn) discardBtn.style.display = 'none';
    }
  }

  renderHours() {
    const hoursRows = this.currentHours.map((row, i) => {
      const orig = this.originalHours[i];
      const changed = this.isRowChanged(i);
      const rowClass = changed ? 'hours-row changed' : 'hours-row';
      const toggleClass = row.isopen ? 'toggle-open' : 'toggle-closed';
      const toggleText = row.isopen ? 'OPEN' : 'CLOSED';
      const openChanged = row.opentime !== orig.opentime;
      const closeChanged = row.closingtime !== orig.closingtime;
      let timeInputs = '';
      if (row.isopen) {
        timeInputs = `
          <select class="time-sel ${openChanged ? 'changed' : ''}" data-day-index="${i}" data-field="opentime">
            ${this.generateTimeOptions(row.opentime)}
          </select>
          <select class="time-sel ${closeChanged ? 'changed' : ''}" data-day-index="${i}" data-field="closingtime">
            ${this.generateTimeOptions(row.closingtime)}
          </select>
        `;
      } else {
        timeInputs = `<span class="closed-text">Closed</span>`;
      }
      return `<div class="${rowClass}"><span class="day-label">${row.day}</span>${timeInputs}<button class="toggle-btn ${toggleClass}" data-day-index="${i}">${toggleText}</button></div>`;
    }).join('');
    let hoursPanel = document.querySelector('.panel:first-child');
    if (!hoursPanel) {
      const app = document.getElementById('app');
      const hoursHtml = `<div class="panel"><div class="panel-header"><span class="panel-title">Operating Hours</span><span id="change-badge" class="change-badge" style="display: none;"></span></div><div class="panel-body" id="hours-container">${hoursRows}</div><div class="hours-footer"><div style="display:flex; gap:8px;"><button id="discard-btn" class="btn-ghost" style="display: none;">Discard</button></div><button id="save-hours-btn" class="btn-save" disabled>Save changes</button></div></div>`;
      app.insertAdjacentHTML('beforeend', hoursHtml);
    } else {
      const container = document.getElementById('hours-container');
      if (container) container.innerHTML = hoursRows;
    }
    this.updateSaveBar();
  }

  renderStaff() {
    const avatarColors = [{ bg: 'rgba(0,229,160,0.15)', color: '#00e5a0' }, { bg: 'rgba(96,180,255,0.15)', color: '#60b4ff' }, { bg: 'rgba(245,166,35,0.15)', color: '#f5a623' }, { bg: 'rgba(255,107,107,0.15)', color: '#ff6b6b' }];
    let staffHtml = '';
    if (this.staffList.length === 0) {
      staffHtml = '<div style="padding:16px; font-size:11px; color:var(--text-muted); text-align:center;">No staff members yet.</div>';
    } else {
      staffHtml = this.staffList.map((s, idx) => {
        const col = avatarColors[idx % avatarColors.length];
        const initials = s.name.split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
        return `<div class="staff-row"><div class="avatar" style="background:${col.bg}; color:${col.color};">${initials}</div><div class="staff-info"><div class="staff-name">${this.escapeHtml(s.name)}</div><div class="staff-role">${this.escapeHtml(s.role)}</div></div><button class="btn-danger" data-staff-id="${s.id}">Remove</button></div>`;
      }).join('');
    }
    let staffPanel = document.querySelector('.panel:last-child');
    if (!staffPanel || document.querySelectorAll('.panel').length === 1) {
      const staffHtmlFull = `<div class="panel"><div class="panel-header"><span class="panel-title">Staff Members</span></div><div id="staff-container">${staffHtml}</div><div class="add-row"><input type="text" id="staff-name" class="form-input" placeholder="Full name" /><input type="text" id="staff-role" class="form-input" placeholder="Role (e.g. Doctor)" /><button id="add-staff-btn" class="btn-save">+ Add</button></div></div>`;
      const app = document.getElementById('app');
      app.insertAdjacentHTML('beforeend', staffHtmlFull);
    } else {
      const container = document.getElementById('staff-container');
      if (container) container.innerHTML = staffHtml;
    }
  }

  addStaff() {
    const nameInput = document.getElementById('staff-name');
    const roleInput = document.getElementById('staff-role');
    const name = nameInput?.value.trim();
    const role = roleInput?.value.trim();
    if (!name || !role) {
      this.showToast('Enter both name and role', 'error');
      return;
    }
    this.staffList.push({ id: this.nextStaffId++, name, role });
    if (nameInput) nameInput.value = '';
    if (roleInput) roleInput.value = '';
    this.renderStaff();
    this.attachEventListeners();
    this.showToast('Staff member added', 'success');
  }

  removeStaff(id) {
    this.staffList = this.staffList.filter(s => s.id !== id);
    this.renderStaff();
    this.attachEventListeners();
    this.showToast('Staff member removed', 'success');
  }

  async saveHours() {
    const saveBtn = document.getElementById('save-hours-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    const changed = this.currentHours.filter((_, i) => this.isRowChanged(i));
    let errors = 0;
    for (const row of changed) {
      if (!row.operatingid) {
        const { error } = await supabase.from('operating_hours').insert([{
          clinicid: this.clinicID, day: row.day,
          opentime: row.isopen ? row.opentime : null,
          closingtime: row.isopen ? row.closingtime : null,
          isopen: row.isopen,
        }]);
        if (error) { console.error('Insert error:', error); errors++; }
        else { await this.loadHours(); }
      } else {
        const { error } = await supabase.from('operating_hours').update({
          opentime: row.isopen ? row.opentime : null,
          closingtime: row.isopen ? row.closingtime : null,
          isopen: row.isopen,
        }).eq('operatingid', row.operatingid);
        if (error) { console.error('Update error:', error); errors++; }
      }
    }
    if (errors === 0) {
      await this.loadHours();
      this.renderHours();
      this.attachEventListeners();
      this.showToast('Operating hours saved successfully', 'success');
    } else {
      this.showToast('Some changes failed to save', 'error');
    }
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save changes';
    this.updateSaveBar();
  }

  discardChanges() {
    this.currentHours = this.originalHours.map(r => ({ ...r }));
    this.renderHours();
    this.attachEventListeners();
    this.showToast('Changes discarded', 'success');
  }

  handleTimeChange(e) {
    const index = parseInt(e.target.getAttribute('data-day-index'));
    const field = e.target.getAttribute('data-field');
    if (!isNaN(index) && field) {
      this.currentHours[index][field] = e.target.value;
      this.renderHours();
      this.attachEventListeners();
    }
  }

  handleToggle(e) {
    const index = parseInt(e.target.getAttribute('data-day-index'));
    if (!isNaN(index)) {
      this.currentHours[index].isopen = !this.currentHours[index].isopen;
      this.renderHours();
      this.attachEventListeners();
    }
  }

  handleRemoveStaff(e) {
    const id = parseInt(e.target.getAttribute('data-staff-id'));
    this.removeStaff(id);
  }

  attachEventListeners() {
    document.querySelectorAll('.time-sel').forEach(sel => {
      sel.removeEventListener('change', this.boundHandleTimeChange);
      sel.addEventListener('change', this.boundHandleTimeChange);
    });
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.removeEventListener('click', this.boundHandleToggle);
      btn.addEventListener('click', this.boundHandleToggle);
    });
    const saveBtn = document.getElementById('save-hours-btn');
    if (saveBtn) {
      saveBtn.removeEventListener('click', this.boundSaveHours);
      saveBtn.addEventListener('click', this.boundSaveHours);
    }
    const discardBtn = document.getElementById('discard-btn');
    if (discardBtn) {
      discardBtn.removeEventListener('click', this.boundDiscardChanges);
      discardBtn.addEventListener('click', this.boundDiscardChanges);
    }
    const addStaffBtn = document.getElementById('add-staff-btn');
    if (addStaffBtn) {
      addStaffBtn.removeEventListener('click', this.boundAddStaff);
      addStaffBtn.addEventListener('click', this.boundAddStaff);
    }
    document.querySelectorAll('[data-staff-id]').forEach(btn => {
      btn.removeEventListener('click', this.boundHandleRemoveStaff);
      btn.addEventListener('click', this.boundHandleRemoveStaff);
    });
  }

  async init() {
    if (!this.clinicID) {
      this.renderError('No facility selected.', 'Go back to the map and click a clinic or hospital.');
      return;
    }
    await this.loadHours();
    this.renderClinicHeader();
    this.renderHours();
    this.renderStaff();
    this.boundHandleTimeChange = this.handleTimeChange.bind(this);
    this.boundHandleToggle = this.handleToggle.bind(this);
    this.boundSaveHours = this.saveHours.bind(this);
    this.boundDiscardChanges = this.discardChanges.bind(this);
    this.boundAddStaff = this.addStaff.bind(this);
    this.boundHandleRemoveStaff = this.handleRemoveStaff.bind(this);
    this.attachEventListeners();
  }

  renderError(title, msg) {
    const app = document.getElementById('app');
    app.innerHTML = `<div class="error-state"><h2>${this.escapeHtml(title)}</h2><p>${this.escapeHtml(msg)}</p><br><a href="index.html" class="btn-outline" style="margin-top:16px; display:inline-block;">← Back to Map</a></div>`;
  }
}

// Auto-instantiate
const params = new URLSearchParams(location.search);
const controller = new AdminHoursController(
  params.get('clinicID'), params.get('name') || 'Health Facility', params.get('type') || 'clinic',
  params.get('sector') || 'public', params.get('subtype') || '', params.get('province') || ''
);
controller.init();