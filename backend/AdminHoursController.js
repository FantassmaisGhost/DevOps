class AdminHoursController {
  constructor(clinicID) {
    this.clinicID = clinicID;
    this.originalHours = [];
    this.currentHours = [];
    this.staffList = [];
  }

  async init() {
    await this.loadHours();
    this.renderClinicHeader();    // uses clinicID and URL params
    this.renderHours();
    this.renderStaff();
    this.attachEventListeners();
  }

  async loadHours() {
    const { data, error } = await supabase.from('operating_hours').select('*').eq('clinicid', this.clinicID).order('operatingid');
    if (error || !data?.length) {
      this.originalHours = DAY_NAMES.map(day => ({
        operatingid: null, clinicid: this.clinicID, day,
        opentime: ['Saturday','Sunday'].includes(day) ? '09:00:00' : '08:00:00',
        closingtime: day === 'Saturday' ? '13:00:00' : day === 'Sunday' ? null : '17:00:00',
        isopen: day !== 'Sunday'
      }));
    } else {
      this.originalHours = DAY_NAMES.map(day => data.find(r => r.day === day) || { ...defaultRow });
    }
    this.currentHours = this.originalHours.map(r => ({ ...r }));
  }

  renderHours() {
    // builds the hours table with selects and toggle buttons
    const container = document.getElementById('hours-container');
    container.innerHTML = this.currentHours.map((row, i) => `<div class="hours-row">...</div>`).join('');
    this.updateSaveBar();
  }

  async saveHours() {
    const changed = this.currentHours.filter((_, i) => this.isRowChanged(i));
    for (const row of changed) {
      if (!row.operatingid) {
        await supabase.from('operating_hours').insert([{
          clinicid: this.clinicID, day: row.day,
          opentime: row.isopen ? row.opentime : null,
          closingtime: row.isopen ? row.closingtime : null,
          isopen: row.isopen
        }]);
      } else {
        await supabase.from('operating_hours').update({
          opentime: row.isopen ? row.opentime : null,
          closingtime: row.isopen ? row.closingtime : null,
          isopen: row.isopen
        }).eq('operatingid', row.operatingid);
      }
    }
    await this.loadHours();
    this.renderHours();
    this.showToast('Operating hours saved', 'success');
    this.updateSaveBar();
  }

  discardChanges() {
    this.currentHours = this.originalHours.map(r => ({ ...r }));
    this.renderHours();
  }

  isRowChanged(i) {
    const cur = this.currentHours[i];
    const orig = this.originalHours[i];
    return cur.opentime !== orig.opentime || cur.closingtime !== orig.closingtime || cur.isopen !== orig.isopen;
  }

  updateSaveBar() {
    const changedCount = this.currentHours.filter((_, i) => this.isRowChanged(i)).length;
    const saveBtn = document.getElementById('save-hours-btn');
    const discardBtn = document.getElementById('discard-btn');
    if (changedCount > 0) {
      saveBtn.disabled = false;
      discardBtn.style.display = 'inline-block';
      document.getElementById('change-badge').textContent = `${changedCount} unsaved change${changedCount>1?'s':''}`;
    } else {
      saveBtn.disabled = true;
      discardBtn.style.display = 'none';
    }
  }

  async renderStaff() { /* loads and displays staff list from Supabase Staff table */ }
  addStaff() { /* inserts new staff record (placeholder for future implementation) */ }
  removeStaff(id) { /* deletes staff record */ }
  generateTimeOptions(selected) { /* returns option tags for hours */ }
}