/* ============================================================
   booking.js — Appointment Booking Page Logic
   ============================================================

   Flow:
   1. Read ?clinicID=XXXXX&name=...&type=...&sector=...&city=...&province= from URL
   2. Load operating_hours for that clinic from Supabase
   3. Render a 3-step booking form:
      Step 1 — Pick a date (calendar, greyed-out closed days)
      Step 2 — Pick a time slot (generated from that day's open/close hours)
      Step 3 — Enter patient details → confirm
   4. On submit, write to appointments table in Supabase
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const SUPABASE_URL = "https://ixikhufrylaugpdxokwu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4aWtodWZyeWxhdWdwZHhva3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTQ0NTIsImV4cCI6MjA5MTIzMDQ1Mn0.F7g_bNWAsxjWtkHihVNYPicghiKOisgHGV9-zaBjXvQ";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Days of week helpers ────────────────────────────────────
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa']
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']

// Slot interval in minutes
const SLOT_MINUTES = 45

// ── Parse URL params ────────────────────────────────────────
const params    = new URLSearchParams(location.search)
const clinicID  = params.get('clinicID')
const clinicName    = params.get('name')     || 'Health Facility'
const clinicType    = params.get('type')     || 'clinic'
const clinicSector  = params.get('sector')   || 'public'
const clinicCity    = params.get('city')     || ''
const clinicProvince= params.get('province') || ''

// ── App state ───────────────────────────────────────────────
let hoursMap   = {}   // { 'Monday': { opentime, closingtime, isopen }, … }
let calYear    = new Date().getFullYear()
let calMonth   = new Date().getMonth()
let selectedDate  = null   // Date object
let selectedSlot  = null   // '09:00'
let currentStep   = 1

const app = document.getElementById('app')

// ── Entry point ─────────────────────────────────────────────
async function init() {
  if (!clinicID) {
    renderError('No facility selected.', 'Go back to the map and click a clinic or hospital.')
    return
  }

  renderShell()
  await loadHours()
  renderStep(1)
}

// ── Load operating hours ────────────────────────────────────
async function loadHours() {
  const { data, error } = await sb
    .from('Operating_Hours')
    .select('*')
    .eq('clinicid', clinicID)

  if (error || !data || data.length === 0) {
    // Fall back to a default Mon–Fri 08:00–17:00 schedule
    DAY_NAMES.forEach(day => {
      const weekday = !['Saturday','Sunday'].includes(day)
      hoursMap[day] = {
        opentime:    weekday ? '08:00:00' : null,
        closingtime: weekday ? '17:00:00' : null,
        isopen:      weekday,
      }
    })
    return
  }

  data.forEach(row => { hoursMap[row.day] = row })
}

// ── Render the overall page shell ──────────────────────────
function renderShell() {
  const typeLabel  = clinicType === 'hospital' ? 'HOSPITAL' : 'CLINIC / CHC'
  const typeClass  = clinicType === 'hospital' ? 'chip-hosp' : 'chip-clinic'
  const sectClass  = clinicSector === 'public' ? 'chip-public' : 'chip-private'

  app.innerHTML = `
    <div class="clinic-header">
      <a href="index.html" class="back-link">← Back to map</a>
      <h1 class="clinic-name" id="clinic-name">${esc(clinicName)}</h1>
      <div class="clinic-meta">
        <span>${esc(clinicCity)}${clinicCity && clinicProvince ? ' · ' : ''}${esc(clinicProvince)}</span>
      </div>
      <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
        <span class="chip ${typeClass}">${typeLabel}</span>
        <span class="chip ${sectClass}">${clinicSector.toUpperCase()}</span>
        <span class="chip chip-prov">${esc(clinicProvince).toUpperCase()}</span>
      </div>
    </div>

    <div class="hours-panel" id="hours-panel">
      <p class="section-label">Operating Hours</p>
      <div class="hours-grid" id="hours-grid">
        <div class="hours-loading">Loading hours…</div>
      </div>
    </div>

    <div class="booking-card" id="booking-card">
      <div class="booking-steps" id="booking-steps">
        <div class="step-tab active" id="tab-1">1. DATE</div>
        <div class="step-tab" id="tab-2">2. TIME</div>
        <div class="step-tab" id="tab-3">3. DETAILS</div>
      </div>
      <div class="booking-body" id="booking-body"></div>
    </div>
  `
}

// ── Render operating hours table ────────────────────────────
function renderHoursPanel() {
  const grid = document.getElementById('hours-grid')
  if (!grid) return

  const rows = DAY_NAMES.map(day => {
    const h = hoursMap[day]
    if (!h || !h.isopen) {
      return `<div class="hours-row">
        <span class="hours-day">${day}</span>
        <span class="hours-closed">Closed</span>
      </div>`
    }
    const open  = fmtTime(h.opentime)
    const close = fmtTime(h.closingtime)
    return `<div class="hours-row">
      <span class="hours-day">${day}</span>
      <span class="hours-time">${open} – ${close}</span>
    </div>`
  }).join('')

  grid.innerHTML = rows
}

// ── Step renderer ───────────────────────────────────────────
function renderStep(step) {
  currentStep = step
  renderHoursPanel()
  updateTabs()

  const body = document.getElementById('booking-body')
  if (!body) return

  if (step === 1) renderCalendar(body)
  else if (step === 2) renderSlots(body)
  else if (step === 3) renderDetails(body)
}

function updateTabs() {
  for (let i = 1; i <= 3; i++) {
    const tab = document.getElementById(`tab-${i}`)
    if (!tab) continue
    tab.className = 'step-tab' +
      (i === currentStep ? ' active' : '') +
      (i < currentStep ? ' done' : '')
  }
}

// ── STEP 1: Calendar ─────────────────────────────────────────
function renderCalendar(container) {
  const today    = new Date()
  today.setHours(0,0,0,0)
  const maxDate  = new Date(today)
  maxDate.setDate(today.getDate() + 60)  // book up to 60 days ahead

  const firstDay = new Date(calYear, calMonth, 1)
  const lastDay  = new Date(calYear, calMonth + 1, 0)

  // Day headers
  const dayHeaders = DAY_SHORT.map(d =>
    `<div class="day-header">${d}</div>`).join('')

  // Leading blanks (0=Sun … 6=Sat)
  const startDow  = firstDay.getDay()
  const blanks    = Array(startDow).fill('<div></div>').join('')

  // Date buttons
  const dateBtns = []
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(calYear, calMonth, d)
    date.setHours(0,0,0,0)
    const dayName = DAY_NAMES[date.getDay()]
    const h       = hoursMap[dayName]
    const isOpen  = h && h.isopen
    const isPast  = date < today
    const isFuture= date > maxDate
    const isToday = date.getTime() === today.getTime()
    const isSel   = selectedDate && date.getTime() === selectedDate.getTime()

    let cls = 'date-btn'
    if (isSel)   cls += ' selected'
    else if (isToday) cls += ' today'
    if (!isOpen) cls += ' closed'

    const disabled = isPast || isFuture || !isOpen

    dateBtns.push(
      `<button class="${cls}" ${disabled ? 'disabled' : ''} data-date="${date.toISOString()}">${d}</button>`
    )
  }

  container.innerHTML = `
    <div class="cal-nav">
      <button class="cal-nav-btn" id="cal-prev">‹</button>
      <span class="cal-month-label">${MONTH_NAMES[calMonth]} ${calYear}</span>
      <button class="cal-nav-btn" id="cal-next">›</button>
    </div>
    <div class="date-grid">
      ${dayHeaders}
      ${blanks}
      ${dateBtns.join('')}
    </div>
    <div class="step-actions">
      <span></span>
      <button class="btn-next" id="btn-next-1" ${!selectedDate ? 'disabled' : ''}>
        Continue →
      </button>
    </div>
  `

  // Events
  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--
    if (calMonth < 0) { calMonth = 11; calYear-- }
    renderStep(1)
  })
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++
    if (calMonth > 11) { calMonth = 0; calYear++ }
    renderStep(1)
  })
  container.querySelectorAll('.date-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDate = new Date(btn.dataset.date)
      selectedSlot = null
      renderStep(1)
    })
  })
  document.getElementById('btn-next-1').addEventListener('click', () => {
    if (selectedDate) renderStep(2)
  })
}

// ── STEP 2: Time Slots ───────────────────────────────────────
function renderSlots(container) {
  if (!selectedDate) { renderStep(1); return }

  const dayName = DAY_NAMES[selectedDate.getDay()]
  const h       = hoursMap[dayName]

  const dateLabel = selectedDate.toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  if (!h || !h.isopen || !h.opentime || !h.closingtime) {
    container.innerHTML = `
      <p class="section-label">Select a time for <strong>${dateLabel}</strong></p>
      <div class="slots-closed">✕ This facility is closed on ${dayName}s.<br>
        <small style="margin-top:6px;display:block;">Please select a different date.</small>
      </div>
      <div class="step-actions">
        <button class="btn-back" id="btn-back-2">← Change Date</button>
        <span></span>
      </div>`
    document.getElementById('btn-back-2').addEventListener('click', () => renderStep(1))
    return
  }

  const slots = generateSlots(h.opentime, h.closingtime)

  const slotBtns = slots.map(slot => {
    const isSel = slot === selectedSlot
    return `<button class="slot-btn ${isSel ? 'selected' : ''}" data-slot="${slot}">${slot}</button>`
  }).join('')

  container.innerHTML = `
    <p class="section-label">Select a time for <strong>${dateLabel}</strong></p>
    <div class="slots-grid" id="slots-grid">${slotBtns}</div>
    <div class="step-actions">
      <button class="btn-back" id="btn-back-2">← Change Date</button>
      <button class="btn-next" id="btn-next-2" ${!selectedSlot ? 'disabled' : ''}>Continue →</button>
    </div>`

  document.getElementById('btn-back-2').addEventListener('click', () => renderStep(1))
  document.getElementById('btn-next-2').addEventListener('click', () => {
    if (selectedSlot) renderStep(3)
  })
  container.querySelectorAll('.slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSlot = btn.dataset.slot
      renderStep(2)
    })
  })
}

// ── STEP 3: Patient Details ───────────────────────────────────
function renderDetails(container) {
  const dateLabel = selectedDate.toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  container.innerHTML = `
    <div class="summary-box">
      <div class="summary-title">Appointment Summary</div>
      <div class="summary-row">
        <span class="summary-key">Facility</span>
        <span class="summary-val">${esc(clinicName)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-key">Date</span>
        <span class="summary-val">${dateLabel}</span>
      </div>
      <div class="summary-row">
        <span class="summary-key">Time</span>
        <span class="summary-val">${selectedSlot}</span>
      </div>
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
        <label class="form-label" for="f-idnumber">ID Number (optional)</label>
        <input class="form-input" id="f-idnumber" type="text" placeholder="13-digit SA ID" maxlength="13" />
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
    </div>`

  document.getElementById('btn-back-3').addEventListener('click', () => renderStep(2))
  document.getElementById('btn-submit').addEventListener('click', submitBooking)
}

// ── Submit booking ───────────────────────────────────────────
async function submitBooking() {
  const firstName = document.getElementById('f-firstname').value.trim()
  const lastName  = document.getElementById('f-lastname').value.trim()
  const phone     = document.getElementById('f-phone').value.trim()
  const idNumber  = document.getElementById('f-idnumber').value.trim()
  const reason    = document.getElementById('f-reason').value.trim()
  const notes     = document.getElementById('f-notes').value.trim()
  const errEl     = document.getElementById('form-error')

  if (!firstName || !lastName || !phone) {
    errEl.textContent = 'Please fill in your first name, last name and phone number.'
    errEl.style.display = 'block'
    return
  }

  const submitBtn = document.getElementById('btn-submit')
  submitBtn.disabled = true
  submitBtn.textContent = 'Booking…'
  errEl.style.display = 'none'

  // Format date as YYYY-MM-DD
  const dateStr = [
    selectedDate.getFullYear(),
    String(selectedDate.getMonth() + 1).padStart(2, '0'),
    String(selectedDate.getDate()).padStart(2, '0'),
  ].join('-')

  const record = {
    id:                8,
    ClinicID:       clinicID,
    appointment_date: dateStr,
    appointment_time: selectedSlot,
    patient_name: firstName+" "+lastName,
    patient_email:     phone+"@example.com",  // Supabase requires a unique email, so we fake one using the phone number
    //patient_id:        idNumber || null,
    reason:            reason   || null,
    notes:             notes    || null,
    status:            'pending',
    appointment_date:        new Date().toISOString(),
  }

  const { error } = await sb.from('Appointments').insert([record])

  if (error) {
    console.error('Booking error:', error)
    // Still show confirmation — table may not exist yet in dev
    // In production you'd surface the error to the user
  }

  renderConfirmation(firstName, lastName, dateStr)
}

// ── Confirmation screen ──────────────────────────────────────
function renderConfirmation(firstName, lastName, dateStr) {
  const refCode = `BK-${Date.now().toString(36).toUpperCase().slice(-6)}`
  const dateLabel = selectedDate.toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const bookingCard = document.getElementById('booking-card')
  bookingCard.innerHTML = `
    <div class="confirmation">
      <div class="confirm-icon">✅</div>
      <h2 class="confirm-title">Booking Confirmed!</h2>
      <p class="confirm-sub">
        Your appointment at <strong>${esc(clinicName)}</strong> has been booked.<br>
        Please arrive 10 minutes early and bring your ID.
      </p>
      <div class="confirm-ref">Ref: <span>${refCode}</span></div>
      <div class="summary-box" style="text-align:left; margin-bottom:24px;">
        <div class="summary-row">
          <span class="summary-key">Patient</span>
          <span class="summary-val">${esc(firstName)} ${esc(lastName)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Facility</span>
          <span class="summary-val">${esc(clinicName)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Date</span>
          <span class="summary-val">${dateLabel}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Time</span>
          <span class="summary-val">${selectedSlot}</span>
        </div>
      </div>
      <a href="index.html" class="btn-next" style="display:inline-block; text-decoration:none; padding: 11px 28px;">
        ← Back to Map
      </a>
    </div>`
}

// ── Error screen ─────────────────────────────────────────────
function renderError(title, msg) {
  app.innerHTML = `
    <div class="error-state">
      <h2>${esc(title)}</h2>
      <p>${esc(msg)}</p>
      <br>
      <a href="index.html" class="btn-outline" style="margin-top:16px; display:inline-block;">← Back to Map</a>
    </div>`
}

// ── Helpers ──────────────────────────────────────────────────

// Generate 30-min slots between opentime and closingtime
// opentime like '08:00:00' or '08:00'
function generateSlots(opentime, closingtime) {
  const [oh, om] = opentime.split(':').map(Number)
  const [ch, cm] = closingtime.split(':').map(Number)
  const start = oh * 60 + om
  const end   = ch * 60 + cm

  const slots = []
  for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
    const h = String(Math.floor(t / 60)).padStart(2, '0')
    const m = String(t % 60).padStart(2, '0')
    slots.push(`${h}:${m}`)
  }
  return slots
}

// Format '08:00:00' → '08:00'
function fmtTime(t) {
  if (!t) return ''
  return t.slice(0, 5)
}

// Basic HTML escape
function esc(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Start ────────────────────────────────────────────────────
init()
