class AdminFacilitiesController {
  constructor(clinicID, clinicName, clinicType, clinicSector, clinicSubtype, clinicProvince) {
    this.clinicID = clinicID;
    this.clinicName = clinicName;
    this.type = clinicType;
    this.sector = clinicSector;
    this.subtype = clinicSubtype;
    this.province = clinicProvince;
  }

  async init() {
    if (!this.clinicID) return this.renderError('No facility selected.', 'Go back to the map.');
    this.renderClinicHeader();
    this.renderActionCards();
    await this.renderStaffList();
    await this.renderPendingStaff();
  }

  renderClinicHeader() {
    const typeLabel = this.type === 'hospital' ? 'HOSPITAL' : 'CLINIC / CHC';
    const typeClass = this.type === 'hospital' ? 'chip-hosp' : 'chip-clinic';
    const sectClass = this.sector === 'public' ? 'chip-public' : 'chip-private';
    const headerHtml = ` <div class="clinic-header"> ... </div> `;
    document.getElementById('dynamic-content').innerHTML = headerHtml;
  }

  renderActionCards() {
    const actionsHtml = `<div class="panel">...</div>`;
    document.getElementById('dynamic-content').insertAdjacentHTML('beforeend', actionsHtml);
  }

  async loadStaff() {
    const { data, error } = await supabase.from('Staff').select('*').eq('ClinicID', this.clinicID);
    return data || [];
  }

  async removeStaff(id, name) {
    if (!confirm(`Remove ${name}?`)) return false;
    const { error } = await supabase.from('Staff').delete().eq('id', id);
    if (!error) this.showToast(`Removed ${name}`, 'success');
    return !error;
  }

  async renderStaffList() {
    const staff = await this.loadStaff();
    const container = document.getElementById('staff-list-container');
    if (!container) return;
    container.innerHTML = staff.map(s => `<article>...</article>`).join('');
    // attach remove buttons
    document.querySelectorAll('.remove-staff-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (await this.removeStaff(btn.dataset.id, btn.dataset.name)) this.renderStaffList();
    }));
  }

  async loadPendingStaff() {
    const { data } = await supabase.from('pending_staff').select('*').eq('clinicid', this.clinicID).eq('status', 'pending');
    return data || [];
  }

  async approveStaff(pending) {
    const newStaffId = await this.generateStaffId(pending.clinicid);
    const { error: insertError } = await supabase.from('Staff').insert([{
      id: newStaffId, email: pending.email, ClinicID: pending.clinicid,
      full_name: pending.full_name, Occupation: pending.occupation || 'Staff Member',
      contact: pending.phone_number || null
    }]);
    if (!insertError) {
      await supabase.from('pending_staff').update({ status: 'approved' }).eq('email', pending.email);
      this.showToast(`✅ ${pending.full_name} approved! ID: ${newStaffId}`, 'success');
      return true;
    }
    return false;
  }

  async renderPendingStaff() {
    const pending = await this.loadPendingStaff();
    const container = document.getElementById('pending-staff-container');
    container.innerHTML = pending.map(p => `<article>...</article>`).join('');
    document.querySelectorAll('.approve-staff-btn').forEach(btn => btn.addEventListener('click', async () => {
      const pendingItem = pending.find(p => p.email === btn.dataset.email);
      if (pendingItem && await this.approveStaff(pendingItem)) {
        this.renderPendingStaff();
        this.renderStaffList();
      }
    }));
  }

  async generateStaffId(clinicId) {
    const { data } = await supabase.from('Staff').select('id').eq('ClinicID', clinicId).order('id', { ascending: false }).limit(1);
    let nextNumber = 1;
    if (data?.length) {
      const lastId = data[0].id;
      const parts = lastId.split('-');
      if (parts.length === 3) nextNumber = parseInt(parts[2], 10) + 1;
    }
    const paddedClinic = String(clinicId).padStart(5, '0');
    const paddedNumber = String(nextNumber).padStart(3, '0');
    return `STF-${paddedClinic}-${paddedNumber}`;
  }

  showToast(msg, type) { /* displays temporary toast message */ }
  renderError(title, msg) { /* shows error state */ }
}