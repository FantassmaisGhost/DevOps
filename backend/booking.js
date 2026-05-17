// booking.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import { NotificationService} from '../backend/notificationService.js';
import { Utils } from '../backend/utils.js';
import { supabase } from '../backend/supabase.js';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SLOT_MINUTES = 45;

export class BookingController {
  constructor(clinicID, clinicName, clinicType, clinicSector, clinicCity, clinicProvince) {
    this.clinicID = clinicID;
    this.clinicName = clinicName;
    this.clinicType = clinicType;
    this.clinicSector = clinicSector;
    this.clinicCity = clinicCity;
    this.clinicProvince = clinicProvince;
    this.hoursMap = {};
    this.doctors = [];           // staff list for this clinic
    this.selectedDoctorID = null;
    this.selectedDoctorName = null;
    this.calYear = new Date().getFullYear();
    this.calMonth = new Date().getMonth();
    this.selectedDate = null;
    this.selectedSlot = null;
    this.currentStep = 1;
    this.sb = supabase;
    this.app = document.getElementById('app');
  }

  esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  fmtTime(t) {
    if (!t) return '';
    return t.slice(0, 5);
  }

  generateSlots(opentime, closingtime) {
    if (!opentime || !closingtime) return [];
    const [oh, om] = opentime.split(':').map(Number);
    const [ch, cm] = closingtime.split(':').map(Number);
    const start = oh * 60 + om;
    const end = ch * 60 + cm;
    const slots = [];
    for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
      const h = String(Math.floor(t / 60)).padStart(2, '0');
      const m = String(t % 60).padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
    return slots;
  }

  async loadHours() {
    const { data, error } = await this.sb.from('Operating_Hours').select('*').eq('clinicid', this.clinicID);
    if (error || !data || data.length === 0) {
      DAY_NAMES.forEach(day => {
        const weekday = !['Saturday','Sunday'].includes(day);
        this.hoursMap[day] = { opentime: weekday ? '08:00:00' : null, closingtime: weekday ? '17:00:00' : null, isopen: weekday };
      });
      return;
    }
    data.forEach(row => { this.hoursMap[row.day] = row; });
  }

  /**
   * Fetches all staff members assigned to this clinic from the Staff table.
   * Assumes columns: staffid, clinicid, first_name, last_name, role
   * Adjust column names below if your schema differs.
   */
  async loadDoctors() {
    const { data, error } = await this.sb
      .from('Staff')
      .select('staffid, first_name, last_name, role')
      .eq('clinicid', this.clinicID)
      .order('last_name', { ascending: true });

    if (error || !data) {
      this.doctors = [];
      return;
    }
    this.doctors = data;
  }

  renderShell() {
    const typeLabel = this.clinicType === 'hospital' ? 'HOSPITAL' : 'CLINIC / CHC';
    const typeClass = this.clinicType === 'hospital' ? 'chip-hosp' : 'chip-clinic';
    const sectClass = this.clinicSector === 'public' ? 'chip-public' : 'chip-private';
    this.app.innerHTML = `
      <div class="clinic-header">
        <a href="index.html" class="back-link">← Back to map</a>
        <h1 class="clinic-name" id="clinic-name">${this.esc(this.clinicName)}</h1>
        <div class="clinic-meta"><span>${this.esc(this.clinicCity)}${this.clinicCity && this.clinicProvince ? ' · ' : ''}${this.esc(this.clinicProvince)}</span></div>
        <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
          <span class="chip ${typeClass}">${typeLabel}</span>
          <span class="chip ${sectClass}">${this.clinicSector.toUpperCase()}</span>
          <span class="chip chip-prov">${this.esc(this.clinicProvince).toUpperCase()}</span>
        </div>
      </div>
      <div class="hours-panel" id="hours-panel"><p class="section-label">Operating Hours</p><div class="hours-grid" id="hours-grid"><div class="hours-loading">Loading hours…</div></div></div>
      <div class="booking-card" id="booking-card">
        <div class="booking-steps" id="booking-steps"><div class="step-tab active" id="tab-1">1. DATE</div><div class="step-tab" id="tab-2">2. TIME</div><div class="step-tab" id="tab-3">3. DETAILS</div></div>
        <div class="booking-body" id="booking-body"></div>
      </div>
    `;
  }

  renderHoursPanel() {
    const grid = document.getElementById('hours-grid');
    if (!grid) return;
    const rows = DAY_NAMES.map(day => {
      const h = this.hoursMap[day];
      if (!h || !h.isopen) return `<div class="hours-row"><span class="hours-day">${day}</span><span class="hours-closed">Closed</span></div>`;
      const open = this.fmtTime(h.opentime);
      const close = this.fmtTime(h.closingtime);
      return `<div class="hours-row"><span class="hours-day">${day}</span><span class="hours-time">${open} – ${close}</span></div>`;
    }).join('');
    grid.innerHTML = rows;
  }

  updateTabs() {
    for (let i = 1; i <= 3; i++) {
      const tab = document.getElementById(`tab-${i}`);
      if (tab) tab.className = 'step-tab' + (i === this.currentStep ? ' active' : '') + (i < this.currentStep ? ' done' : '');
    }
  }

  renderStep(step) {
    this.currentStep = step;
    this.renderHoursPanel();
    this.updateTabs();
    const body = document.getElementById('booking-body');
    if (!body) return;
    if (step === 1) this.renderCalendar(body);
    else if (step === 2) this.renderSlots(body);
    else if (step === 3) this.renderDetails(body);
  }

  renderCalendar(container) {
    const today = new Date(); today.setHours(0,0,0,0);
    const maxDate = new Date(today); maxDate.setDate(today.getDate() + 60);
    const firstDay = new Date(this.calYear, this.calMonth, 1);
    const lastDay = new Date(this.calYear, this.calMonth + 1, 0);
    const dayHeaders = DAY_SHORT.map(d => `<div class="day-header">${d}</div>`).join('');
    const startDow = firstDay.getDay();
    const blanks = Array(startDow).fill('<div></div>').join('');
    const dateBtns = [];
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(this.calYear, this.calMonth, d); date.setHours(0,0,0,0);
      const dayName = DAY_NAMES[date.getDay()];
      const h = this.hoursMap[dayName];
      const isOpen = h && h.isopen;
      const isPast = date < today;
      const isFuture = date > maxDate;
      const isToday = date.getTime() === today.getTime();
      const isSel = this.selectedDate && date.getTime() === this.selectedDate.getTime();
      let cls = 'date-btn';
      if (isSel) cls += ' selected';
      else if (isToday) cls += ' today';
      if (!isOpen) cls += ' closed';
      const disabled = isPast || isFuture || !isOpen;
      dateBtns.push(`<button class="${cls}" ${disabled ? 'disabled' : ''} data-date="${date.toISOString()}">${d}</button>`);
    }
    container.innerHTML = `
      <div class="cal-nav"><button class="cal-nav-btn" id="cal-prev">‹</button><span class="cal-month-label">${MONTH_NAMES[this.calMonth]} ${this.calYear}</span><button class="cal-nav-btn" id="cal-next">›</button></div>
      <div class="date-grid">${dayHeaders}${blanks}${dateBtns.join('')}</div>
      <div class="step-actions"><span></span><button class="btn-next" id="btn-next-1" ${!this.selectedDate ? 'disabled' : ''}>Continue →</button></div>
    `;
    document.getElementById('cal-prev').addEventListener('click', () => {
      this.calMonth--; if (this.calMonth < 0) { this.calMonth = 11; this.calYear--; }
      this.renderStep(1);
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      this.calMonth++; if (this.calMonth > 11) { this.calMonth = 0; this.calYear++; }
      this.renderStep(1);
    });
    container.querySelectorAll('.date-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedDate = new Date(btn.dataset.date);
        this.selectedSlot = null;
        this.renderStep(1);
      });
    });
    document.getElementById('btn-next-1').addEventListener('click', () => { if (this.selectedDate) this.renderStep(2); });
  }

  renderSlots(container) {
    if (!this.selectedDate) { this.renderStep(1); return; }
    const dayName = DAY_NAMES[this.selectedDate.getDay()];
    const h = this.hoursMap[dayName];
    const dateLabel = this.selectedDate.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (!h || !h.isopen || !h.opentime || !h.closingtime) {
      container.innerHTML = `<p class="section-label">Select a time for <strong>${dateLabel}</strong></p><div class="slots-closed">✕ This facility is closed on ${dayName}s.<br><small style="margin-top:6px;display:block;">Please select a different date.</small></div><div class="step-actions"><button class="btn-back" id="btn-back-2">← Change Date</button><span></span></div>`;
      document.getElementById('btn-back-2').addEventListener('click', () => this.renderStep(1));
      return;
    }
    const slots = this.generateSlots(h.opentime, h.closingtime);
    const slotBtns = slots.map(slot => `<button class="slot-btn ${slot === this.selectedSlot ? 'selected' : ''}" data-slot="${slot}">${slot}</button>`).join('');
    container.innerHTML = `<p class="section-label">Select a time for <strong>${dateLabel}</strong></p><div class="slots-grid" id="slots-grid">${slotBtns}</div><div class="step-actions"><button class="btn-back" id="btn-back-2">← Change Date</button><button class="btn-next" id="btn-next-2" ${!this.selectedSlot ? 'disabled' : ''}>Continue →</button></div>`;
    document.getElementById('btn-back-2').addEventListener('click', () => this.renderStep(1));
    document.getElementById('btn-next-2').addEventListener('click', () => { if (this.selectedSlot) this.renderStep(3); });
    container.querySelectorAll('.slot-btn').forEach(btn => {
      btn.addEventListener('click', () => { this.selectedSlot = btn.dataset.slot; this.renderStep(2); });
    });
  }

  /**
   * Builds the <select> options for the doctor dropdown.
   * Shows a loading state if doctors haven't resolved yet (shouldn't happen as
   * loadDoctors() is awaited in init()), and a helpful fallback if none found.
   */
  buildDoctorOptions() {
    if (this.doctors.length === 0) {
      return `<option value="">— No doctors on file for this facility —</option>`;
    }
    const placeholder = `<option value="">— Select a doctor (optional) —</option>`;
    const options = this.doctors.map(doc => {
      const name = `Dr. ${this.esc(doc.first_name)} ${this.esc(doc.last_name)}${doc.role ? ` · ${this.esc(doc.role)}` : ''}`;
      const selected = doc.staffid === this.selectedDoctorID ? 'selected' : '';
      return `<option value="${this.esc(doc.staffid)}" data-name="${this.esc(`Dr. ${doc.first_name} ${doc.last_name}`)}" ${selected}>${name}</option>`;
    }).join('');
    return placeholder + options;
  }

  renderDetails(container) {
    const dateLabel = this.selectedDate.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    container.innerHTML = `
      <div class="summary-box">
        <div class="summary-title">Appointment Summary</div>
        <div class="summary-row"><span class="summary-key">Facility</span><span class="summary-val">${this.esc(this.clinicName)}</span></div>
        <div class="summary-row"><span class="summary-key">Date</span><span class="summary-val">${dateLabel}</span></div>
        <div class="summary-row"><span class="summary-key">Time</span><span class="summary-val">${this.selectedSlot}</span></div>
      </div>
      <p class="section-label">Your Details</p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="f-firstname">First Name *</label>
          <input class="form-input" id="f-firstname" type="text" placeholder="e.g. Thabo" autocomplete="given-name" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="f-lastname">Last Name *</label>
          <input class="form-input" id="f-lastname" type="text" placeholder="e.g. Nkosi" autocomplete="family-name" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="f-phone">Phone Number *</label>
          <input class="form-input" id="f-phone" type="tel" placeholder="e.g. 071 234 5678" autocomplete="tel" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="f-doctor">Preferred Doctor</label>
          <select class="form-input" id="f-doctor">
            ${this.buildDoctorOptions()}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="f-reason">Reason for Visit</label>
        <input class="form-input" id="f-reason" type="text" placeholder="e.g. General checkup, chronic medication, etc." />
      </div>
      <div class="form-group">
        <label class="form-label" for="f-notes">Additional Notes (optional)</label>
        <input class="form-input" id="f-notes" type="text" placeholder="Anything the clinic should know…" />
      </div>
      <div id="form-error" style="color:var(--accent2);font-size:11px;margin-bottom:8px;display:none;"></div>
      <div class="step-actions">
        <button class="btn-back" id="btn-back-3">← Change Time</button>
        <button class="btn-next" id="btn-submit">Confirm Booking</button>
      </div>
    `;

    // Keep doctor selection in sync with controller state
    const doctorSelect = document.getElementById('f-doctor');
    doctorSelect.addEventListener('change', () => {
      const chosen = doctorSelect.options[doctorSelect.selectedIndex];
      this.selectedDoctorID   = doctorSelect.value || null;
      this.selectedDoctorName = doctorSelect.value ? chosen.dataset.name : null;
    });

    document.getElementById('btn-back-3').addEventListener('click', () => this.renderStep(2));
    document.getElementById('btn-submit').addEventListener('click', () => this.submitBooking());
  }

  async submitBooking() {
    const firstName = document.getElementById('f-firstname').value.trim();
    const lastName  = document.getElementById('f-lastname').value.trim();
    const phone     = document.getElementById('f-phone').value.trim();
    const reason    = document.getElementById('f-reason').value.trim();
    const notes     = document.getElementById('f-notes').value.trim();
    const errEl     = document.getElementById('form-error');
    const submitBtn = document.getElementById('btn-submit');

    if (!firstName || !lastName || !phone) {
      errEl.textContent = 'Please fill in your first name, last name and phone number.';
      errEl.style.display = 'block';
      return;
    }

    const { data: { session } } = await this.sb.auth.getSession();
    if (!session) {
      errEl.textContent = 'Please log in before booking an appointment.';
      errEl.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Booking...';
    errEl.style.display = 'none';

    const dateStr = [
      this.selectedDate.getFullYear(),
      String(this.selectedDate.getMonth() + 1).padStart(2, '0'),
      String(this.selectedDate.getDate()).padStart(2, '0')
    ].join('-');

    const userId        = session.user.id;
    const userEmail     = session.user.email;
    const appointmentId = crypto.randomUUID();
    const formattedDate = this.selectedDate.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const record = {
      id:               appointmentId,
      ClinicID:         this.clinicID,
      appointment_date: dateStr,
      appointment_time: this.selectedSlot,
      patient_name:     `${firstName} ${lastName}`,
      patient_email:    userEmail,
      PatientID:        userId,
      reason:           reason || null,
      notes:            notes  || null,
      status:           'waiting',
      // Doctor fields — null when no doctor was selected
      staffid:          this.selectedDoctorID   || null,
      doctor_name:      this.selectedDoctorName || null,
    };

    const { error: insertError } = await this.sb.from('Appointments').insert([record]);
    if (insertError) {
      errEl.textContent = 'Failed to book. Please try again.';
      errEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Booking';
      return;
    }

    const doctorLine = this.selectedDoctorName
      ? `<p><strong>Doctor:</strong> ${this.selectedDoctorName}</p>`
      : '';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00e5a0;">Appointment Confirmed ✓</h2>
        <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
        <p>Your appointment has been successfully booked with <strong>${this.esc(this.clinicName)}</strong>.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Appointment Details:</h3>
          <p><strong>Facility:</strong> ${this.esc(this.clinicName)}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${this.selectedSlot}</p>
          ${doctorLine}
          <p><strong>Reason:</strong> ${reason || 'General consultation'}</p>
        </div>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">📋 Important Information:</h3>
          <ul>
            <li>Please arrive 10 minutes before your appointment time</li>
            <li>Bring your ID document/passport</li>
            <li>Bring any relevant medical records</li>
            <li>If you need to cancel or reschedule, please contact the facility directly</li>
          </ul>
        </div>
        <p>Reference: <strong>BK-${appointmentId.slice(-6).toUpperCase()}</strong></p>
        <hr style="margin: 30px 0; border-color: #ddd;">
        <p style="color: #666; font-size: 12px;">This is an automated message from SA HealthMap. Please do not reply to this email.</p>
      </div>`;

    await NotificationService.sendEmailNotification(
      userEmail,
      `Appointment Confirmed - ${this.esc(this.clinicName)}`,
      emailHtml
    );
    await NotificationService.createDatabaseNotification(
      userId,
      appointmentId,
      `Appointment booked at ${this.esc(this.clinicName)} on ${formattedDate} at ${this.selectedSlot}`,
      'appointment'
    );

    this.renderConfirmation(firstName, lastName, dateStr, appointmentId);
  }

  renderConfirmation(firstName, lastName, dateStr, appointmentId) {
    const refCode   = `BK-${appointmentId.slice(-6).toUpperCase()}`;
    const dateLabel = this.selectedDate.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const doctorRow = this.selectedDoctorName
      ? `<div class="summary-row"><span class="summary-key">Doctor</span><span class="summary-val">${this.esc(this.selectedDoctorName)}</span></div>`
      : '';

    const bookingCard = document.getElementById('booking-card');
    bookingCard.innerHTML = `
      <div class="confirmation">
        <div class="confirm-icon">✅</div>
        <h2 class="confirm-title">Booking Confirmed!</h2>
        <p class="confirm-sub">Your appointment at <strong>${this.esc(this.clinicName)}</strong> has been booked.<br>A confirmation email has been sent to your inbox.</p>
        <div class="confirm-ref">Ref: <span>${refCode}</span></div>
        <div class="summary-box" style="text-align:left; margin-bottom:24px;">
          <div class="summary-row"><span class="summary-key">Patient</span><span class="summary-val">${this.esc(firstName)} ${this.esc(lastName)}</span></div>
          <div class="summary-row"><span class="summary-key">Facility</span><span class="summary-val">${this.esc(this.clinicName)}</span></div>
          <div class="summary-row"><span class="summary-key">Date</span><span class="summary-val">${dateLabel}</span></div>
          <div class="summary-row"><span class="summary-key">Time</span><span class="summary-val">${this.selectedSlot}</span></div>
          ${doctorRow}
        </div>
        <a href="map.html" class="btn-next" style="display:inline-block; text-decoration:none; padding: 11px 28px;">← Back to Map</a>
      </div>
    `;
  }

  renderError(title, msg) {
    this.app.innerHTML = `<div class="error-state"><h2>${this.esc(title)}</h2><p>${this.esc(msg)}</p><br><a href="index.html" class="btn-outline" style="margin-top:16px; display:inline-block;">← Back to Map</a></div>`;
  }

  async init() {
    if (!this.clinicID) {
      this.renderError('No facility selected.', 'Go back to the map and click a clinic or hospital.');
      return;
    }
    this.renderShell();
    // Load hours and doctors in parallel
    await Promise.all([this.loadHours(), this.loadDoctors()]);
    this.renderStep(1);
  }
}

// Auto-execute
const params = new URLSearchParams(location.search);
const controller = new BookingController(
  params.get('clinicID'), params.get('name') || 'Health Facility', params.get('type') || 'clinic',
  params.get('sector') || 'public', params.get('city') || '', params.get('province') || ''
);
controller.init();