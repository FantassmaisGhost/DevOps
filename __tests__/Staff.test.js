'use strict'

/**
 * __tests__/Staff.test.js
 * Tests for:
 *   backend/staff-dashboard.js      — isUnavailable, loadStaffDashboard,
 *                                     showPatientNotes, openRescheduleModal,
 *                                     updateAppointmentStatus, formatDate,
 *                                     formatTime, showToast, logout
 *   backend/staff-unavailability.js — init, renderList, addUnavailability,
 *                                     deleteEntry, markClashingAppointments,
 *                                     revertClashingAppointments, formatDate,
 *                                     formatTime, formatTimeRange, showToast
 */

jest.mock('../backend/supabase.js', () => {
  const m = {}
  Object.defineProperty(m, 'supabase', { get: () => global.supabase, enumerable: true })
  return m
})

jest.mock('../backend/utils.js', () => ({
  Utils: { esc: s => (s == null ? '' : String(s)) },
}))

const fs   = require('fs')
const path = require('path')

// ─── Supabase chain helper ────────────────────────────────────────────────────
function makeChain(resolvedValue) {
  const chain = { then: (resolve) => Promise.resolve(resolvedValue).then(resolve) }
  ;['select', 'eq', 'update', 'delete', 'insert', 'order', 'single', 'in', 'maybeSingle'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

// ─── Persistent DOM element store ────────────────────────────────────────────
const el = {}
function elem(id) {
  if (!el[id]) el[id] = {
    textContent:     '',
    innerHTML:       '',
    value:           '',
    disabled:        false,
    min:             '',
    max:             '',
    className:       '',
    onclick:         null,
    addEventListener: jest.fn(),
    getAttribute:    jest.fn(),
    remove:          jest.fn(),
    querySelectorAll: jest.fn(() => []),
    classList:       { remove: jest.fn(), add: jest.fn() },
  }
  return el[id]
}

// ─── Dialog mock factory ──────────────────────────────────────────────────────
function makeMockDialog() {
  return {
    id: '', className: '', innerHTML: '', onclick: null,
    showModal: jest.fn(), close: jest.fn(), remove: jest.fn(),
    querySelector:    jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
  }
}
let mockDialog = null

// ─── Globals (must be set BEFORE the eval calls below) ───────────────────────
global.Utils       = { esc: s => (s == null ? '' : String(s)) }
global.document    = {
  getElementById:   jest.fn(id => elem(id)),
  querySelectorAll: jest.fn(() => []),
  createElement:    jest.fn(() => { mockDialog = makeMockDialog(); return mockDialog }),
  body:             { appendChild: jest.fn() },
}
global.window      = { location: { href: '' } }
global.localStorage = { setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn(), getItem: jest.fn() }
global.alert       = jest.fn()
global.confirm     = jest.fn(() => true)
global.supabase    = null

// ─── Source transformation ────────────────────────────────────────────────────
function transform(filename) {
  return fs.readFileSync(path.join(__dirname, '../backend', filename), 'utf8')
    .replace(/^import\s.*?;?\s*$/gm, '')
    .replace(/\bsupabase\b(?=\.)/g, 'global.supabase')
}

// ── staff-dashboard.js eval wrapper ──────────────────────────────────────────
const dashCode = transform('staff-dashboard.js')
  .replace(/^loadStaffDashboard\(\);?\s*$/m, '')

const dash = eval(`(function () {
  const Utils = global.Utils
  ${dashCode}
  return {
    isUnavailable, showPatientNotes, loadStaffDashboard,
    openRescheduleModal, updateAppointmentStatus,
    formatDate, formatTime, showToast, logout,
    get unavailRecords() { return unavailRecords },
    set unavailRecords(v) { unavailRecords = v },
    get currentStaff()   { return currentStaff },
    set currentStaff(v)  { currentStaff = v },
  }
})()`)

// dashboard logoutBtn addEventListener registered during eval (index 0)
const dashLogoutHandler = el['logoutBtn'].addEventListener.mock.calls[0]?.[1]

// ── staff-unavailability.js eval wrapper ─────────────────────────────────────
const unavailCode = transform('staff-unavailability.js')
  .replace(/^init\(\);?\s*$/m, '')

const unavail = eval(`(function () {
  const Utils = global.Utils
  ${unavailCode}
  return {
    init, renderList, markClashingAppointments, revertClashingAppointments,
    addUnavailability, deleteEntry,
    formatDate, formatTime, formatTimeRange, showToast,
    get currentStaff()  { return currentStaff },
    set currentStaff(v) { currentStaff = v },
  }
})()`)

// unavailability logoutBtn addEventListener is index 1 (dashboard is index 0)
const unavailLogoutHandler = el['logoutBtn'].addEventListener.mock.calls[1]?.[1]

// ─── Coverage: load both files through Jest's module system ──────────────────
beforeAll(async () => {
  // ── staff-dashboard.js ────────────────────────────────────────────────────

  // Path 1: no session → early return
  global.supabase = { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } }
  jest.isolateModules(() => { require('../backend/staff-dashboard.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 2: session + Staff error → redirect to dashboard.html
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } }) },
    from: () => makeChain({ data: null, error: { message: 'DB error' } }),
  }
  jest.isolateModules(() => { require('../backend/staff-dashboard.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 3: full success — querySelectorAll captures all event handler callbacks
  const today    = new Date().toISOString().split('T')[0]
  const staffRow = { id: 'staff1', full_name: 'Dr. Smith', ClinicID: 'clinic1', email: 's@c.com' }
  const apptData = [
    { id: 'a1', patient_name: 'Alice', appointment_date: today, appointment_time: '09:00:00', status: 'waiting',   reason: 'Check',  PatientID: 'p1' },
    { id: 'a2', patient_name: 'Bob',   appointment_date: today, appointment_time: '10:00:00', status: 'complete',  reason: 'Follow', PatientID: 'p2' },
    { id: 'a3', patient_name: 'Carol', appointment_date: today, appointment_time: '11:00:00', status: 'cancelled', reason: 'Flu',    PatientID: 'p3' },
    { id: 'a4', patient_name: 'Dave',  appointment_date: today, appointment_time: '12:00:00', status: 'waiting',   reason: 'Pain',   PatientID: 'p4' },
    { id: 'a5', patient_name: 'Eve',   appointment_date: today, appointment_time: '14:00:00', status: 'unknown',   reason: 'Test',   PatientID: 'p5' },
  ]
  // a4 clashes → reschedule-button branch; a5 has unknown status → else branch (line 216)
  const unavailData = [{ Date: today, Start: '12:00', End: '13:00' }]

  let completeFn, cancelFn, rescheduleFn, viewNotesFn

  const makeClickBtn = (data, setter) => ({
    dataset: data,
    getAttribute: jest.fn(k => data[k] || null),
    addEventListener: jest.fn((evt, fn) => { if (evt === 'click') setter(fn) }),
  })

  global.document.querySelectorAll = jest.fn(sel => {
    if (sel === '.complete-btn')
      return [makeClickBtn({ id: 'a1' }, fn => { completeFn = fn })]
    if (sel === '.cancel-btn')
      return [makeClickBtn({ id: 'a3' }, fn => { cancelFn = fn })]
    if (sel === '.reschedule-btn')
      return [makeClickBtn({ id: 'a4', patient: 'Dave', date: today, time: '12:00' }, fn => { rescheduleFn = fn })]
    if (sel === '.view-notes-btn')
      return [makeClickBtn({ patientId: 'p1', appointmentId: 'a1', patientName: 'Alice' }, fn => { viewNotesFn = fn })]
    return []
  })

  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } }) },
    from: jest.fn(table => {
      if (table === 'Staff')         return makeChain({ data: staffRow,             error: null })
      if (table === 'Appointments')  return makeChain({ data: apptData,             error: null })
      if (table === 'staff_unavail') return makeChain({ data: unavailData,          error: null })
      if (table === 'Facilities')    return makeChain({ data: { Name: 'City Clinic' }, error: null })
      if (table === 'patient_notes') return makeChain({ data: [{ patient_id: 'p1', id: 'n1' }], error: null })
      return makeChain({ data: null, error: null })
    }),
  }
  jest.isolateModules(() => { require('../backend/staff-dashboard.js') })
  await new Promise(r => setTimeout(r, 30))

  // Invoke complete-btn → updateAppointmentStatus success (reload fails early — no session)
  if (completeFn) {
    global.supabase = {
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
      from: jest.fn(() => makeChain({ error: null })),
    }
    completeFn()
    await new Promise(r => setTimeout(r, 10))
  }

  // Invoke cancel-btn → confirm → updateAppointmentStatus cancelled
  if (cancelFn) {
    global.confirm = () => true
    global.supabase = {
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
      from: jest.fn(() => makeChain({ error: null })),
    }
    cancelFn()
    await new Promise(r => setTimeout(r, 10))
  }

  // Invoke reschedule-btn → openRescheduleModal, then confirm reschedule success path
  if (rescheduleFn) {
    rescheduleFn()
    elem('newDate').value = '2025-08-01'
    elem('newTime').value = '10:00'
    global.supabase = {
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
      from: jest.fn(() => makeChain({ error: null })),
    }
    if (elem('confirmRescheduleBtn').onclick) {
      await elem('confirmRescheduleBtn').onclick()
      await new Promise(r => setTimeout(r, 10))
    }
  }

  // Invoke view-notes-btn → showPatientNotes (no existing notes)
  if (viewNotesFn) {
    global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
    await viewNotesFn()
    if (elem('addNoteBtn').onclick) await elem('addNoteBtn').onclick()
  }

  // showPatientNotes with existing notes rendered
  if (viewNotesFn) {
    global.supabase = {
      from: jest.fn(() => makeChain({ data: [{ note: 'Fever', created_at: '2025-07-01T10:00:00Z' }], error: null })),
    }
    await viewNotesFn()
  }

  // showPatientNotes DB error path
  if (viewNotesFn) {
    global.supabase = { from: jest.fn(() => makeChain({ data: null, error: { message: 'Notes err' } })) }
    await viewNotesFn()
  }

  // Invoke dashboard logout handler (covers logout body)
  const dashLogH = el['logoutBtn'].addEventListener.mock.calls.slice(-1)[0]?.[1]
  if (dashLogH) {
    global.supabase = { auth: { signOut: () => Promise.resolve() } }
    await dashLogH()
  }

  // ── staff-unavailability.js ───────────────────────────────────────────────
  const staffU = { id: 'staff1', email: 's@c.com' }

  // Path 1: no session → early return
  global.supabase = { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } }
  jest.isolateModules(() => { require('../backend/staff-unavailability.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 2: session + Staff error → redirect
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } }) },
    from: () => makeChain({ data: null, error: { message: 'DB error' } }),
  }
  jest.isolateModules(() => { require('../backend/staff-unavailability.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 3: staff found, renderList DB error → covers lines 49-51 + showToast body
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } }) },
    from: jest.fn(table => {
      if (table === 'Staff')         return makeChain({ data: staffU, error: null })
      if (table === 'staff_unavail') return makeChain({ data: null, error: { message: 'DB error' } })
      return makeChain({ data: null, error: null })
    }),
  }
  jest.isolateModules(() => { require('../backend/staff-unavailability.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 4: staff found, renderList empty → covers lines 53-55
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } }) },
    from: jest.fn(table => {
      if (table === 'Staff')         return makeChain({ data: staffU, error: null })
      if (table === 'staff_unavail') return makeChain({ data: [],     error: null })
      return makeChain({ data: null, error: null })
    }),
  }
  jest.isolateModules(() => { require('../backend/staff-unavailability.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 5: full success with data — capture addBtn and delete handlers, then invoke
  const unavailRows = [{ id: 'u1', Date: '2025-08-01', Start: '09:00', End: '10:00' }]
  let unavailDeleteFn

  elem('unavailList').querySelectorAll = jest.fn(() => [{
    getAttribute:    jest.fn(() => 'u1'),
    addEventListener: jest.fn((evt, fn) => { if (evt === 'click') unavailDeleteFn = fn }),
  }])

  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } }) },
    from: jest.fn(table => {
      if (table === 'Staff')         return makeChain({ data: staffU,      error: null })
      if (table === 'staff_unavail') return makeChain({ data: unavailRows, error: null })
      return makeChain({ data: null, error: null })
    }),
  }
  jest.isolateModules(() => { require('../backend/staff-unavailability.js') })
  await new Promise(r => setTimeout(r, 30))

  // Invoke addBtn → addUnavailability + markClashingAppointments (with clashing appt)
  const addBtnFn = el['addBtn'].addEventListener.mock.calls.slice(-1)[0]?.[1]
  if (addBtnFn) {
    elem('inputDate').value  = '2025-08-01'
    elem('inputStart').value = '09:00'
    elem('inputEnd').value   = '10:00'
    let apptMarkCount = 0
    global.supabase = {
      from: jest.fn(table => {
        if (table === 'staff_unavail') return makeChain({ data: [], error: null })
        if (table === 'Appointments') {
          apptMarkCount++
          // First call: select clashing appts; second call: update to unavailable
          if (apptMarkCount === 1) return makeChain({ data: [{ id: 'apt1', appointment_time: '09:30:00' }], error: null })
          return makeChain({ data: null, error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    }
    await addBtnFn()
    await new Promise(r => setTimeout(r, 10))
  }

  // Invoke delete handler → deleteEntry + revertClashingAppointments (with clashing appt)
  if (unavailDeleteFn) {
    global.confirm = () => true
    const record = { id: 'u1', Date: '2025-08-01', Start: '09:00', End: '10:00' }
    let unavailCallCount = 0
    let revertApptCount  = 0
    global.supabase = {
      from: jest.fn(table => {
        if (table === 'staff_unavail') {
          unavailCallCount++
          if (unavailCallCount === 1) return makeChain({ data: record, error: null }) // fetch record
          if (unavailCallCount === 2) return makeChain({ error: null })               // delete record
          return makeChain({ data: [], error: null })                                  // renderList
        }
        if (table === 'Appointments') {
          revertApptCount++
          // First call: select unavailable appts; second call: update to waiting
          if (revertApptCount === 1) return makeChain({ data: [{ id: 'apt1', appointment_time: '09:30:00' }], error: null })
          return makeChain({ data: null, error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    }
    await unavailDeleteFn()
    await new Promise(r => setTimeout(r, 10))
  }

  // Invoke unavailability logout handler (covers logout body)
  const unavailLogH = el['logoutBtn'].addEventListener.mock.calls.slice(-1)[0]?.[1]
  if (unavailLogH) {
    global.supabase = { auth: { signOut: () => Promise.resolve() } }
    await unavailLogH()
  }

  global.supabase = null
  global.document.querySelectorAll = jest.fn(() => [])
})

// ─── Reset before each test ───────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks()
  global.supabase     = null
  global.window       = { location: { href: '' } }
  global.localStorage = { setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn(), getItem: jest.fn() }
  global.alert        = jest.fn()
  global.confirm      = jest.fn(() => true)
  mockDialog          = null

  dash.unavailRecords  = []
  dash.currentStaff    = null
  unavail.currentStaff = null

  Object.values(el).forEach(e => {
    e.textContent = ''
    e.innerHTML   = ''
    e.value       = ''
    e.onclick     = null
    e.querySelectorAll = jest.fn(() => [])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  staff-dashboard.js
// ═══════════════════════════════════════════════════════════════════════════════

describe('staff-dashboard › isUnavailable', () => {
  test('returns false when date does not match', () => {
    const apt     = { appointment_date: '2025-07-01', appointment_time: '09:00' }
    const records = [{ Date: '2025-07-02', Start: '08:00', End: '17:00' }]
    expect(dash.isUnavailable(apt, records)).toBe(false)
  })

  test('returns true when date matches and no start/end (full-day block)', () => {
    const apt     = { appointment_date: '2025-07-01', appointment_time: '09:00' }
    const records = [{ Date: '2025-07-01', Start: null, End: null }]
    expect(dash.isUnavailable(apt, records)).toBe(true)
  })

  test('returns true when time falls within start/end', () => {
    const apt     = { appointment_date: '2025-07-01', appointment_time: '10:30:00' }
    const records = [{ Date: '2025-07-01', Start: '09:00', End: '12:00' }]
    expect(dash.isUnavailable(apt, records)).toBe(true)
  })

  test('returns false when time is outside start/end', () => {
    const apt     = { appointment_date: '2025-07-01', appointment_time: '13:00:00' }
    const records = [{ Date: '2025-07-01', Start: '09:00', End: '12:00' }]
    expect(dash.isUnavailable(apt, records)).toBe(false)
  })

  test('returns false for empty records array', () => {
    const apt = { appointment_date: '2025-07-01', appointment_time: '09:00' }
    expect(dash.isUnavailable(apt, [])).toBe(false)
  })
})

describe('staff-dashboard › loadStaffDashboard', () => {
  test('redirects to /pages/index.html when session is null', async () => {
    global.supabase = { auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) } }
    await dash.loadStaffDashboard()
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('redirects to /pages/dashboard.html when Staff query fails', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: null, error: { message: 'err' } })),
    }
    await dash.loadStaffDashboard()
    expect(global.window.location.href).toBe('/pages/dashboard.html')
  })

  test('redirects to /pages/dashboard.html when staff row not found', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: null, error: null })),
    }
    await dash.loadStaffDashboard()
    expect(global.window.location.href).toBe('/pages/dashboard.html')
  })

  test('sets userEmail, localStorage, and renders welcome banner on success', async () => {
    const staffRow = { id: 's1', full_name: 'Dr. Smith', ClinicID: 'c1', email: 's@c.com' }
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } })) },
      from: jest.fn(table => {
        if (table === 'Staff')         return makeChain({ data: staffRow,             error: null })
        if (table === 'Appointments')  return makeChain({ data: [],                   error: null })
        if (table === 'staff_unavail') return makeChain({ data: [],                   error: null })
        if (table === 'Facilities')    return makeChain({ data: { Name: 'City Clinic' }, error: null })
        return makeChain({ data: null, error: null })
      }),
    }
    await dash.loadStaffDashboard()
    expect(el['userEmail'].textContent).toBe('s@c.com')
    expect(global.localStorage.setItem).toHaveBeenCalledWith('userRole', 'staff')
    expect(el['dashboardContent'].innerHTML).toContain('Dr')
  })

  test('renders today\'s appointments with correct action buttons', async () => {
    const today    = new Date().toISOString().split('T')[0]
    const staffRow = { id: 's1', full_name: 'Dr. Smith', ClinicID: 'c1', email: 's@c.com' }
    const appts    = [
      { id: 'a1', patient_name: 'Alice', appointment_date: today,
        appointment_time: '09:00:00', status: 'waiting', reason: 'Check', PatientID: 'p1' },
    ]
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } })) },
      from: jest.fn(table => {
        if (table === 'Staff')         return makeChain({ data: staffRow, error: null })
        if (table === 'Appointments')  return makeChain({ data: appts,    error: null })
        if (table === 'staff_unavail') return makeChain({ data: [],       error: null })
        if (table === 'Facilities')    return makeChain({ data: { Name: 'Clinic' }, error: null })
        if (table === 'patient_notes') return makeChain({ data: [],       error: null })
        return makeChain({ data: null, error: null })
      }),
    }
    await dash.loadStaffDashboard()
    expect(el['dashboardContent'].innerHTML).toContain('Alice')
    expect(el['dashboardContent'].innerHTML).toContain('Complete')
  })
})

describe('staff-dashboard › updateAppointmentStatus', () => {
  test('calls loadStaffDashboard after successful update', async () => {
    const staffRow = { id: 's1', full_name: 'Dr. Smith', ClinicID: 'c1', email: 's@c.com' }
    let callCount  = 0
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } })) },
      from: jest.fn(table => {
        callCount++
        if (callCount === 1)           return makeChain({ error: null })
        if (table === 'Staff')         return makeChain({ data: staffRow, error: null })
        if (table === 'Appointments')  return makeChain({ data: [],       error: null })
        if (table === 'staff_unavail') return makeChain({ data: [],       error: null })
        if (table === 'Facilities')    return makeChain({ data: { Name: 'Clinic' }, error: null })
        return makeChain({ data: null, error: null })
      }),
    }
    await dash.updateAppointmentStatus('a1', 'complete')
    expect(global.supabase.from).toHaveBeenCalledWith('Appointments')
  })

  test('shows error toast when update fails', async () => {
    global.supabase = { from: jest.fn(() => makeChain({ error: { message: 'Update failed' } })) }
    await dash.updateAppointmentStatus('a1', 'complete')
    expect(el['toast'].textContent).toContain('Failed')
  })
})

describe('staff-dashboard › formatDate', () => {
  test('returns empty string for null', () => {
    expect(dash.formatDate(null)).toBe('')
  })

  test('returns empty string for empty string', () => {
    expect(dash.formatDate('')).toBe('')
  })

  test('returns formatted date string for valid input', () => {
    const result = dash.formatDate('2025-07-15')
    expect(result).toContain('2025')
    expect(result).toContain('15')
  })
})

describe('staff-dashboard › formatTime', () => {
  test('returns empty string for null', () => {
    expect(dash.formatTime(null)).toBe('')
  })

  test('formats 09:00 as 9:00 AM', () => {
    expect(dash.formatTime('09:00')).toBe('9:00 AM')
  })

  test('formats 13:30 as 1:30 PM', () => {
    expect(dash.formatTime('13:30')).toBe('1:30 PM')
  })

  test('formats 00:00 as 12:00 AM', () => {
    expect(dash.formatTime('00:00')).toBe('12:00 AM')
  })
})

describe('staff-dashboard › showToast', () => {
  test('sets textContent and success class', () => {
    dash.showToast('Saved!')
    expect(el['toast'].textContent).toBe('Saved!')
    expect(el['toast'].className).toContain('success')
  })

  test('sets error class when isError is true', () => {
    dash.showToast('Oops', true)
    expect(el['toast'].className).toContain('error')
  })
})

describe('staff-dashboard › showPatientNotes', () => {
  test('shows error toast when notes query fails', async () => {
    global.supabase = { from: jest.fn(() => makeChain({ data: null, error: { message: 'Notes error' } })) }
    await dash.showPatientNotes('p1', 'a1', 'Alice')
    expect(el['toast'].textContent).toContain('Failed to load notes')
  })

  test('creates dialog with no-notes message when notes array is empty', async () => {
    global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
    await dash.showPatientNotes('p1', 'a1', 'Alice')
    expect(global.document.createElement).toHaveBeenCalledWith('dialog')
    expect(mockDialog.showModal).toHaveBeenCalled()
    expect(mockDialog.innerHTML).toContain('Alice')
    expect(mockDialog.innerHTML).toContain('No medical notes')
  })

  test('renders existing notes in the dialog', async () => {
    const notes = [{ note: 'Has fever', created_at: '2025-07-01T10:00:00Z' }]
    global.supabase = { from: jest.fn(() => makeChain({ data: notes, error: null })) }
    await dash.showPatientNotes('p1', 'a1', 'Bob')
    expect(mockDialog.innerHTML).toContain('Has fever')
  })

  test('shows toast and returns early when note text is empty', async () => {
    global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
    await dash.showPatientNotes('p1', 'a1', 'Alice')
    elem('newNoteInput').value = ''
    await elem('addNoteBtn').onclick()
    expect(el['toast'].textContent).toContain('enter a note')
  })

  test('inserts note and shows success toast', async () => {
    dash.currentStaff = { id: 'staff1', full_name: 'Dr. Smith' }
    let fromCount = 0
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) },
      from: jest.fn(() => {
        fromCount++
        if (fromCount === 1) return makeChain({ data: [], error: null })  // notes select
        return makeChain({ error: null })                                   // insert + reload
      }),
    }
    await dash.showPatientNotes('p1', 'a1', 'Alice')
    elem('newNoteInput').value = 'Patient has fever'
    await elem('addNoteBtn').onclick()
    expect(el['toast'].textContent).toContain('note added')
  })
})

describe('staff-dashboard › openRescheduleModal', () => {
  test('creates and shows a reschedule modal', () => {
    dash.openRescheduleModal('a1', 'Alice', '2025-07-01', '09:00')
    expect(global.document.createElement).toHaveBeenCalledWith('dialog')
    expect(mockDialog.showModal).toHaveBeenCalled()
    expect(mockDialog.innerHTML).toContain('Alice')
  })

  test('shows error when date or time is missing', async () => {
    dash.openRescheduleModal('a1', 'Alice', '2025-07-01', '09:00')
    elem('newDate').value = ''
    elem('newTime').value = ''
    await elem('confirmRescheduleBtn').onclick()
    expect(el['modalError'].textContent).toBe('Please select both date and time.')
  })

  test('shows error when time is outside 09:00–17:00', async () => {
    dash.openRescheduleModal('a1', 'Alice', '2025-07-01', '09:00')
    elem('newDate').value = '2025-08-01'
    elem('newTime').value = '08:00'
    await elem('confirmRescheduleBtn').onclick()
    expect(el['modalError'].textContent).toContain('09:00')
  })

  test('shows clash error when new slot is unavailable', async () => {
    dash.unavailRecords = [{ Date: '2025-08-01', Start: '10:00', End: '11:00' }]
    dash.openRescheduleModal('a1', 'Alice', '2025-07-01', '09:00')
    elem('newDate').value = '2025-08-01'
    elem('newTime').value = '10:00'
    await elem('confirmRescheduleBtn').onclick()
    expect(el['modalError'].textContent).toContain('unavailable')
  })

  test('closes modal and reloads on successful reschedule', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) },
      from: jest.fn(() => makeChain({ error: null })),
    }
    dash.openRescheduleModal('a1', 'Alice', '2025-07-01', '09:00')
    elem('newDate').value = '2025-08-01'
    elem('newTime').value = '10:00'
    await elem('confirmRescheduleBtn').onclick()
    expect(mockDialog.close).toHaveBeenCalled()
  })
})

describe('staff-dashboard › logout button', () => {
  test('signs out, removes userRole, and redirects to index', async () => {
    global.supabase = { auth: { signOut: jest.fn(() => Promise.resolve()) } }
    await dashLogoutHandler()
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('userRole')
    expect(global.supabase.auth.signOut).toHaveBeenCalled()
    expect(global.window.location.href).toBe('/pages/index.html')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  staff-unavailability.js
// ═══════════════════════════════════════════════════════════════════════════════

describe('staff-unavailability › formatDate', () => {
  test('returns empty string for null', () => {
    expect(unavail.formatDate(null)).toBe('')
  })

  test('returns empty string for empty string', () => {
    expect(unavail.formatDate('')).toBe('')
  })

  test('returns formatted date for valid input', () => {
    const result = unavail.formatDate('2025-08-15')
    expect(result).toContain('2025')
  })
})

describe('staff-unavailability › formatTime', () => {
  test('returns null for null input', () => {
    expect(unavail.formatTime(null)).toBeNull()
  })

  test('formats 09:00 as 9:00 AM', () => {
    expect(unavail.formatTime('09:00')).toBe('9:00 AM')
  })

  test('formats 13:30 as 1:30 PM', () => {
    expect(unavail.formatTime('13:30')).toBe('1:30 PM')
  })

  test('formats 00:00 as 12:00 AM', () => {
    expect(unavail.formatTime('00:00')).toBe('12:00 AM')
  })
})

describe('staff-unavailability › formatTimeRange', () => {
  test('returns "All day" when both start and end are null', () => {
    expect(unavail.formatTimeRange(null, null)).toBe('All day')
  })

  test('returns "All day" when both start and end are empty strings', () => {
    expect(unavail.formatTimeRange('', '')).toBe('All day')
  })

  test('returns formatted range for valid start and end', () => {
    const result = unavail.formatTimeRange('09:00', '12:00')
    expect(result).toContain('AM')
    expect(result).toContain('PM')
  })
})

describe('staff-unavailability › init', () => {
  test('redirects to /pages/index.html when session is null', async () => {
    global.supabase = { auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) } }
    await unavail.init()
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('redirects to /pages/staff-dashboard.html when staff not found', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: null, error: { message: 'err' } })),
    }
    await unavail.init()
    expect(global.window.location.href).toBe('/pages/staff-dashboard.html')
  })

  test('sets currentStaff, DOM fields, and calls renderList on success', async () => {
    const staffObj = { id: 'staff1', email: 's@c.com' }
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 's@c.com' } } } })) },
      from: jest.fn(table => {
        if (table === 'Staff')         return makeChain({ data: staffObj, error: null })
        if (table === 'staff_unavail') return makeChain({ data: [],       error: null })
        return makeChain({ data: null, error: null })
      }),
    }
    await unavail.init()
    expect(unavail.currentStaff).toEqual(staffObj)
    expect(el['unavailList'].innerHTML).toContain('No unavailable')
  })
})

describe('staff-unavailability › renderList', () => {
  test('shows error state when Supabase returns an error', async () => {
    unavail.currentStaff = { id: 'staff1' }
    global.supabase = { from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })) }
    await unavail.renderList()
    expect(el['unavailList'].innerHTML).toContain('Failed to load')
  })

  test('shows empty state when no records returned', async () => {
    unavail.currentStaff = { id: 'staff1' }
    global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
    await unavail.renderList()
    expect(el['unavailList'].innerHTML).toContain('No unavailable')
  })

  test('renders unavailability records with date and time', async () => {
    unavail.currentStaff = { id: 'staff1' }
    const rows = [{ id: 'u1', Date: '2025-08-01', Start: '09:00', End: '10:00' }]
    global.supabase = { from: jest.fn(() => makeChain({ data: rows, error: null })) }
    await unavail.renderList()
    expect(el['unavailList'].innerHTML).toContain('2025')
    expect(el['unavailList'].innerHTML).toContain('AM')
  })
})

describe('staff-unavailability › addUnavailability', () => {
  beforeEach(() => { unavail.currentStaff = { id: 'staff1' } })

  test('shows toast when date is not selected', async () => {
    el['inputDate'].value  = ''
    await unavail.addUnavailability()
    expect(el['toast'].textContent).toContain('Please select a date')
  })

  test('shows toast when only start time is provided', async () => {
    el['inputDate'].value  = '2025-08-01'
    el['inputStart'].value = '09:00'
    el['inputEnd'].value   = ''
    await unavail.addUnavailability()
    expect(el['toast'].textContent).toContain('both')
  })

  test('shows toast when start is not before end', async () => {
    el['inputDate'].value  = '2025-08-01'
    el['inputStart'].value = '10:00'
    el['inputEnd'].value   = '09:00'
    await unavail.addUnavailability()
    expect(el['toast'].textContent).toContain('before end')
  })

  test('shows toast when times are outside 08:00–17:00', async () => {
    el['inputDate'].value  = '2025-08-01'
    el['inputStart'].value = '07:00'
    el['inputEnd'].value   = '18:00'
    await unavail.addUnavailability()
    expect(el['toast'].textContent).toContain('08:00')
  })

  test('shows error toast when insert fails', async () => {
    el['inputDate'].value  = '2025-08-01'
    el['inputStart'].value = '09:00'
    el['inputEnd'].value   = '10:00'
    global.supabase = { from: jest.fn(() => makeChain({ error: { message: 'Insert failed' } })) }
    await unavail.addUnavailability()
    expect(el['toast'].textContent).toContain('Failed')
  })

  test('saves, marks clashing appointments, and refreshes list on success', async () => {
    el['inputDate'].value  = '2025-08-01'
    el['inputStart'].value = '09:00'
    el['inputEnd'].value   = '10:00'
    global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
    await unavail.addUnavailability()
    expect(el['toast'].textContent).toContain('saved')
    expect(el['inputDate'].value).toBe('')
  })
})

describe('staff-unavailability › markClashingAppointments', () => {
  test('returns early when no appointments are returned', async () => {
    unavail.currentStaff = { id: 'staff1' }
    global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
    await unavail.markClashingAppointments('2025-08-01', '09:00', '10:00')
    expect(global.supabase.from).toHaveBeenCalledTimes(1)
  })

  test('returns early on fetch error', async () => {
    unavail.currentStaff = { id: 'staff1' }
    global.supabase = { from: jest.fn(() => makeChain({ data: null, error: { message: 'err' } })) }
    await unavail.markClashingAppointments('2025-08-01', '09:00', '10:00')
    expect(global.supabase.from).toHaveBeenCalledTimes(1)
  })

  test('updates clashing appointments to unavailable', async () => {
    unavail.currentStaff = { id: 'staff1' }
    const apt = { id: 'a1', appointment_time: '09:30:00' }
    let firstCall = true
    global.supabase = {
      from: jest.fn(() => {
        if (firstCall) { firstCall = false; return makeChain({ data: [apt], error: null }) }
        return makeChain({ data: null, error: null })
      }),
    }
    await unavail.markClashingAppointments('2025-08-01', '09:00', '10:00')
    expect(global.supabase.from).toHaveBeenCalledTimes(2)
  })

  test('marks all appointments for a full-day block (no start/end)', async () => {
    unavail.currentStaff = { id: 'staff1' }
    const apt = { id: 'a1', appointment_time: '09:00:00' }
    let firstCall = true
    global.supabase = {
      from: jest.fn(() => {
        if (firstCall) { firstCall = false; return makeChain({ data: [apt], error: null }) }
        return makeChain({ data: null, error: null })
      }),
    }
    await unavail.markClashingAppointments('2025-08-01', null, null)
    expect(global.supabase.from).toHaveBeenCalledTimes(2)
  })
})

describe('staff-unavailability › revertClashingAppointments', () => {
  test('returns early when no appointments are returned', async () => {
    unavail.currentStaff = { id: 'staff1' }
    global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
    await unavail.revertClashingAppointments('2025-08-01', '09:00', '10:00')
    expect(global.supabase.from).toHaveBeenCalledTimes(1)
  })

  test('reverts clashing appointments to waiting', async () => {
    unavail.currentStaff = { id: 'staff1' }
    const apt = { id: 'a1', appointment_time: '09:30:00' }
    let firstCall = true
    global.supabase = {
      from: jest.fn(() => {
        if (firstCall) { firstCall = false; return makeChain({ data: [apt], error: null }) }
        return makeChain({ data: null, error: null })
      }),
    }
    await unavail.revertClashingAppointments('2025-08-01', '09:00', '10:00')
    expect(global.supabase.from).toHaveBeenCalledTimes(2)
  })
})

describe('staff-unavailability › deleteEntry', () => {
  test('does nothing when confirm is cancelled', async () => {
    global.confirm  = jest.fn(() => false)
    global.supabase = { from: jest.fn() }
    await unavail.deleteEntry('u1')
    expect(global.supabase.from).not.toHaveBeenCalled()
  })

  test('shows error toast when record fetch fails', async () => {
    unavail.currentStaff = { id: 'staff1' }
    global.supabase = { from: jest.fn(() => makeChain({ data: null, error: { message: 'Not found' } })) }
    await unavail.deleteEntry('u1')
    expect(el['toast'].textContent).toContain('Record not found')
  })

  test('shows error toast when delete fails', async () => {
    unavail.currentStaff = { id: 'staff1' }
    const record  = { id: 'u1', Date: '2025-08-01', Start: '09:00', End: '10:00' }
    let callCount = 0
    global.supabase = {
      from: jest.fn(() => {
        callCount++
        if (callCount === 1) return makeChain({ data: record, error: null })
        return makeChain({ error: { message: 'Delete failed' } })
      }),
    }
    await unavail.deleteEntry('u1')
    expect(el['toast'].textContent).toContain('Failed to delete')
  })

  test('deletes record, reverts appointments, and shows success toast', async () => {
    unavail.currentStaff = { id: 'staff1' }
    const record  = { id: 'u1', Date: '2025-08-01', Start: '09:00', End: '10:00' }
    let callCount = 0
    global.supabase = {
      from: jest.fn(() => {
        callCount++
        if (callCount === 1) return makeChain({ data: record, error: null }) // fetch
        if (callCount === 2) return makeChain({ error: null })                // delete
        return makeChain({ data: [], error: null })                           // revert + renderList
      }),
    }
    await unavail.deleteEntry('u1')
    expect(el['toast'].textContent).toContain('Removed')
  })
})

describe('staff-unavailability › logout button', () => {
  test('signs out, removes userRole, and redirects to index', async () => {
    global.supabase = { auth: { signOut: jest.fn(() => Promise.resolve()) } }
    await unavailLogoutHandler()
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('userRole')
    expect(global.supabase.auth.signOut).toHaveBeenCalled()
    expect(global.window.location.href).toBe('/pages/index.html')
  })
})
