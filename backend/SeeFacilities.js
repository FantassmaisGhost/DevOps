// SeeFacilities.js
import { supabase } from './supabase.js';

export class AdminFacilitiesController {
  constructor(clinicID, clinicName, clinicType, clinicSector, clinicSubtype, clinicProvince) {
    this.clinicID = clinicID;
    this.clinicName = clinicName;
    this.type = clinicType;
    this.sector = clinicSector;
    this.subtype = clinicSubtype;
    this.province = clinicProvince;
  }

  showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.backgroundColor = type === 'success' ? '#00e5a0' : '#ff6b6b';
    toast.style.color = type === 'success' ? '#0b0e14' : 'white';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 5000);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async generateStaffId(clinicId) {
    const { data } = await supabase.from('Staff').select('id').eq('ClinicID', clinicId).order('id', { ascending: false }).limit(1);
    let nextNumber = 1;
    if (data && data.length > 0 && data[0].id) {
      const parts = data[0].id.split('-');
      if (parts.length === 3) nextNumber = parseInt(parts[2], 10) + 1;
    }
    const paddedClinic = String(clinicId).padStart(5, '0');
    const paddedNumber = String(nextNumber).padStart(3, '0');
    return `STF-${paddedClinic}-${paddedNumber}`;
  }

  async loadStaff() {
    const { data, error } = await supabase.from('Staff').select('*').eq('ClinicID', this.clinicID);
    if (error) return [];
    return data || [];
  }

  async removeStaff(id, name) {
    if (!confirm(`Remove ${name} from staff? They will lose staff access.`)) return false;
    const { error } = await supabase.from('Staff').delete().eq('id', id);
    if (error) {
      this.showToast('Failed to remove staff', 'error');
      return false;
    }
    this.showToast(`Removed ${name} from staff`, 'success');
    return true;
  }

  async renderStaffList() {
    const staff = await this.loadStaff();
    const container = document.getElementById('staff-list-container');
    if (!container) return;
    if (staff.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #5a6280; padding: 20px;">No staff members for this clinic.</p>';
      return;
    }
    container.innerHTML = staff.map(s => `
      <article style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #252b3d;">
        <header>
          <strong>${this.escapeHtml(s.full_name)}</strong><br>
          <small style="color: #5a6280;">${this.escapeHtml(s.email)} • ${this.escapeHtml(s.Occupation)}</small><br>
          <small style="color: #5a6280;">Staff ID: ${this.escapeHtml(s.id)}</small><br>
          <small style="color: #5a6280;">Phone: ${this.escapeHtml(s.contact || 'N/A')}</small>
        </header>
        <button class="remove-staff-btn" data-id="${s.id}" data-name="${this.escapeHtml(s.full_name)}" style="background:#ff6b6b;color:white;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;">Remove</button>
      </article>
    `).join('');
    document.querySelectorAll('.remove-staff-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const success = await this.removeStaff(id, name);
        if (success) this.renderStaffList();
      });
    });
  }

  async loadPendingStaff() {
    const { data, error } = await supabase.from('pending_staff').select('*').eq('clinicid', this.clinicID).eq('status', 'pending').order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  }

  async approveStaff(pending) {
    const newStaffId = await this.generateStaffId(pending.clinicid);
    const { error: insertError } = await supabase.from('Staff').insert([{
      id: newStaffId, email: pending.email, ClinicID: pending.clinicid,
      full_name: pending.full_name, Occupation: pending.occupation || 'Staff Member',
      contact: pending.phone_number || null
    }]);
    if (insertError) {
      this.showToast('Failed to approve staff: ' + insertError.message, 'error');
      return false;
    }
    await supabase.from('pending_staff').update({ status: 'approved' }).eq('email', pending.email);
    this.showToast(`✅ ${pending.full_name} approved as staff! Staff ID: ${newStaffId}`, 'success');
    return true;
  }

  async renderPendingStaff() {
    const pending = await this.loadPendingStaff();
    const container = document.getElementById('pending-staff-container');
    if (!container) return;
    if (pending.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #5a6280; padding: 20px;">No pending staff requests for this clinic.</p>';
      return;
    }
    container.innerHTML = pending.map(p => `
      <article style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #252b3d;">
        <header>
          <strong>${this.escapeHtml(p.full_name)}</strong><br>
          <small style="color: #5a6280;">${this.escapeHtml(p.email)}</small><br>
          <small style="color: #5a6280;">Occupation: ${this.escapeHtml(p.occupation || 'Not specified')}</small>
          ${p.phone_number ? `<br><small style="color: #5a6280;">Phone: ${this.escapeHtml(p.phone_number)}</small>` : ''}
        </header>
        <button class="approve-staff-btn" data-email="${p.email}" style="background: #00e5a0; color: #0b0e14; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer;">Approve</button>
      </article>
    `).join('');
    document.querySelectorAll('.approve-staff-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const email = btn.getAttribute('data-email');
        const pendingItem = pending.find(p => p.email === email);
        if (pendingItem && await this.approveStaff(pendingItem)) {
          this.renderPendingStaff();
          this.renderStaffList();
        }
      });
    });
  }

  renderClinicHeader() {
    const typeLabel = this.type === 'hospital' ? 'HOSPITAL' : 'CLINIC / CHC';
    const typeClass = this.type === 'hospital' ? 'chip-hosp' : 'chip-clinic';
    const sectClass = this.sector === 'public' ? 'chip-public' : 'chip-private';
    const headerHtml = `
      <div class="clinic-header">
        <a href="admin-dashboard.html" class="back-link">← Back to Admin Dashboard</a>
        <h1 class="clinic-name">${this.escapeHtml(this.clinicName)}</h1>
        <div class="clinic-meta"><strong>${this.escapeHtml(this.province)}</strong> ${this.subtype ? `<strong>· ${this.escapeHtml(this.subtype)}</strong>` : ''}</div>
        <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
          <strong class="chip ${typeClass}">${typeLabel}</strong>
          <strong class="chip ${sectClass}">${this.sector.toUpperCase()}</strong>
          <strong class="chip chip-prov">${this.escapeHtml(this.province).toUpperCase()}</strong>
          <strong class="chip chip-id">ID: ${this.escapeHtml(this.clinicID)}</strong>
        </div>
      </div>
    `;
    const container = document.getElementById('dynamic-content');
    container.innerHTML = headerHtml;
  }

  renderActionCards() {
    const actionsHtml = `
      <div class="panel">
        <div class="panel-header"><h3 class="panel-title">Management Actions</h3></div>
        <div class="action-card">
          <div class="action-info"><h4 class="action-title">Operating Hours</h4><p class="action-desc">Edit clinic opening and closing times</p></div>
          <a href="Changetime.html?clinicID=${encodeURIComponent(this.clinicID)}" class="btn-primary">Manage Hours →</a>
        </div>
      </div>
    `;
    const container = document.getElementById('dynamic-content');
    container.insertAdjacentHTML('beforeend', actionsHtml);
  }

  renderError(title, msg) {
    const container = document.getElementById('dynamic-content');
    container.innerHTML = `<div class="error-state"><h2>${this.escapeHtml(title)}</h2><p>${this.escapeHtml(msg)}</p><br><a href="admin-dashboard.html" class="btn-outline" style="margin-top:16px; display:inline-block;">← Back to Admin Dashboard</a></div>`;
  }

  async init() {
    if (!this.clinicID) {
      this.renderError('No facility selected.', 'Go back to the map and click a clinic or hospital.');
      return;
    }
    this.renderClinicHeader();
    this.renderActionCards();
    await this.renderStaffList();
    await this.renderPendingStaff();
  }
}

// Auto-execute with URL parameters
const params = new URLSearchParams(location.search);
const controller = new AdminFacilitiesController(
  params.get('clinicID'), params.get('name') || 'Health Facility', params.get('type') || 'clinic',
  params.get('sector') || 'public', params.get('subtype') || '', params.get('province') || ''
);
controller.init();