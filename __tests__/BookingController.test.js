'use strict'

// ─── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../backend/supabase.js', () => {
  const m = {}
  Object.defineProperty(m, 'supabase', { get: () => global.supabase, enumerable: true })
  return m
})
jest.mock('../backend/notificationService.js', () => ({
  NotificationService: {
    sendEmailNotification:      jest.fn(() => Promise.resolve()),
    createDatabaseNotification: jest.fn(() => Promise.resolve()),
  }
}))
jest.mock('../backend/utils.js', () => ({ Utils: {} }))

// ─── Browser globals (set before require so auto-execute succeeds) ────────────
// Auto-execute: clinicID is null → init() → renderError() → this.app.innerHTML = ...
global.location       = { search: '' }
global.URLSearchParams = URLSearchParams
global.crypto         = { randomUUID: jest.fn(() => 'aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb') }

const _appEl = { innerHTML: '' }
global.document = {
  getElementById:   jest.fn(id => id === 'app' ? _appEl : null),
  querySelector:    jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
  createElement:    jest.fn(() => ({ id: '', textContent: '', style: { cssText: '' } })),
  addEventListener: jest.fn(),
}
global.supabase = null

// ─── Load module ──────────────────────────────────────────────────────────────
const { BookingController } = require('../backend/booking.js')

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeChain(resolvedValue) {
  const chain = { then: resolve => Promise.resolve(resolvedValue).then(resolve) }
  ;['select', 'eq', 'order', 'insert', 'not', 'limit', 'ilike', 'single', 'update'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

function makeCtrl(opts = {}) {
  const app = { innerHTML: '' }
  global.document.getElementById = jest.fn(id => id === 'app' ? app : null)
  const ctrl = new BookingController(
    opts.clinicID       ?? '42',
    opts.clinicName     ?? 'Test Clinic',
    opts.clinicType     ?? 'clinic',
    opts.clinicSector   ?? 'public',
    opts.clinicCity     ?? 'Johannesburg',
    opts.clinicProvince ?? 'Gauteng'
  )
  ctrl.app = app
  return ctrl
}

// ═══════════════════════════════════════════════════════════════════════════════
describe('BookingController (booking.js)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.supabase = null
    global.document.getElementById   = jest.fn(id => id === 'app' ? { innerHTML: '' } : null)
    global.document.querySelector    = jest.fn(() => null)
    global.document.querySelectorAll = jest.fn(() => [])
  })

  // ── esc ──────────────────────────────────────────────────────────────────────
  describe('esc', () => {
    test('returns empty string for falsy input', () => {
      expect(makeCtrl().esc(null)).toBe('')
      expect(makeCtrl().esc('')).toBe('')
    })

    test('escapes &, <, >, and "', () => {
      const ctrl = makeCtrl()
      expect(ctrl.esc('a & b')).toBe('a &amp; b')
      expect(ctrl.esc('<b>')).toBe('&lt;b&gt;')
      expect(ctrl.esc('"hi"')).toBe('&quot;hi&quot;')
    })

    test('leaves plain strings unchanged', () => {
      expect(makeCtrl().esc('hello')).toBe('hello')
    })
  })

  // ── fmtTime ──────────────────────────────────────────────────────────────────
  describe('fmtTime', () => {
    test('returns empty string for falsy input', () => {
      expect(makeCtrl().fmtTime(null)).toBe('')
      expect(makeCtrl().fmtTime('')).toBe('')
    })

    test('slices timestamp to HH:MM', () => {
      expect(makeCtrl().fmtTime('08:30:00')).toBe('08:30')
      expect(makeCtrl().fmtTime('17:00:00')).toBe('17:00')
    })
  })

  // ── generateSlots ────────────────────────────────────────────────────────────
  describe('generateSlots', () => {
    test('returns empty array when either time is missing', () => {
      const ctrl = makeCtrl()
      expect(ctrl.generateSlots(null, '17:00:00')).toEqual([])
      expect(ctrl.generateSlots('08:00:00', null)).toEqual([])
    })

    test('generates correct 45-minute slots between open and close times', () => {
      const slots = makeCtrl().generateSlots('08:00:00', '10:00:00')
      // 08:00 (fits: 08:45≤10:00), 08:45 (fits: 09:30≤10:00), 09:30 does NOT fit (10:15>10:00)
      expect(slots).toEqual(['08:00', '08:45'])
    })

    test('returns empty when the window is shorter than one slot', () => {
      expect(makeCtrl().generateSlots('08:00:00', '08:30:00')).toEqual([])
    })

    test('generates slots that all fit within the closing time', () => {
      const slots = makeCtrl().generateSlots('08:00:00', '17:00:00')
      expect(slots.length).toBeGreaterThan(0)
      const last = slots[slots.length - 1]
      const [h, m] = last.split(':').map(Number)
      expect(h * 60 + m + 45).toBeLessThanOrEqual(17 * 60)
    })
  })

  // ── getEndTime ───────────────────────────────────────────────────────────────
  describe('getEndTime', () => {
    test('adds 45 minutes to the start time', () => {
      expect(makeCtrl().getEndTime('08:00')).toBe('08:45')
      expect(makeCtrl().getEndTime('08:30')).toBe('09:15')
    })

    test('handles multi-hour spans correctly', () => {
      expect(makeCtrl().getEndTime('09:30')).toBe('10:15')
      expect(makeCtrl().getEndTime('16:15')).toBe('17:00')
    })
  })

  // ── loadHours ────────────────────────────────────────────────────────────────
  describe('loadHours', () => {
    test('populates hoursMap from Supabase rows', async () => {
      const dbRows = [
        { day: 'Monday', opentime: '08:00:00', closingtime: '17:00:00', isopen: true },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: dbRows, error: null })) }
      const ctrl = makeCtrl()
      await ctrl.loadHours()
      expect(ctrl.hoursMap['Monday'].opentime).toBe('08:00:00')
    })

    test('falls back to weekday defaults on Supabase error', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })) }
      const ctrl = makeCtrl()
      await ctrl.loadHours()
      expect(ctrl.hoursMap['Monday'].isopen).toBe(true)
      expect(ctrl.hoursMap['Saturday'].isopen).toBe(false)
      expect(ctrl.hoursMap['Sunday'].isopen).toBe(false)
    })

    test('falls back to defaults when Supabase returns empty data', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const ctrl = makeCtrl()
      await ctrl.loadHours()
      expect(ctrl.hoursMap['Monday'].isopen).toBe(true)
    })
  })

  // ── loadDoctors ──────────────────────────────────────────────────────────────
  describe('loadDoctors', () => {
    test('normalises staff rows into the expected shape', async () => {
      const rawRows = [{ id: 'STF-001', full_name: 'Dr. Alice', Occupation: 'Doctor' }]
      global.supabase = { from: jest.fn(() => makeChain({ data: rawRows, error: null })) }
      const ctrl = makeCtrl()
      await ctrl.loadDoctors()
      expect(ctrl.doctors).toHaveLength(1)
      expect(ctrl.doctors[0].id).toBe('STF-001')
      expect(ctrl.doctors[0].full_name).toBe('Dr. Alice')
      expect(ctrl.doctors[0].Occupation).toBe('Doctor')
    })

    test('sets doctors to empty array on Supabase error', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: null, error: { message: 'error' } })) }
      const ctrl = makeCtrl()
      await ctrl.loadDoctors()
      expect(ctrl.doctors).toEqual([])
    })

    test('sets doctors to empty array when Supabase returns no rows', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const ctrl = makeCtrl()
      await ctrl.loadDoctors()
      expect(ctrl.doctors).toEqual([])
    })

    test('falls back to alternative column name variants for id and full_name', async () => {
      const rawRows = [{ StaffID: 'STF-002', FullName: 'Nurse Bob', role: 'Nurse' }]
      global.supabase = { from: jest.fn(() => makeChain({ data: rawRows, error: null })) }
      const ctrl = makeCtrl()
      await ctrl.loadDoctors()
      expect(ctrl.doctors[0].id).toBe('STF-002')
      expect(ctrl.doctors[0].full_name).toBe('Nurse Bob')
    })
  })

  // ── isStaffAvailable ─────────────────────────────────────────────────────────
  describe('isStaffAvailable', () => {
    test('returns true when staff has no unavailability and no conflicting appointments', async () => {
      let callCount = 0
      global.supabase = {
        from: jest.fn(() => {
          callCount++
          // 1st call: staff_unavail → no records
          // 2nd call: Appointments → no records
          return makeChain({ data: [], error: null })
        }),
      }
      const ctrl = makeCtrl()
      const result = await ctrl.isStaffAvailable('STF-001', '2025-06-01', '09:00')
      expect(result).toBe(true)
    })

    test('returns false when a conflicting appointment exists', async () => {
      let callCount = 0
      global.supabase = {
        from: jest.fn(() => {
          callCount++
          if (callCount === 1) return makeChain({ data: [], error: null })       // no unavail
          return makeChain({ data: [{ id: 'APT-001' }], error: null })           // conflict
        }),
      }
      const ctrl = makeCtrl()
      const result = await ctrl.isStaffAvailable('STF-001', '2025-06-01', '09:00')
      expect(result).toBe(false)
    })

    test('returns false when staff is marked unavailable for that period', async () => {
      global.supabase = {
        from: jest.fn(() =>
          makeChain({ data: [{ Start: '08:00', End: '10:00' }], error: null })
        ),
      }
      const ctrl = makeCtrl()
      const result = await ctrl.isStaffAvailable('STF-001', '2025-06-01', '09:00')
      expect(result).toBe(false)
    })
  })

  // ── filterAvailableStaff ─────────────────────────────────────────────────────
  describe('filterAvailableStaff', () => {
    test('sets availableStaff to empty array when selectedDate is not set', async () => {
      const ctrl = makeCtrl()
      ctrl.selectedDate = null
      ctrl.selectedSlot = '09:00'
      await ctrl.filterAvailableStaff()
      expect(ctrl.availableStaff).toEqual([])
    })

    test('sets availableStaff to empty array when selectedSlot is not set', async () => {
      const ctrl = makeCtrl()
      ctrl.selectedDate = new Date('2025-06-01')
      ctrl.selectedSlot = null
      await ctrl.filterAvailableStaff()
      expect(ctrl.availableStaff).toEqual([])
    })

    test('populates availableStaff with doctors that pass isStaffAvailable', async () => {
      const ctrl = makeCtrl()
      ctrl.selectedDate = new Date('2025-06-01')
      ctrl.selectedSlot = '09:00'
      ctrl.doctors = [
        { id: 'STF-001', full_name: 'Dr. A' },
        { id: 'STF-002', full_name: 'Dr. B' },
      ]
      ctrl.isStaffAvailable = jest.fn()
        .mockResolvedValueOnce(true)   // STF-001 available
        .mockResolvedValueOnce(false)  // STF-002 not available
      await ctrl.filterAvailableStaff()
      expect(ctrl.availableStaff).toHaveLength(1)
      expect(ctrl.availableStaff[0].id).toBe('STF-001')
    })

    test('sets availableStaff to empty when no doctor passes the check', async () => {
      const ctrl = makeCtrl()
      ctrl.selectedDate = new Date('2025-06-01')
      ctrl.selectedSlot = '09:00'
      ctrl.doctors = [{ id: 'STF-001', full_name: 'Dr. A' }]
      ctrl.isStaffAvailable = jest.fn().mockResolvedValue(false)
      await ctrl.filterAvailableStaff()
      expect(ctrl.availableStaff).toEqual([])
    })
  })

  // ── buildDoctorOptions ───────────────────────────────────────────────────────
  describe('buildDoctorOptions', () => {
    test('returns "no doctors on file" option when doctors list is empty', () => {
      const ctrl = makeCtrl()
      ctrl.doctors        = []
      ctrl.availableStaff = []
      expect(ctrl.buildDoctorOptions()).toContain('No doctors on file')
    })

    test('returns "no staff available" option when doctors exist but none are available', () => {
      const ctrl = makeCtrl()
      ctrl.doctors        = [{ id: 'STF-001', full_name: 'Dr. A', Occupation: 'Doctor' }]
      ctrl.availableStaff = []
      expect(ctrl.buildDoctorOptions()).toContain('No staff available for this slot')
    })

    test('renders an option for each available staff member', () => {
      const ctrl = makeCtrl()
      ctrl.doctors        = [{ id: 'STF-001', full_name: 'Dr. A', Occupation: 'Doctor' }]
      ctrl.availableStaff = [{ id: 'STF-001', full_name: 'Dr. A', Occupation: 'Doctor' }]
      const html = ctrl.buildDoctorOptions()
      expect(html).toContain('Dr. A')
      expect(html).toContain('STF-001')
    })

    test('marks the currently selected doctor as selected', () => {
      const ctrl = makeCtrl()
      ctrl.selectedDoctorID = 'STF-001'
      ctrl.doctors        = [{ id: 'STF-001', full_name: 'Dr. A', Occupation: null }]
      ctrl.availableStaff = [{ id: 'STF-001', full_name: 'Dr. A', Occupation: null }]
      expect(ctrl.buildDoctorOptions()).toContain('selected')
    })
  })

  // ── submitBooking – validation paths ─────────────────────────────────────────
  describe('submitBooking', () => {
    // Build a form-field DOM map and wire it up AFTER the controller is created
    // so makeCtrl()'s getElementById override does not clobber our stubs.
    function wireFormDom(ctrl, overrides = {}) {
      const errEl    = { textContent: '', style: { display: 'none' } }
      const submitBtn = { disabled: false, textContent: 'Confirm Booking' }
      const fields = {
        'app':         ctrl.app,
        'f-firstname': { value: overrides.firstName ?? 'John' },
        'f-lastname':  { value: overrides.lastName  ?? 'Doe'  },
        'f-phone':     { value: overrides.phone     ?? '0821234567' },
        'f-reason':    { value: '' },
        'f-notes':     { value: '' },
        'form-error':  errEl,
        'btn-submit':  submitBtn,
      }
      global.document.getElementById = jest.fn(id => fields[id] ?? null)
      return { errEl, submitBtn }
    }

    test('shows error and returns early when required fields are empty', async () => {
      const ctrl = makeCtrl()
      const { errEl } = wireFormDom(ctrl, { firstName: '', lastName: '', phone: '' })
      ctrl.selectedDate = new Date('2025-06-01')
      ctrl.selectedSlot = '09:00'
      await ctrl.submitBooking()
      expect(errEl.textContent).toContain('first name')
      expect(errEl.style.display).toBe('block')
    })

    test('shows error and returns early when no active session exists', async () => {
      const ctrl = makeCtrl()
      // this.sb is captured from global.supabase at construction time; override it directly
      ctrl.sb = { auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) } }
      const { errEl } = wireFormDom(ctrl)
      ctrl.selectedDate = new Date('2025-06-01')
      ctrl.selectedSlot = '09:00'
      await ctrl.submitBooking()
      expect(errEl.textContent).toContain('log in')
      expect(errEl.style.display).toBe('block')
    })

    test('shows error when auto-assign finds no available staff', async () => {
      const ctrl = makeCtrl()
      ctrl.sb = { auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } })) } }
      const { errEl } = wireFormDom(ctrl)
      ctrl.selectedDate         = new Date('2025-06-01')
      ctrl.selectedSlot         = '09:00'
      ctrl.selectedDoctorID     = null
      ctrl.filterAvailableStaff = jest.fn(() => Promise.resolve())
      ctrl.availableStaff       = []
      await ctrl.submitBooking()
      expect(errEl.textContent).toContain('No staff available')
    })

    test('inserts the appointment record and renders confirmation on success', async () => {
      const ctrl = makeCtrl()
      const session = { user: { id: 'u1', email: 'test@test.com' } }
      ctrl.sb = {
        auth: { getSession: jest.fn(() => Promise.resolve({ data: { session } })) },
        from: jest.fn(() => makeChain({ error: null })),
      }
      wireFormDom(ctrl)
      ctrl.selectedDate         = new Date('2025-06-01')
      ctrl.selectedSlot         = '09:00'
      ctrl.selectedDoctorID     = 'STF-001'
      ctrl.selectedDoctorName   = 'Dr. A'
      ctrl.filterAvailableStaff = jest.fn(() => Promise.resolve())
      ctrl.isStaffAvailable     = jest.fn(() => Promise.resolve(true))
      ctrl.renderConfirmation   = jest.fn()
      await ctrl.submitBooking()
      expect(ctrl.renderConfirmation).toHaveBeenCalledWith(
        'John', 'Doe', '2025-06-01', expect.any(String)
      )
    })
  })

  // ── updateTabs ───────────────────────────────────────────────────────────────
  describe('updateTabs', () => {
    test('marks the current step tab as active and previous tabs as done', () => {
      const ctrl = makeCtrl()   // construct first so makeCtrl does not clobber getElementById
      const tab1 = { className: '' }
      const tab2 = { className: '' }
      const tab3 = { className: '' }
      global.document.getElementById = jest.fn(id => ({ 'tab-1': tab1, 'tab-2': tab2, 'tab-3': tab3 }[id] ?? null))
      ctrl.currentStep = 2
      ctrl.updateTabs()
      expect(tab1.className).toContain('done')
      expect(tab2.className).toContain('active')
      expect(tab3.className).not.toContain('active')
      expect(tab3.className).not.toContain('done')
    })
  })

  // ── renderHoursPanel ─────────────────────────────────────────────────────────
  describe('renderHoursPanel', () => {
    test('returns early without throwing when hours-grid is not in the DOM', () => {
      const ctrl = makeCtrl()
      global.document.getElementById = jest.fn(() => null)
      expect(() => ctrl.renderHoursPanel()).not.toThrow()
    })

    test('renders "Closed" for days where isopen is false', () => {
      const ctrl = makeCtrl()   // construct first
      const grid = { innerHTML: '' }
      global.document.getElementById = jest.fn(id => id === 'hours-grid' ? grid : null)
      ctrl.hoursMap = { Sunday: { isopen: false }, Monday: { isopen: false } }
      ctrl.renderHoursPanel()
      expect(grid.innerHTML).toContain('Closed')
    })

    test('renders formatted HH:MM times for open days', () => {
      const ctrl = makeCtrl()   // construct first
      const grid = { innerHTML: '' }
      global.document.getElementById = jest.fn(id => id === 'hours-grid' ? grid : null)
      ctrl.hoursMap = {
        Sunday: { isopen: false },
        Monday: { isopen: true, opentime: '08:00:00', closingtime: '17:00:00' },
      }
      ctrl.renderHoursPanel()
      expect(grid.innerHTML).toContain('08:00')
      expect(grid.innerHTML).toContain('17:00')
    })
  })

  // ── renderError ──────────────────────────────────────────────────────────────
  describe('renderError', () => {
    test('sets app.innerHTML with HTML-escaped title and message', () => {
      const ctrl = makeCtrl()
      ctrl.app = { innerHTML: '' }
      ctrl.renderError('No facility selected.', 'Go back.')
      expect(ctrl.app.innerHTML).toContain('No facility selected.')
      expect(ctrl.app.innerHTML).toContain('Go back.')
    })
  })
})
