class TableAdminController {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.clinicID = params.get('clinicID');
  }

  async loadHours() {
    const { data, error } = await supabase.from('Operating_Hours').select('*').eq('clinicid', this.clinicID);
    if (data) {
      data.forEach(row => {
        const openInput = document.querySelector(`input[data-day="${row.day}"][data-field="opentime"]`);
        if (openInput) openInput.value = row.opentime ? row.opentime.slice(0,5) : '';
        const closeInput = document.querySelector(`input[data-day="${row.day}"][data-field="closingtime"]`);
        if (closeInput) closeInput.value = row.closingtime ? row.closingtime.slice(0,5) : '';
        const isOpenCheck = document.querySelector(`input[data-day="${row.day}"][data-field="isopen"]`);
        if (isOpenCheck) isOpenCheck.checked = row.isopen;
      });
    }
  }

  async saveHours(event) {
    event.preventDefault();
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const errors = [];
    for (const day of days) {
      const openEl = document.querySelector(`input[data-day="${day}"][data-field="opentime"]`);
      const closeEl = document.querySelector(`input[data-day="${day}"][data-field="closingtime"]`);
      const isOpenEl = document.querySelector(`input[data-day="${day}"][data-field="isopen"]`);
      const isOpen = isOpenEl?.checked || false;
      let payload;
      if (!isOpen) {
        payload = { opentime: null, closingtime: null, isopen: false };
      } else {
        const openTime = openEl?.value || '';
        const closeTime = closeEl?.value || '';
        if (!openTime || !closeTime) {
          errors.push(`Missing time for ${day}`);
          continue;
        }
        const openMinutes = openTime.split(':').map(Number)[0]*60 + openTime.split(':').map(Number)[1];
        const closeMinutes = closeTime.split(':').map(Number)[0]*60 + closeTime.split(':').map(Number)[1];
        if (openMinutes >= closeMinutes) {
          errors.push(`Error for ${day}: opening time must be before closing time`);
          continue;
        }
        payload = { opentime: openTime, closingtime: closeTime, isopen: true };
      }
      const { error } = await supabase.from('Operating_Hours').update(payload).eq('clinicid', this.clinicID).eq('day', day);
      if (error) errors.push(`Database error on ${day}: ${error.message}`);
    }
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
    if (errors.length) alert(errors.join('\n'));
    else alert(`Hours saved successfully for clinic ${this.clinicID}!`);
  }
}