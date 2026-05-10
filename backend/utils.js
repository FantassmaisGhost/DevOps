// utils.js
export class Utils {
  public static DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  public static DAY_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  public static MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  public static SLOT_MINUTES = 30;

  static generateSlots(opentime, closingtime, intervalMinutes = this.SLOT_MINUTES) {
    if (!opentime || !closingtime) return [];
    const [oh, om] = opentime.split(':').map(Number);
    const [ch, cm] = closingtime.split(':').map(Number);
    if (isNaN(oh) || isNaN(om) || isNaN(ch) || isNaN(cm)) return [];
    const start = oh * 60 + om;
    const end = ch * 60 + cm;
    if (start >= end || intervalMinutes <= 0) return [];
    const slots = [];
    for (let t = start; t + intervalMinutes <= end; t += intervalMinutes) {
      const h = String(Math.floor(t / 60)).padStart(2, '0');
      const m = String(t % 60).padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
    return slots;
  }

  static fmtTime(t) {
    if (!t) return '';
    return String(t).slice(0, 5);
  }

  static esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  static haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  static getMarkerColor(facility) {
    if (facility.sector === 'private') return '#ff6b6b';
    if (facility.type === 'hospital') return '#60b4ff';
    return '#00e5a0';
  }

  static generateRefCode() {
    const ts = Date.now().toString(36).toUpperCase().slice(-4);
    const rnd = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0');
    return `BK-${ts}${rnd}`;
  }

  static defaultHoursMap() {
    const map = {};
    this.DAY_NAMES.forEach(day => {
      const weekday = !['Saturday', 'Sunday'].includes(day);
      map[day] = { opentime: weekday ? '08:00:00' : null, closingtime: weekday ? '17:00:00' : null, isopen: weekday };
    });
    return map;
  }

  static formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  static isToday(date, now = new Date()) {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }

  static isPastDate(date, now = new Date()) {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    return d < today;
  }

  static validateBookingForm({ firstName, lastName, phone } = {}) {
    if (!firstName || !firstName.trim()) return { valid: false, error: 'First name is required.' };
    if (!lastName || !lastName.trim()) return { valid: false, error: 'Last name is required.' };
    if (!phone || !phone.trim()) return { valid: false, error: 'Phone number is required.' };
    return { valid: true, error: null };
  }

  static filterFacilities(facilities, filters = {}) {
    const { query = '', province = '', type = '', sector = '', userLat = null, userLng = null, activeRadius = 0 } = filters;
    const q = query.trim().toLowerCase();
    return facilities.filter(f => {
      if (q && !`${f.name} ${f.city} ${f.province}`.toLowerCase().includes(q)) return false;
      if (province && f.province !== province) return false;
      if (type && f.type !== type) return false;
      if (sector && f.sector !== sector) return false;
      if (userLat != null && activeRadius > 0) {
        const dist = this.haversineKm(userLat, userLng, f.lat, f.lng);
        if (dist > activeRadius) return false;
      }
      return true;
    });
  }
}