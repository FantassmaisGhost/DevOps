class BookingController {
  constructor(clinicID, clinicName, clinicType, clinicSector, clinicCity, clinicProvince) {
    this.clinicID = clinicID;
    this.clinicName = clinicName;
    this.clinicType = clinicType;
    this.clinicSector = clinicSector;
    this.clinicCity = clinicCity;
    this.clinicProvince = clinicProvince;
    this.hoursMap = {};
    this.selectedDate = null;
    this.selectedSlot = null;
    this.currentStep = 1;
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async init() {
    if (!this.clinicID) return this.renderError('No facility selected.');
    this.renderShell();
    await this.loadHours();
    this.renderStep(1);
  }

  async loadHours() {
    const { data, error } = await this.sb.from('Operating_Hours').select('*').eq('clinicid', this.clinicID);
    if (error || !data?.length) {
      this.hoursMap = defaultHoursMap(); // from utils
    } else {
      data.forEach(row => { this.hoursMap[row.day] = row; });
    }
  }

  renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = ` <div class="clinic-header"> ... </div> <div class="booking-card">...</div> `;
  }

  renderStep(step) {
    this.currentStep = step;
    this.updateTabs();
    const body = document.getElementById('booking-body');
    if (step === 1) this.renderCalendar(body);
    else if (step === 2) this.renderSlots(body);
    else if (step === 3) this.renderDetails(body);
  }

  renderCalendar(container) {
    const today = new Date(); today.setHours(0,0,0,0);
    const maxDate = new Date(today); maxDate.setDate(today.getDate() + 60);
    // build calendar grid with date buttons, etc.
    container.innerHTML = `...`; // full calendar rendering logic
    // attach event listeners for prev/next month, date selection
  }

  renderSlots(container) {
    const dayName = DAY_NAMES[this.selectedDate.getDay()];
    const hours = this.hoursMap[dayName];
    if (!hours?.isopen) { /* show closed message */ return; }
    const slots = generateSlots(hours.opentime, hours.closingtime, 45);
    container.innerHTML = `<div class="slots-grid">${slots.map(s => `<button class="slot-btn">${s}</button>`).join('')}</div>`;
    // attach click handlers to select slot
  }

  renderDetails(container) {
    container.innerHTML = `... form with first name, last name, phone, reason, etc.`;
    document.getElementById('btn-submit').addEventListener('click', () => this.submitBooking());
  }

  async submitBooking() {
    const firstName = document.getElementById('f-firstname').value.trim();
    const lastName = document.getElementById('f-lastname').value.trim();
    const phone = document.getElementById('f-phone').value.trim();
    const reason = document.getElementById('f-reason').value.trim();
    const notes = document.getElementById('f-notes').value.trim();

    const { data: { session } } = await this.sb.auth.getSession();
    if (!session) return alert('Please log in');

    const dateStr = this.selectedDate.toISOString().split('T')[0];
    const appointmentId = crypto.randomUUID();

    const record = {
      id: appointmentId,
      ClinicID: this.clinicID,
      appointment_date: dateStr,
      appointment_time: this.selectedSlot,
      patient_name: `${firstName} ${lastName}`,
      patient_email: session.user.email,
      PatientID: session.user.id,
      reason: reason || null,
      notes: notes || null,
      status: 'waiting'
    };

    const { error } = await this.sb.from('Appointments').insert([record]);
    if (error) return alert('Failed to book.');

    // send email and create in‑app notification
    const emailHtml = `...`; // formatted email content
    await NotificationService.sendEmailNotification(session.user.email, `Appointment Confirmed - ${this.clinicName}`, emailHtml);
    await NotificationService.createDatabaseNotification(session.user.id, appointmentId, `Appointment booked at ${this.clinicName} on ${dateStr} at ${this.selectedSlot}`, 'appointment');

    this.renderConfirmation(firstName, lastName, dateStr, appointmentId);
  }

  renderConfirmation(firstName, lastName, dateStr, appointmentId) {
    const refCode = `BK-${appointmentId.slice(-6).toUpperCase()}`;
    // display confirmation message
  }
}