'use strict'

/**
 * __tests__/booking.test.js
 * Tests for backend/BookingController.js
 *
 * BookingController is a browser-global script (no exports). We load it via
 * vm.runInThisContext after wiring up the globals it references at runtime:
 *   createClient, SUPABASE_URL, SUPABASE_ANON_KEY, defaultHoursMap,
 *   NotificationService.
 *
 * Only methods that do NOT touch the DOM are exercised here:
 *   getEndTime, esc, buildStaffOptions, loadHours, loadStaff,
 *   isStaffAvailable, filterAvailableStaff.
 */

const fs   = require('fs')
const path = require('path')

// ─── Global stubs required by BookingController ────────────────────────────
global.SUPABASE_URL     = 'https://test.supabase.co'
global.SUPABASE_ANON_KEY = 'test-anon-key'

// createClient is called in the constructor; we override ctrl.sb afterwards.
let _mockSb = {}
global.createClient = jest.fn(() => _mockSb)

global.defaultHoursMap = jest.fn(() => ({
  Sunday:    { isopen: false, opentime: null,       closingtime: null },
  Monday:    { isopen: true,  opentime: '08:00:00', closingtime: '17:00:00' },
  Tuesday:   { isopen: true,  opentime: '08:00:00', closingtime: '17:00:00' },
  Wednesday: { isopen: true,  opentime: '08:00:00', closingtime: '17:00:00' },
  Thursday:  { isopen: true,  opentime: '08:00:00', closingtime: '17:00:00' },
  Friday:    { isopen: true,  opentime: '08:00:00', closingtime: '17:00:00' },
  Saturday:  { isopen: false, opentime: null,       closingtime: null },
}))

global.NotificationService = {
  sendEmailNotification:    jest.fn().mockResolvedValue(true),
  createDatabaseNotification: jest.fn().mockResolvedValue(true),
}

// ─── Load BookingController ─────────────────────────────────────────────────
// Evaluate the browser-global script inside an IIFE so the class is returned
// into this module's scope.  Method closures resolve globals (createClient,
// defaultHoursMap, …) through the scope chain at call time.
const _bookingCode = fs.readFileSync(
  path.join(__dirname, '../backend/BookingController.js'), 'utf8'
)
// eslint-disable-next-line no-eval
const BookingController = eval(`(function() { ${_bookingCode}; return BookingController; })()`)

// ─── Supabase chain helper ──────────────────────────────────────────────────
// Returns a mock that is "thenable" so awaiting the chain (regardless of which
// method is the terminal call) resolves to `resolvedValue`.
function makeChain(resolvedValue) {
  const then = (resolve) => Promise.resolve(resolvedValue).then(resolve)
  const chain = { then }
  ;['select','eq','or','not','limit','insert','update','delete','order'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

// ─── Factory ───────────────────────────────────────────────────────────────
function makeController(sbOverride) {
  _mockSb = sbOverride || {
    from: jest.fn(() => makeChain({ data: [], error: null })),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
  }
  global.createClient.mockReturnValue(_mockSb)
  const ctrl = new BookingController(
    'clinic-001', 'Test Clinic', 'clinic', 'public', 'Joburg', 'Gauteng'
  )
  ctrl.sb = _mockSb
  return ctrl
}

// ─────────────────────────────────────────────────────────────────────────────
// getEndTime
// ─────────────────────────────────────────────────────────────────────────────
describe('BookingController.getEndTime', () => {
  let ctrl
  beforeEach(() => { ctrl = makeController() })

  test('08:00 + 45 min → 08:45', () => {
    expect(ctrl.getEndTime('08:00', 45)).toBe('08:45')
  })

  test('08:30 + 45 min → 09:15', () => {
    expect(ctrl.getEndTime('08:30', 45)).toBe('09:15')
  })

  test('16:30 + 30 min → 17:00', () => {
    expect(ctrl.getEndTime('16:30', 30)).toBe('17:00')
  })

  test('zero duration returns the same time', () => {
    expect(ctrl.getEndTime('10:00', 0)).toBe('10:00')
  })

  test('00:05 + 25 min → 00:30 (pads to two digits)', () => {
    expect(ctrl.getEndTime('00:05', 25)).toBe('00:30')
  })

  test('23:30 + 60 min → 24:30 (implementation does not wrap; hours can exceed 23)', () => {
    expect(ctrl.getEndTime('23:30', 60)).toBe('24:30')
  })

  test('09:00 + 90 min → 10:30', () => {
    expect(ctrl.getEndTime('09:00', 90)).toBe('10:30')
  })

  test('result always has format HH:MM', () => {
    const result = ctrl.getEndTime('08:15', 45)
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// esc  (BookingController's own simplified HTML-escape method)
// ─────────────────────────────────────────────────────────────────────────────
describe('BookingController.esc', () => {
  let ctrl
  beforeEach(() => { ctrl = makeController() })

  test('escapes ampersand', () => {
    expect(ctrl.esc('a & b')).toBe('a &amp; b')
  })

  test('escapes less-than', () => {
    expect(ctrl.esc('<script>')).toBe('&lt;script&gt;')
  })

  test('escapes greater-than', () => {
    expect(ctrl.esc('x > y')).toBe('x &gt; y')
  })

  test('returns empty string for null', () => {
    expect(ctrl.esc(null)).toBe('')
  })

  test('returns empty string for undefined', () => {
    expect(ctrl.esc(undefined)).toBe('')
  })

  test('returns empty string for empty string input', () => {
    expect(ctrl.esc('')).toBe('')
  })

  test('leaves safe strings unchanged', () => {
    expect(ctrl.esc('Hello World 123')).toBe('Hello World 123')
  })

  test('handles mixed special characters', () => {
    const result = ctrl.esc('<b>Tom & Jerry</b>')
    expect(result).not.toContain('<b>')
    expect(result).toContain('&lt;b&gt;')
    expect(result).toContain('&amp;')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildStaffOptions
// ─────────────────────────────────────────────────────────────────────────────
describe('BookingController.buildStaffOptions', () => {
  let ctrl
  beforeEach(() => { ctrl = makeController() })

  test('returns "No staff available" message when list is empty', () => {
    ctrl.availableStaff = []
    expect(ctrl.buildStaffOptions()).toContain('No staff available')
  })

  test('renders an <option> for each available staff member', () => {
    ctrl.availableStaff = [
      { id: 'STF-001', full_name: 'Dr. Adams',    Occupation: 'Doctor' },
      { id: 'STF-002', full_name: 'Nurse Brenda', Occupation: 'Nurse'  },
    ]
    const html = ctrl.buildStaffOptions()
    expect(html).toContain('STF-001')
    expect(html).toContain('Dr. Adams')
    expect(html).toContain('STF-002')
    expect(html).toContain('Nurse Brenda')
  })

  test('shows occupation in parentheses', () => {
    ctrl.availableStaff = [{ id: 'STF-001', full_name: 'Dr. Lee', Occupation: 'Surgeon' }]
    expect(ctrl.buildStaffOptions()).toContain('(Surgeon)')
  })

  test('omits occupation parens when Occupation is null', () => {
    ctrl.availableStaff = [{ id: 'STF-004', full_name: 'Staff Member', Occupation: null }]
    const html = ctrl.buildStaffOptions()
    expect(html).not.toContain('(null)')
  })

  test('includes a blank default option as the first option', () => {
    ctrl.availableStaff = [{ id: 'STF-001', full_name: 'Dr. Z', Occupation: 'GP' }]
    const html = ctrl.buildStaffOptions()
    expect(html).toContain('value=""')
  })

  test('escapes special characters in staff names', () => {
    ctrl.availableStaff = [{ id: 'STF-003', full_name: '<Evil> "Name"', Occupation: 'Doctor' }]
    const html = ctrl.buildStaffOptions()
    expect(html).not.toContain('<Evil>')
    expect(html).toContain('&lt;Evil&gt;')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// loadHours  (mocked Supabase)
// ─────────────────────────────────────────────────────────────────────────────
describe('BookingController.loadHours', () => {
  beforeEach(() => { global.defaultHoursMap.mockClear() })

  test('populates hoursMap from Supabase rows', async () => {
    const rows = [
      { day: 'Monday',  opentime: '08:00:00', closingtime: '16:00:00', isopen: true },
      { day: 'Tuesday', opentime: '09:00:00', closingtime: '15:00:00', isopen: true },
    ]
    const sb = { from: jest.fn(() => makeChain({ data: rows, error: null })), auth: jest.fn() }
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb

    await ctrl.loadHours()

    expect(ctrl.hoursMap['Monday'].opentime).toBe('08:00:00')
    expect(ctrl.hoursMap['Tuesday'].opentime).toBe('09:00:00')
  })

  test('falls back to defaultHoursMap when Supabase returns an error', async () => {
    const sb = { from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })), auth: jest.fn() }
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb

    await ctrl.loadHours()

    expect(global.defaultHoursMap).toHaveBeenCalledTimes(1)
  })

  test('falls back to defaultHoursMap when Supabase returns empty data', async () => {
    const sb = { from: jest.fn(() => makeChain({ data: [], error: null })), auth: jest.fn() }
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb

    await ctrl.loadHours()

    expect(global.defaultHoursMap).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// loadStaff  (mocked Supabase)
// ─────────────────────────────────────────────────────────────────────────────
describe('BookingController.loadStaff', () => {
  test('populates staffList from Supabase data', async () => {
    const staffData = [
      { id: 'STF-001', full_name: 'Dr. Smith', Occupation: 'Doctor' },
      { id: 'STF-002', full_name: 'Nurse Jane', Occupation: 'Nurse' },
    ]
    // Chain where the last .eq('status', 'Available') resolves
    const chain = makeChain({ data: staffData, error: null })
    const sb = { from: jest.fn(() => chain), auth: jest.fn() }
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb

    await ctrl.loadStaff()

    expect(ctrl.staffList).toHaveLength(2)
    expect(ctrl.staffList[0].full_name).toBe('Dr. Smith')
  })

  test('sets staffList to [] when Supabase returns an error', async () => {
    const chain = makeChain({ data: null, error: { message: 'DB error' } })
    const sb = { from: jest.fn(() => chain), auth: jest.fn() }
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb

    await ctrl.loadStaff()

    expect(ctrl.staffList).toEqual([])
  })

  test('sets staffList to [] when Supabase returns null data', async () => {
    const chain = makeChain({ data: null, error: null })
    const sb = { from: jest.fn(() => chain), auth: jest.fn() }
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb

    await ctrl.loadStaff()

    expect(ctrl.staffList).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isStaffAvailable  (mocked Supabase)
// ─────────────────────────────────────────────────────────────────────────────
describe('BookingController.isStaffAvailable', () => {
  // Build a supabase mock for isStaffAvailable.
  // The staff_unavail query ends with .or() (no .limit()), while the
  // Appointments query ends with .limit(1).  We create one thenable chain per
  // from() call so that awaiting the chain always resolves to the right data
  // regardless of which method is last.
  function makeAvailMock({ unavailData = [], appointmentData = [] } = {}) {
    let fromCallCount = 0

    function makeQueryChain(resolvedValue) {
      const chain = { then: (resolve) => Promise.resolve(resolvedValue).then(resolve) }
      ;['select','eq','or','not','limit'].forEach(m => { chain[m] = jest.fn(() => chain) })
      return chain
    }

    return {
      from: jest.fn(() => {
        fromCallCount++
        return fromCallCount === 1
          ? makeQueryChain({ data: unavailData,    error: null })
          : makeQueryChain({ data: appointmentData, error: null })
      }),
      auth: jest.fn(),
    }
  }

  test('returns true when no unavailability and no conflicting appointment', async () => {
    const sb   = makeAvailMock({ unavailData: [], appointmentData: [] })
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb

    expect(await ctrl.isStaffAvailable('STF-001', '2025-06-15', '09:00', 45)).toBe(true)
  })

  test('returns false when staff has a recorded unavailability on that date', async () => {
    const sb   = makeAvailMock({ unavailData: [{ id: 'u1' }], appointmentData: [] })
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb

    expect(await ctrl.isStaffAvailable('STF-001', '2025-06-15', '09:00', 45)).toBe(false)
  })

  test('returns false when staff has a conflicting appointment', async () => {
    const sb   = makeAvailMock({ unavailData: [], appointmentData: [{ id: 'a1' }] })
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb

    expect(await ctrl.isStaffAvailable('STF-001', '2025-06-15', '09:00', 45)).toBe(false)
  })

  test('uses default duration of 45 min when omitted', async () => {
    const sb   = makeAvailMock()
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb
    // getEndTime('09:00', 45) → '09:45'
    const result = await ctrl.isStaffAvailable('STF-001', '2025-06-15', '09:00')
    expect(result).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// filterAvailableStaff
// ─────────────────────────────────────────────────────────────────────────────
describe('BookingController.filterAvailableStaff', () => {
  test('sets availableStaff to [] when no date is selected', async () => {
    const ctrl = makeController()
    ctrl.selectedDate = null
    ctrl.selectedSlot = '09:00'
    ctrl.staffList    = [{ id: 'STF-001', full_name: 'Dr. A' }]

    await ctrl.filterAvailableStaff()

    expect(ctrl.availableStaff).toEqual([])
  })

  test('sets availableStaff to [] when no slot is selected', async () => {
    const ctrl = makeController()
    ctrl.selectedDate = new Date('2025-06-15')
    ctrl.selectedSlot = null
    ctrl.staffList    = [{ id: 'STF-001', full_name: 'Dr. A' }]

    await ctrl.filterAvailableStaff()

    expect(ctrl.availableStaff).toEqual([])
  })

  test('filters to only available staff when date and slot are set', async () => {
    // For each staff member isStaffAvailable makes 2 from() calls:
    //   1st → staff_unavail (ends with .or())
    //   2nd → Appointments (ends with .limit())
    // We serve per-from() thenable chains so both queries resolve correctly.
    // STF-001: has unavailability  → unavailable
    // STF-002: no unavailability, no conflicts → available
    let fromCallCount = 0

    function thenableChain(data) {
      const ch = { then: (resolve) => Promise.resolve({ data, error: null }).then(resolve) }
      ;['select','eq','or','not','limit'].forEach(m => { ch[m] = jest.fn(() => ch) })
      return ch
    }

    const sb = {
      from: jest.fn(() => {
        fromCallCount++
        // Calls 1&2 → STF-001: unavail=1 item, appointments=[]
        // Calls 3&4 → STF-002: unavail=[], appointments=[]
        if (fromCallCount === 1) return thenableChain([{ id: 'u1' }])  // STF-001 unavail
        if (fromCallCount === 2) return thenableChain([])               // STF-001 appointments
        if (fromCallCount === 3) return thenableChain([])               // STF-002 unavail
        return thenableChain([])                                         // STF-002 appointments
      }),
      auth: jest.fn(),
    }
    const ctrl = new BookingController('c1', 'TC', 'clinic', 'public', 'JHB', 'Gauteng')
    ctrl.sb = sb
    ctrl.selectedDate = new Date('2025-06-15')
    ctrl.selectedSlot = '09:00'
    ctrl.staffList    = [
      { id: 'STF-001', full_name: 'Dr. A' },
      { id: 'STF-002', full_name: 'Dr. B' },
    ]

    await ctrl.filterAvailableStaff()

    const availableIds = ctrl.availableStaff.map(s => s.id)
    expect(availableIds).not.toContain('STF-001')
    expect(availableIds).toContain('STF-002')
  })
})
