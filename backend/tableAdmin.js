// tableAdmin.js
import { supabase } from './supabase.js';

export class TableAdminController {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.clinicID = params.get('clinicID');
    console.log('Editing hours for clinic:', this.clinicID);
  }

  async loadHours() {
    const { data, error } = await supabase.from('Operating_Hours').select('*').eq('clinicid', this.clinicID);
    if (error) {
      console.error('Error loading hours:', error);
      return;
    }
    if (data && data.length > 0) {
      data.forEach(row => {
        const day = row.day;
        const openInput = document.querySelector(`input[data-day="${day}"][data-field="opentime"]`);
        const closeInput = document.querySelector(`input[data-day="${day}"][data-field="closingtime"]`);
        const isOpenInput = document.querySelector(`input[data-day="${day}"][data-field="isopen"]`);
        if (openInput) openInput.value = row.opentime ? row.opentime.slice(0, 5) : '';
        if (closeInput) closeInput.value = row.closingtime ? row.closingtime.slice(0, 5) : '';
        if (isOpenInput) isOpenInput.checked = row.isopen;
      });
    }
  }

  async saveHours(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('saveBtn');
   saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const errors = [];
    for (const day of days) {
      const openEl = document.querySelector(`input[data-day="${day}"][data-field="opentime"]`);
      const closeEl = document.querySelector(`input[data-day="${day}"][data-field="closingtime"]`);
      const isOpenEl = document.querySelector(`input[data-day="${day}"][data-field="isopen"]`);
      const openTime = openEl?.value || '';
      const closeTime = closeEl?.value || '';
      const isOpen = isOpenEl?.checked || false;
      let payload;
      if (!isOpen) {
        payload = { opentime: null, closingtime: null, isopen: false };
      } else {
        if (!openTime || !closeTime) {
          errors.push(`Missing time for ${day}`);
          continue;
        }
        const openParts = openTime.split(':').map(Number);
        const closeParts = closeTime.split(':').map(Number);
        const openMinutes = openParts[0] * 60 + openParts[1];
        const closeMinutes = closeParts[0] * 60 + closeParts[1];
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
    if (errors.length > 0) alert(errors.join('\n'));
    else alert(`Hours saved successfully for clinic ${this.clinicID}!`);
  }
}

const controller = new TableAdminController();
document.getElementById('hoursForm').addEventListener('submit', (e) => controller.saveHours(e));
controller.loadHours();