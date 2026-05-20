'use strict'

/**
 * __tests__/Receptionist.test.js
 * Tests for:
 *   backend/receptionist-dashboard.js   — loadReceptionistDashboard, logout
 *   backend/receptionist-appointments.js — formatDate, formatTime, statusClass,
 *                                          renderAppointments, getCurrentReceptionist,
 *                                          loadAppointments, searchAppointments,
 *                                          checkInAppointment, init
 *
 * Two-layer strategy:
 *   1. jest.mock + jest.isolateModules (beforeAll) — loads files through Jest's
 *      module system so Istanbul instruments them for coverage.
 *   2. eval-wrapper — strips the import line, exposes all function declarations
 *      individually so each can be called and asserted against in isolation.
 */

// ─── Supabase mock (needed for the jest.isolateModules require path) ──────────
// babel-jest hoists jest.mock to the very top before any other code.
// The getter reads global.supabase at call time so each require can use a
// different mock without re-registering.
jest.mock('../backend/supabase.js', () => {
  const m = {}
  Object.defineProperty(m, 'supabase', { get: () => global.supabase, enumerable: true })
  return m
})

const fs   = require('fs')
const path = require('path')

// ─── Supabase chain helper ───────────────────────────────────────────────────
function makeChain(resolvedValue) {
  const chain = { then: (resolve) => Promise.resolve(resolvedValue).then(resolve) }
  ;['select', 'eq', 'update', 'delete', 'insert', 'order', 'maybeSingle'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

// ─── Persistent DOM element store ────────────────────────────────────────────
// Both modules call document.getElementById at the top level on load.
// We create each element once so the captured closure references in both IIFEs
// always point to the same objects (mirrors how a real browser DOM works).
const el = {}
function elem(id) {
  if (!el[id]) el[id] = {
    textContent: '', innerHTML: '', value: '', disabled: false,
    addEventListener: jest.fn(),
    getAttribute:     jest.fn(),
  }
  return el[id]
}

// Install global mocks BEFORE the eval calls below so that top-level
// document.getElementById calls inside each module work on load.
global.document     = { getElementById: jest.fn(id => elem(id)), querySelectorAll: jest.fn(() => []) }
global.window       = { location: { href: '' } }
global.localStorage = { setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn(), getItem: jest.fn() }
global.alert        = jest.fn()
global.supabase     = null

// ─── Source transformation ────────────────────────────────────────────────────
// • Strips `import … from '…';` lines (ES module syntax unsupported in eval).
// • Replaces bare `supabase.` with `global.supabase.` so async functions look up
//   the current test mock at call time, not at IIFE evaluation time.
function transform(filename) {
  return fs.readFileSync(path.join(__dirname, '../backend', filename), 'utf8')
    .replace(/^import\s.*?;?\s*$/gm, '')
    .replace(/\bsupabase\b(?=\.)/g, 'global.supabase')
}

// ── receptionist-dashboard.js ─────────────────────────────────────────────────
const dashCode = transform('receptionist-dashboard.js')
  .replace(/^loadReceptionistDashboard\(\);?\s*$/m, '')   // suppress auto-call

const dash = eval(`(function () {
  ${dashCode}
  return { loadReceptionistDashboard }
})()`)

// Capture the logout handler registered on logoutBtn during the dashboard IIFE.
const dashLogout = el['logoutBtn'].addEventListener.mock.calls[0]?.[1]

// ── receptionist-appointments.js ──────────────────────────────────────────────
const apptCode = transform('receptionist-appointments.js')
  .replace(/^init\(\);?\s*$/m, '')    // suppress auto-call

const appt = eval(`(function () {
  ${apptCode}
  return {
    getCurrentReceptionist, formatDate, formatTime, statusClass,
    renderAppointments, loadAppointments, searchAppointments, checkInAppointment, init,
    get allAppointments()      { return allAppointments },
    set allAppointments(v)     { allAppointments = v },
    get receptionistClinicId() { return receptionistClinicId },
    set receptionistClinicId(v){ receptionistClinicId = v },
  }
})()`)

// Capture handlers registered during the appointments IIFE.
// logoutBtn gets two registrations (one from each file); appointments is index 1.
const apptLogout     = el['logoutBtn'].addEventListener.mock.calls[1]?.[1]

// ─── Coverage: require both files through Jest's module system ───────────────
// jest.isolateModules loads a fresh copy of the file each time, allowing
// different mock states to cover different code branches.
// Istanbul instruments files loaded via require() — not via eval — so this is
// required in addition to the eval wrapper above.
beforeAll(async () => {
  // ── receptionist-dashboard.js ─────────────────────────────────────────────

  // Path 1: no session → early-return branch
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  }
  jest.isolateModules(() => { require('../backend/receptionist-dashboard.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 2: session + DB error on Receptionist query
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } }) },
    from: () => makeChain({ data: null, error: { message: 'DB error' } }),
  }
  jest.isolateModules(() => { require('../backend/receptionist-dashboard.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 3: full success
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } }) },
    from: () => makeChain({ data: { clinicid: '1', clinicname: 'City Clinic' }, error: null }),
  }
  jest.isolateModules(() => { require('../backend/receptionist-dashboard.js') })
  await new Promise(r => setTimeout(r, 30))

  // Invoke the dashboard logout handler body to cover lines 39-41
  const dashLogoutHandler = el['logoutBtn'].addEventListener.mock.calls.slice(-1)[0]?.[1]
  if (dashLogoutHandler) {
    global.supabase = { auth: { signOut: () => Promise.resolve() } }
    await dashLogoutHandler()
  }

  // ── receptionist-appointments.js ─────────────────────────────────────────

  // Path 1: no session → getCurrentReceptionist null branch + init early return
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  }
  jest.isolateModules(() => { require('../backend/receptionist-appointments.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 2: session + error on Receptionist query
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } }) },
    from: () => makeChain({ data: null, error: { message: 'DB error' } }),
  }
  jest.isolateModules(() => { require('../backend/receptionist-appointments.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 3: getCurrentReceptionist success + loadAppointments DB error (lines 159-166)
  const rec = { clinicid: '42', clinicname: 'City Clinic', email: 'r@c.com' }
  let fromIdx3 = 0
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } }) },
    from: jest.fn(() => {
      fromIdx3++
      if (fromIdx3 === 1) return makeChain({ data: rec, error: null })
      return makeChain({ data: null, error: { message: 'DB error' } })
    }),
  }
  jest.isolateModules(() => { require('../backend/receptionist-appointments.js') })
  await new Promise(r => setTimeout(r, 30))

  // Path 4: full success — covers getCurrentReceptionist, loadAppointments,
  // renderAppointments (all status branches), formatDate, formatTime, statusClass
  const appts = [
    { id: '1', patient_name: 'Alice', patient_email: 'a@test.com',
      appointment_date: '2025-07-01', appointment_time: '09:00:00', reason: 'Flu', status: 'scheduled' },
    { id: '2', patient_name: 'Bob',   patient_email: 'b@test.com',
      appointment_date: null, appointment_time: null, reason: null, status: 'checked_in' },
    { id: '3', patient_name: null,    patient_email: null,
      appointment_date: null, appointment_time: null, reason: null, status: 'cancelled' },
    { id: '4', patient_name: 'Dave',  patient_email: 'd@test.com',
      appointment_date: null, appointment_time: null, reason: null, status: 'complete' },
  ]
  let fromIdx4 = 0
  global.supabase = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } }) },
    from: jest.fn(() => {
      fromIdx4++
      if (fromIdx4 === 1) return makeChain({ data: rec,   error: null })
      return                     makeChain({ data: appts, error: null })
    }),
  }

  // Intercept querySelectorAll so renderAppointments registers a real click handler
  let checkInClickFn
  global.document.querySelectorAll = jest.fn(() => [{
    getAttribute: jest.fn(() => '1'),
    addEventListener: jest.fn((evt, fn) => { checkInClickFn = fn }),
  }])

  jest.isolateModules(() => { require('../backend/receptionist-appointments.js') })
  await new Promise(r => setTimeout(r, 30))

  // Trigger searchAppointments via the 'input' event handler registered in path 4
  const searchFn = el['searchInput'].addEventListener.mock.calls.slice(-1)[0]?.[1]
  if (searchFn) {
    el['searchInput'].value = 'alice'
    searchFn()                            // filter branch
    el['searchInput'].value = 'zzznomatch'
    searchFn()                            // no-match → empty-state branch
    el['searchInput'].value = ''
    searchFn()                            // empty-term → render-all branch
  }

  // Trigger checkInAppointment success path
  if (checkInClickFn) {
    await checkInClickFn()
    await new Promise(r => setTimeout(r, 30))
  }

  // Trigger checkInAppointment error path (lines 206-207)
  if (checkInClickFn) {
    global.supabase = { from: jest.fn(() => makeChain({ error: { message: 'Update failed' } })) }
    await checkInClickFn()
  }

  // Invoke the appointments logout handler body to cover lines 214-216
  const apptLogoutHandler = el['logoutBtn'].addEventListener.mock.calls.slice(-1)[0]?.[1]
  if (apptLogoutHandler) {
    global.supabase = { auth: { signOut: () => Promise.resolve() } }
    await apptLogoutHandler()
  }

  // Reset so individual tests start from a clean slate
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

  // Reset module-level state exposed via getters/setters
  appt.allAppointments    = []
  appt.receptionistClinicId = null

  // Reset DOM element content so tests start clean
  Object.values(el).forEach(e => { e.textContent = ''; e.innerHTML = ''; e.value = '' })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  receptionist-dashboard.js
// ═══════════════════════════════════════════════════════════════════════════════

describe('receptionist-dashboard › loadReceptionistDashboard', () => {
  test('redirects to /pages/index.html when session is null', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) },
    }
    await dash.loadReceptionistDashboard()
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('sets userEmail textContent from session email', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 'rec@clinic.com' } } } })) },
      from: jest.fn(() => makeChain({ data: { clinicid: '42', clinicname: 'City Clinic' }, error: null })),
    }
    await dash.loadReceptionistDashboard()
    expect(el['userEmail'].textContent).toBe('rec@clinic.com')
  })

  test('removes userRole and redirects when Supabase returns an error', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })),
    }
    await dash.loadReceptionistDashboard()
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('userRole')
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('redirects when receptionist row is not found', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: null, error: null })),
    }
    await dash.loadReceptionistDashboard()
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('sets localStorage and updates clinic name on success', async () => {
    const receptionist = { clinicid: '99', clinicname: 'Metro Clinic' }
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: receptionist, error: null })),
    }
    await dash.loadReceptionistDashboard()
    expect(global.localStorage.setItem).toHaveBeenCalledWith('userRole', 'receptionist')
    expect(global.localStorage.setItem).toHaveBeenCalledWith('clinicid', '99')
    expect(global.localStorage.setItem).toHaveBeenCalledWith('clinicname', 'Metro Clinic')
    expect(el['clinicName'].textContent).toBe('Working at Metro Clinic')
  })

  test('shows "Working at your clinic" when clinicname is null', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: { clinicid: '1', clinicname: null }, error: null })),
    }
    await dash.loadReceptionistDashboard()
    expect(el['clinicName'].textContent).toBe('Working at your clinic')
  })
})

describe('receptionist-dashboard › logout button', () => {
  test('signs out, clears localStorage, and redirects to index', async () => {
    global.supabase = { auth: { signOut: jest.fn(() => Promise.resolve()) } }
    await dashLogout()
    expect(global.supabase.auth.signOut).toHaveBeenCalled()
    expect(global.localStorage.clear).toHaveBeenCalled()
    expect(global.window.location.href).toBe('/pages/index.html')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  receptionist-appointments.js — pure utility functions
// ═══════════════════════════════════════════════════════════════════════════════

describe('receptionist-appointments › formatDate', () => {
  test('returns em-dash for null', () => {
    expect(appt.formatDate(null)).toBe('—')
  })

  test('returns em-dash for undefined', () => {
    expect(appt.formatDate(undefined)).toBe('—')
  })

  test('returns em-dash for empty string', () => {
    expect(appt.formatDate('')).toBe('—')
  })

  test('formats a valid date string to include year and day', () => {
    const result = appt.formatDate('2025-06-15')
    expect(result).toContain('2025')
    expect(result).toContain('15')
  })

  test('returns a non-empty string for a valid date', () => {
    const result = appt.formatDate('2025-01-01')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toBe('—')
  })
})

describe('receptionist-appointments › formatTime', () => {
  test('returns em-dash for null', () => {
    expect(appt.formatTime(null)).toBe('—')
  })

  test('returns em-dash for empty string', () => {
    expect(appt.formatTime('')).toBe('—')
  })

  test('slices HH:MM from a full HH:MM:SS string', () => {
    expect(appt.formatTime('09:30:00')).toBe('09:30')
  })

  test('handles a string that is already 5 characters', () => {
    expect(appt.formatTime('14:00')).toBe('14:00')
  })

  test('handles midnight correctly', () => {
    expect(appt.formatTime('00:00:00')).toBe('00:00')
  })
})

describe('receptionist-appointments › statusClass', () => {
  test('checked_in → pill-approved', () => {
    expect(appt.statusClass('checked_in')).toBe('pill-approved')
  })

  test('cancelled → pill-cancelled', () => {
    expect(appt.statusClass('cancelled')).toBe('pill-cancelled')
  })

  test('completed → pill-completed', () => {
    expect(appt.statusClass('completed')).toBe('pill-completed')
  })

  test('waiting → pill-waiting', () => {
    expect(appt.statusClass('waiting')).toBe('pill-waiting')
  })

  test('unknown status → pill-scheduled', () => {
    expect(appt.statusClass('scheduled')).toBe('pill-scheduled')
    expect(appt.statusClass('anything_else')).toBe('pill-scheduled')
  })

  test('null/undefined → pill-scheduled', () => {
    expect(appt.statusClass(null)).toBe('pill-scheduled')
    expect(appt.statusClass(undefined)).toBe('pill-scheduled')
  })

  test('uppercased status is normalised before matching', () => {
    expect(appt.statusClass('WAITING')).toBe('pill-waiting')
    expect(appt.statusClass('CANCELLED')).toBe('pill-cancelled')
  })
})

// ─── renderAppointments ───────────────────────────────────────────────────────

describe('receptionist-appointments › renderAppointments', () => {
  test('shows empty-state row when appointments is null', () => {
    appt.renderAppointments(null)
    expect(el['appointmentsBody'].innerHTML).toContain('No appointments found')
  })

  test('shows empty-state row when appointments is an empty array', () => {
    appt.renderAppointments([])
    expect(el['appointmentsBody'].innerHTML).toContain('No appointments found')
  })

  test('renders patient name, email, time, and reason in table rows', () => {
    appt.renderAppointments([
      { id: '1', patient_name: 'Jane Doe', patient_email: 'jane@test.com',
        appointment_date: '2025-07-01', appointment_time: '10:00:00',
        reason: 'Checkup', status: 'scheduled' },
    ])
    expect(el['appointmentsBody'].innerHTML).toContain('Jane Doe')
    expect(el['appointmentsBody'].innerHTML).toContain('jane@test.com')
    expect(el['appointmentsBody'].innerHTML).toContain('10:00')
    expect(el['appointmentsBody'].innerHTML).toContain('Checkup')
  })

  test('renders em-dash when patient_name and email are null', () => {
    appt.renderAppointments([
      { id: '2', patient_name: null, patient_email: null,
        appointment_date: null, appointment_time: null, reason: null, status: 'scheduled' },
    ])
    expect(el['appointmentsBody'].innerHTML).toContain('—')
  })

  test('renders a Cancelled pill for "cancelled" status', () => {
    appt.renderAppointments([
      { id: '3', patient_name: 'A', patient_email: '', appointment_date: null,
        appointment_time: null, reason: '', status: 'cancelled' },
    ])
    expect(el['appointmentsBody'].innerHTML).toContain('Cancelled')
    expect(el['appointmentsBody'].innerHTML).not.toContain('data-checkin-id')
  })

  test('renders a Cancelled pill for "canceled" (alternate spelling)', () => {
    appt.renderAppointments([
      { id: '4', patient_name: 'B', patient_email: '', appointment_date: null,
        appointment_time: null, reason: '', status: 'canceled' },
    ])
    expect(el['appointmentsBody'].innerHTML).toContain('Cancelled')
  })

  test('renders a Complete pill for "complete" status', () => {
    appt.renderAppointments([
      { id: '5', patient_name: 'C', patient_email: '', appointment_date: null,
        appointment_time: null, reason: '', status: 'complete' },
    ])
    expect(el['appointmentsBody'].innerHTML).toContain('Complete')
    expect(el['appointmentsBody'].innerHTML).not.toContain('data-checkin-id')
  })

  test('renders an enabled Check-in button for scheduled appointments', () => {
    appt.renderAppointments([
      { id: '6', patient_name: 'D', patient_email: '', appointment_date: null,
        appointment_time: null, reason: '', status: 'scheduled' },
    ])
    expect(el['appointmentsBody'].innerHTML).toContain('Check in')
    expect(el['appointmentsBody'].innerHTML).toContain('data-checkin-id="6"')
  })

  test('renders a disabled "Checked in" button for checked_in appointments', () => {
    appt.renderAppointments([
      { id: '7', patient_name: 'E', patient_email: '', appointment_date: null,
        appointment_time: null, reason: '', status: 'checked_in' },
    ])
    expect(el['appointmentsBody'].innerHTML).toContain('Checked in')
    expect(el['appointmentsBody'].innerHTML).toContain('disabled')
  })

  test('attaches click listener to each [data-checkin-id] button', () => {
    const mockBtn = { getAttribute: jest.fn(() => '10'), addEventListener: jest.fn() }
    global.document.querySelectorAll = jest.fn(() => [mockBtn])

    appt.renderAppointments([
      { id: '10', patient_name: 'F', patient_email: '', appointment_date: null,
        appointment_time: null, reason: '', status: 'scheduled' },
    ])
    expect(global.document.querySelectorAll).toHaveBeenCalledWith('[data-checkin-id]')
    expect(mockBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
  })

  test('click on check-in button calls checkInAppointment with appointment id', async () => {
    let clickFn
    const mockBtn = {
      getAttribute: jest.fn(() => '11'),
      addEventListener: jest.fn((evt, fn) => { clickFn = fn }),
    }
    global.document.querySelectorAll = jest.fn(() => [mockBtn])
    global.supabase = {
      from: jest.fn(() => makeChain({ error: null })),
    }
    appt.receptionistClinicId = '42'

    appt.renderAppointments([
      { id: '11', patient_name: 'G', patient_email: '', appointment_date: null,
        appointment_time: null, reason: '', status: 'scheduled' },
    ])

    await clickFn()
    expect(global.supabase.from).toHaveBeenCalledWith('Appointments')
  })
})

// ─── getCurrentReceptionist ───────────────────────────────────────────────────

describe('receptionist-appointments › getCurrentReceptionist', () => {
  test('returns null and redirects when session is null', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) },
    }
    const result = await appt.getCurrentReceptionist()
    expect(result).toBeNull()
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('alerts and redirects when receptionist row is not found', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 'x@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: null, error: null })),
    }
    const result = await appt.getCurrentReceptionist()
    expect(result).toBeNull()
    expect(global.alert).toHaveBeenCalled()
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('alerts and redirects when Supabase returns an error', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 'x@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })),
    }
    const result = await appt.getCurrentReceptionist()
    expect(result).toBeNull()
    expect(global.alert).toHaveBeenCalled()
  })

  test('sets receptionistClinicId and localStorage on success', async () => {
    const rec = { clinicid: '42', clinicname: 'Metro Clinic', email: 'r@c.com' }
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: rec, error: null })),
    }
    const result = await appt.getCurrentReceptionist()
    expect(result).toEqual(rec)
    expect(appt.receptionistClinicId).toBe('42')
    expect(global.localStorage.setItem).toHaveBeenCalledWith('clinicid', '42')
    expect(global.localStorage.setItem).toHaveBeenCalledWith('clinicname', 'Metro Clinic')
  })

  test('updates userEmail and clinicName DOM elements on success', async () => {
    const rec = { clinicid: '42', clinicname: 'Metro Clinic', email: 'r@c.com' }
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } })) },
      from: jest.fn(() => makeChain({ data: rec, error: null })),
    }
    await appt.getCurrentReceptionist()
    expect(el['userEmail'].textContent).toBe('r@c.com')
    expect(el['clinicName'].textContent).toContain('Metro Clinic')
  })
})

// ─── loadAppointments ─────────────────────────────────────────────────────────

describe('receptionist-appointments › loadAppointments', () => {
  test('renders appointments rows after a successful fetch', async () => {
    const rows = [
      { id: '1', patient_name: 'Alice', patient_email: 'a@test.com',
        appointment_date: '2025-07-01', appointment_time: '09:00:00',
        reason: 'Flu', status: 'scheduled' },
    ]
    global.supabase = { from: jest.fn(() => makeChain({ data: rows, error: null })) }
    appt.receptionistClinicId = '42'

    await appt.loadAppointments()

    expect(el['appointmentsBody'].innerHTML).toContain('Alice')
    expect(appt.allAppointments).toHaveLength(1)
  })

  test('shows error message when Supabase returns an error', async () => {
    global.supabase = {
      from: jest.fn(() => makeChain({ data: null, error: { message: 'Connection failed' } })),
    }
    appt.receptionistClinicId = '42'

    await appt.loadAppointments()

    expect(el['appointmentsBody'].innerHTML).toContain('Failed to load')
    expect(el['appointmentsBody'].innerHTML).toContain('Connection failed')
  })

  test('sets allAppointments to [] when data is null', async () => {
    global.supabase = { from: jest.fn(() => makeChain({ data: null, error: null })) }
    appt.receptionistClinicId = '42'

    await appt.loadAppointments()

    expect(appt.allAppointments).toEqual([])
  })
})

// ─── searchAppointments ───────────────────────────────────────────────────────

describe('receptionist-appointments › searchAppointments', () => {
  const sampleData = [
    { id: '1', patient_name: 'Alice Smith', patient_email: 'alice@test.com',
      reason: 'Flu', status: 'scheduled',
      appointment_date: '2025-07-01', appointment_time: '09:00:00' },
    { id: '2', patient_name: 'Bob Jones', patient_email: 'bob@test.com',
      reason: 'Checkup', status: 'scheduled',
      appointment_date: '2025-07-02', appointment_time: '10:00:00' },
  ]

  beforeEach(() => {
    appt.allAppointments = sampleData
    global.document.querySelectorAll = jest.fn(() => [])
  })

  test('renders all appointments when search input is empty', () => {
    el['searchInput'].value = ''
    appt.searchAppointments()
    expect(el['appointmentsBody'].innerHTML).toContain('Alice Smith')
    expect(el['appointmentsBody'].innerHTML).toContain('Bob Jones')
  })

  test('filters to matching appointments by patient name', () => {
    el['searchInput'].value = 'alice'
    appt.searchAppointments()
    expect(el['appointmentsBody'].innerHTML).toContain('Alice Smith')
    expect(el['appointmentsBody'].innerHTML).not.toContain('Bob Jones')
  })

  test('filters to matching appointments by reason', () => {
    el['searchInput'].value = 'checkup'
    appt.searchAppointments()
    expect(el['appointmentsBody'].innerHTML).not.toContain('Alice Smith')
    expect(el['appointmentsBody'].innerHTML).toContain('Bob Jones')
  })

  test('filters by email', () => {
    el['searchInput'].value = 'bob@test'
    appt.searchAppointments()
    expect(el['appointmentsBody'].innerHTML).toContain('Bob Jones')
    expect(el['appointmentsBody'].innerHTML).not.toContain('Alice Smith')
  })

  test('shows empty-state when no appointments match the search term', () => {
    el['searchInput'].value = 'zzznomatch'
    appt.searchAppointments()
    expect(el['appointmentsBody'].innerHTML).toContain('No appointments found')
  })

  test('search is case-insensitive', () => {
    el['searchInput'].value = 'ALICE'
    appt.searchAppointments()
    expect(el['appointmentsBody'].innerHTML).toContain('Alice Smith')
  })
})

// ─── checkInAppointment ───────────────────────────────────────────────────────

describe('receptionist-appointments › checkInAppointment', () => {
  test('updates appointment status and reloads appointments on success', async () => {
    let callCount = 0
    global.supabase = {
      from: jest.fn(() => {
        callCount++
        if (callCount === 1) return makeChain({ error: null })          // update
        return makeChain({ data: [], error: null })                      // loadAppointments
      }),
    }
    appt.receptionistClinicId = '42'

    await appt.checkInAppointment('appt-99')

    expect(global.supabase.from).toHaveBeenCalledWith('Appointments')
    expect(global.supabase.from).toHaveBeenCalledTimes(2)
  })

  test('alerts with error message and does not reload when update fails', async () => {
    global.supabase = {
      from: jest.fn(() => makeChain({ error: { message: 'Update failed' } })),
    }
    await appt.checkInAppointment('appt-99')
    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Update failed'))
    expect(global.supabase.from).toHaveBeenCalledTimes(1)
  })
})

// ─── init ─────────────────────────────────────────────────────────────────────

describe('receptionist-appointments › init', () => {
  test('does not call loadAppointments when getCurrentReceptionist returns null', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) },
      from: jest.fn(),
    }
    await appt.init()
    expect(global.supabase.from).not.toHaveBeenCalled()
  })

  test('calls loadAppointments when getCurrentReceptionist succeeds', async () => {
    const rec = { clinicid: '42', clinicname: 'City Clinic', email: 'r@c.com' }
    let callCount = 0
    global.supabase = {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { email: 'r@c.com' } } } })) },
      from: jest.fn(() => {
        callCount++
        if (callCount === 1) return makeChain({ data: rec, error: null })  // getCurrentReceptionist
        return makeChain({ data: [], error: null })                          // loadAppointments
      }),
    }
    await appt.init()
    expect(global.supabase.from).toHaveBeenCalledTimes(2)
  })
})

// ─── appointments logout handler ──────────────────────────────────────────────

describe('receptionist-appointments › logout button', () => {
  test('signs out, clears localStorage, and redirects to index', async () => {
    global.supabase = { auth: { signOut: jest.fn(() => Promise.resolve()) } }
    await apptLogout()
    expect(global.supabase.auth.signOut).toHaveBeenCalled()
    expect(global.localStorage.clear).toHaveBeenCalled()
    expect(global.window.location.href).toBe('/pages/index.html')
  })
})
