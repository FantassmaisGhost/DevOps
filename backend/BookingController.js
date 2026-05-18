class BookingController {
  constructor(clinicID, clinicName, clinicType, clinicSector, clinicCity, clinicProvince) {
    this.clinicID = clinicID;
    this.clinicName = clinicName;
    this.clinicType = clinicType;
    this.clinicSector = clinicSector;
    this.clinicCity = clinicCity;
    this.clinicProvince = clinicProvince;
    this.hoursMap = {};
    this.staffList = [];
    this.availableStaff = [];
    this.selectedStaffID = null;
    this.selectedStaffName = null;
    this.selectedDate = null;
    this.selectedSlot = null;
    this.currentStep = 1;
    this.calYear = new Date().getFullYear();
    this.calMonth = new Date().getMonth();
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async init() {
    if (!this.clinicID) return this.renderError('No facility selected.');
    this.renderShell();
    await Promise.all([this.loadHours(), this.loadStaff()]);
    this.renderStep(1);
  }

  async loadHours() {
    const { data, error } = await this.sb.from('Operating_Hours').select('*').eq('clinicid', this.clinicID);
    if (error || !data?.length) {
      this.hoursMap = defaultHoursMap();
    } else {
      data.forEach(row => { this.hoursMap[row.day] = row; });
    }
  }

  async loadStaff() {
    const { data, error } = await this.sb
      .from('Staff')
      .select('id, full_name, Occupation')
      .eq('ClinicID', this.clinicID)
      .eq('status', 'Available');
    if (!error && data) this.staffList = data;
    else this.staffList = [];
    console.log(`Loaded ${this.staffList.length} staff members`, this.staffList);
  }

  async isStaffAvailable(staffId, date, startTime, durationMinutes = 45) {
    const endTime = this.getEndTime(startTime, durationMinutes);
    const { data: unavail } = await this.sb
      .from('staff_unavail')
      .select('id')
      .eq('Staff_id', staffId)
      .eq('Date', date)
      .or(`Start.lte.${endTime},End.gte.${startTime}`);
    if (unavail && unavail.length > 0) return false;

    const { data: appointments } = await this.sb
      .from('Appointments')
      .select('id')
      .eq('StaffID', staffId)
      .eq('appointment_date', date)
      .or(`appointment_time.lte.${endTime},appointment_time.gte.${startTime}`)
      .not('status', 'in', '("cancelled","no-show")')
      .limit(1);
    if (appointments && appointments.length > 0) return false;

    return true;
  }

  getEndTime(startTime, durationMinutes) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const total = hours * 60 + minutes + durationMinutes;
    return `${Math.floor(total / 60).toString().padStart(2,'0')}:${(total % 60).toString().padStart(2,'0')}`;
  }

  async filterAvailableStaff() {
    if (!this.selectedDate || !this.selectedSlot) {
      this.availableStaff = [];
      return;
    }
    const dateStr = this.selectedDate.toISOString().split('T')[0];
    const results = await Promise.all(this.staffList.map(async (staff) => ({
      ...staff,
      available: await this.isStaffAvailable(staff.id, dateStr, this.selectedSlot)
    })));
    this.availableStaff = results.filter(s => s.available);
    console.log(`Available staff: ${this.availableStaff.length}`, this.availableStaff);
  }

  // ========== UI METHODS (simplified) ==========
  renderShell() {
    document.getElementById('app').innerHTML = `
      <div class="clinic-header">
        <a href="map.html">← Back</a>
        <h1>${this.esc(this.clinicName)}</h1>
      </div>
      <div class="booking-card">
        <div class="booking-steps">
          <div class="step-tab active" id="tab-1">1. DATE</div>
          <div class="step-tab" id="tab-2">2. TIME</div>
          <div class="step-tab" id="tab-3">3. DETAILS</div>
        </div>
        <div class="booking-body" id="booking-body"></div>
      </div>
    `;
  }

  renderStep(step) {
    this.currentStep = step;
    // Update tabs UI
    for (let i = 1; i <= 3; i++) {
      const tab = document.getElementById(`tab-${i}`);
      if (tab) tab.className = 'step-tab' + (i === step ? ' active' : '') + (i < step ? ' done' : '');
    }
    const body = document.getElementById('booking-body');
    if (step === 1) this.renderCalendar(body);
    else if (step === 2) this.renderSlots(body);
    else if (step === 3) this.renderDetails(body);
  }

  renderCalendar(container) { /* Your existing calendar rendering */ }
  renderSlots(container) { /* Your existing slots rendering */ }

  renderDetails(container) {
    const dateLabel = this.selectedDate.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    container.innerHTML = `
      <div class="summary-box"><strong>${this.esc(this.clinicName)}</strong><br>${dateLabel} at ${this.selectedSlot}</div>
      <div class="form-group"><label>First Name *</label><input id="f-firstname" type="text"></div>
      <div class="form-group"><label>Last Name *</label><input id="f-lastname" type="text"></div>
      <div class="form-group"><label>Phone *</label><input id="f-phone" type="tel"></div>
      <div class="form-group"><label>Preferred Staff (optional)</label><select id="f-staff">${this.buildStaffOptions()}</select></div>
      <div class="form-group"><label>Reason</label><input id="f-reason" type="text"></div>
      <div class="form-group"><label>Notes</label><input id="f-notes" type="text"></div>
      <div id="form-error" style="color:red;display:none;"></div>
      <div class="step-actions"><button id="btn-back-3">← Change Time</button><button id="btn-submit">Confirm Booking</button></div>
    `;
    document.getElementById('btn-back-3')?.addEventListener('click', () => this.renderStep(2));
    document.getElementById('btn-submit')?.addEventListener('click', () => this.submitBooking());
    document.getElementById('f-staff')?.addEventListener('change', (e) => {
      const opt = e.target.options[e.target.selectedIndex];
      this.selectedStaffID = e.target.value || null;
      this.selectedStaffName = opt?.dataset?.name || null;
    });
  }

  buildStaffOptions() {
    if (!this.availableStaff.length) return '<option value="">— No staff available —</option>';
    let html = '<option value="">— Select staff (leave blank for auto-assign) —</option>';
    for (const s of this.availableStaff) {
      html += `<option value="${this.esc(s.id)}" data-name="${this.esc(s.full_name)}">${this.esc(s.full_name)}${s.Occupation ? ` (${this.esc(s.Occupation)})` : ''}</option>`;
    }
    return html;
  }

  // ========== SUBMIT WITH AUTO-ASSIGN ==========
  async submitBooking() {
    const firstName = document.getElementById('f-firstname').value.trim();
    const lastName = document.getElementById('f-lastname').value.trim();
    const phone = document.getElementById('f-phone').value.trim();
    const errDiv = document.getElementById('form-error');
    if (!firstName || !lastName || !phone) {
      errDiv.textContent = 'Please fill in all required fields.';
      errDiv.style.display = 'block';
      return;
    }
    const { data: { session } } = await this.sb.auth.getSession();
    if (!session) {
      errDiv.textContent = 'Please log in.';
      errDiv.style.display = 'block';
      return;
    }

    const dateStr = this.selectedDate.toISOString().split('T')[0];
    const appointmentId = crypto.randomUUID();

    // Refresh available staff right before booking
    await this.filterAvailableStaff();

    let assignedStaffId = this.selectedStaffID;
    let assignedStaffName = this.selectedStaffName;

    // Auto-assign if none selected
    if (!assignedStaffId) {
      if (this.availableStaff.length === 0) {
        errDiv.textContent = 'No staff available for this time. Please choose a different time.';
        errDiv.style.display = 'block';
        return;
      }
      const randomIndex = Math.floor(Math.random() * this.availableStaff.length);
      const autoStaff = this.availableStaff[randomIndex];
      assignedStaffId = autoStaff.id;
      assignedStaffName = autoStaff.full_name;
      console.log(`Auto-assigned: ${assignedStaffName} (${assignedStaffId})`);
      // Update controller state
      this.selectedStaffID = assignedStaffId;
      this.selectedStaffName = assignedStaffName;
      // Update dropdown to show selected
      const staffSelect = document.getElementById('f-staff');
      if (staffSelect) {
        for (let i = 0; i < staffSelect.options.length; i++) {
          if (staffSelect.options[i].value === assignedStaffId) {
            staffSelect.selectedIndex = i;
            break;
          }
        }
      }
    } else {
      // Verify still available
      const stillAvailable = await this.isStaffAvailable(assignedStaffId, dateStr, this.selectedSlot);
      if (!stillAvailable) {
        errDiv.textContent = 'Selected staff no longer available. Please choose again.';
        errDiv.style.display = 'block';
        await this.filterAvailableStaff();
        this.renderDetails(document.getElementById('booking-body'));
        return;
      }
    }

    // Final safety check
    if (!assignedStaffId) {
      errDiv.textContent = 'Could not assign a staff member. Please contact the facility.';
      errDiv.style.display = 'block';
      return;
    }

    const record = {
      id: appointmentId,
      ClinicID: this.clinicID,
      appointment_date: dateStr,
      appointment_time: this.selectedSlot,
      patient_name: `${firstName} ${lastName}`,
      patient_email: session.user.email,
      PatientID: session.user.id,
      reason: document.getElementById('f-reason').value.trim() || null,
      notes: document.getElementById('f-notes').value.trim() || null,
      status: 'waiting',
      StaffID: assignedStaffId
    };

    console.log('Inserting appointment:', record);

    const { error } = await this.sb.from('Appointments').insert([record]);
    if (error) {
      console.error('Insert error:', error);
      errDiv.textContent = `Booking failed: ${error.message}`;
      errDiv.style.display = 'block';
      return;
    }

    // Success – send notifications
    const formattedDate = this.selectedDate.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const emailHtml = `<div><h2>Appointment Confirmed</h2><p>Dear ${firstName},</p><p>Your appointment at ${this.clinicName} on ${formattedDate} at ${this.selectedSlot} has been booked.</p><p>Staff: ${assignedStaffName}</p></div>`;
    await NotificationService.sendEmailNotification(session.user.email, `Appointment Confirmed - ${this.clinicName}`, emailHtml);
    await NotificationService.createDatabaseNotification(session.user.id, appointmentId, `Appointment booked at ${this.clinicName} on ${formattedDate} at ${this.selectedSlot}`, 'appointment');

    this.renderConfirmation(firstName, lastName, assignedStaffName, formattedDate);
  }

  renderConfirmation(firstName, lastName, staffName, formattedDate) {
    const bookingCard = document.querySelector('.booking-card');
    bookingCard.innerHTML = `
      <div class="confirmation">
        <h2>✅ Booking Confirmed!</h2>
        <p>${firstName} ${lastName}, your appointment is confirmed.</p>
        <div class="summary-box">
          <div><strong>Facility:</strong> ${this.esc(this.clinicName)}</div>
          <div><strong>Date:</strong> ${formattedDate}</div>
          <div><strong>Time:</strong> ${this.selectedSlot}</div>
          <div><strong>Staff assigned:</strong> ${this.esc(staffName)}</div>
        </div>
        <a href="map.html" class="btn-next">← Back to Map</a>
      </div>
    `;
  }

  esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }
}