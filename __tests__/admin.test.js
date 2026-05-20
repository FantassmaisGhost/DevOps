'use strict'

/**
 * __tests__/admin.test.js
 * Tests for:
 *   backend/SeeFacilities.js              — escapeHtml, generateStaffId, loadStaff,
 *                                           loadPendingStaff, approveStaff,
 *                                           removeStaff, loadPendingReceptionists,
 *                                           approveReceptionist, loadReceptionists,
 *                                           removeReceptionist
 *   backend/AdminHoursController.js       — isRowChanged, discardChanges,
 *                                           loadHours
 *
 * SeeFacilities.js is loaded via require() so Jest/Istanbul instruments it for
 * coverage.  babel-jest (configured in package.json) transforms its ES module
 * import/export syntax to CommonJS.  We mock the supabase module with a getter
 * so each test can swap global.supabase independently.
 */

const fs   = require('fs')
const path = require('path')

// ─── Supabase module mock ────────────────────────────────────────────────────
// jest.mock is hoisted to the top of the file by babel-jest.
// The getter reads global.supabase at call time so each test can inject its own
// mock without needing to reset the module.
jest.mock('../backend/supabase.js', () => {
  const m = {}
  Object.defineProperty(m, 'supabase', { get: () => global.supabase, enumerable: true })
  return m
})

// ─── Browser globals needed by SeeFacilities.js ─────────────────────────────
// The file has auto-execute code at the bottom that runs on first require().
// Supply the minimal browser APIs it touches so the module loads without error.
global.location       = { search: '' }
global.URLSearchParams = URLSearchParams   // available in Node ≥18
global.document = {
  getElementById:      jest.fn(() => ({ innerHTML: '', insertAdjacentHTML: jest.fn() })),
  querySelectorAll:    jest.fn(() => []),
}
global.supabase = null   // overridden per test
global.confirm  = jest.fn(() => true)

// ─── Load SeeFacilities.js ──────────────────────────────────────────────────
// babel-jest transforms import/export → CommonJS so a plain require() works.
// The auto-execute block runs here; clinicID is null so renderError() fires but
// hits our document stub harmlessly.
const { AdminFacilitiesController } = require('../backend/SeeFacilities.js')

// ─── Load AdminHoursController (browser-global script, no exports) ───────────
global.DAY_NAMES = [
  'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday',
]
global.defaultRow = {
  operatingid: null, clinicid: null, day: null,
  opentime: '08:00:00', closingtime: '17:00:00', isopen: true,
}
global.defaultHoursMap = jest.fn(() => ({
  Sunday:    { isopen: false, opentime: null,       closingtime: null },
  Monday:    { isopen: true,  opentime: '08:00:00', closingtime: '17:00:00' },
  Tuesday:   { isopen: true,  opentime: '08:00:00', closingtime: '17:00:00' },
  Wednesday: { isopen: true,  opentime: '08:00:00', closingtime: '17:00:00' },
  Thursday:  { isopen: true,  opentime: '08:00:00', closingtime: '17:00:00' },
  Friday:    { isopen: true,  opentime: '08:00:00', closingtime: '17:00:00' },
  Saturday:  { isopen: false, opentime: null,       closingtime: null },
}))

const _hoursCode = fs.readFileSync(
  path.join(__dirname, '../backend/AdminHoursController.js'), 'utf8'
)
// eslint-disable-next-line no-eval
const AdminHoursController = eval(
  `(function() { ${_hoursCode}; return AdminHoursController; })()`
)

// ─── Supabase chain helper ───────────────────────────────────────────────────
function makeChain(resolvedValue) {
  const then = (resolve) => Promise.resolve(resolvedValue).then(resolve)
  const chain = { then }
  ;['select','eq','or','not','limit','insert','update','delete','order'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AdminFacilitiesController (SeeFacilities.js)
// ═══════════════════════════════════════════════════════════════════════════════

describe('AdminFacilitiesController', () => {
  function makeCtrl() {
    return new AdminFacilitiesController(
      '42', 'Test Clinic', 'clinic', 'public', null, 'Gauteng'
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    global.confirm = jest.fn(() => true)
  })

  // ── escapeHtml ──────────────────────────────────────────────────────────────
  describe('escapeHtml', () => {
    test('returns empty string for falsy values', () => {
      const ctrl = makeCtrl()
      expect(ctrl.escapeHtml(null)).toBe('')
      expect(ctrl.escapeHtml(undefined)).toBe('')
      expect(ctrl.escapeHtml('')).toBe('')
    })

    test('escapes ampersand', () => {
      expect(makeCtrl().escapeHtml('a & b')).toBe('a &amp; b')
    })

    test('escapes less-than and greater-than', () => {
      expect(makeCtrl().escapeHtml('<script>')).toBe('&lt;script&gt;')
    })

    test('escapes double quotes', () => {
      expect(makeCtrl().escapeHtml('"hello"')).toBe('&quot;hello&quot;')
    })

    test('returns plain strings unchanged', () => {
      expect(makeCtrl().escapeHtml('hello world')).toBe('hello world')
    })
  })

  // ── generateStaffId ─────────────────────────────────────────────────────────
  describe('generateStaffId', () => {
    test('generates STF-00042-001 when clinic has no existing staff', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: [], error: null })),
      }
      const id = await makeCtrl().generateStaffId(42)
      expect(id).toBe('STF-00042-001')
    })

    test('increments from the last staff ID', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: [{ id: 'STF-00042-003' }], error: null })),
      }
      const id = await makeCtrl().generateStaffId(42)
      expect(id).toBe('STF-00042-004')
    })

    test('pads clinic ID to 5 digits', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: [], error: null })),
      }
      const id = await makeCtrl().generateStaffId(7)
      expect(id).toBe('STF-00007-001')
    })

    test('pads staff number to 3 digits', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: [{ id: 'STF-00042-009' }], error: null })),
      }
      const id = await makeCtrl().generateStaffId(42)
      expect(id).toBe('STF-00042-010')
    })

    test('starts from 001 when no existing staff data returned', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: null, error: null })),
      }
      const id = await makeCtrl().generateStaffId(1)
      expect(id).toBe('STF-00001-001')
    })
  })

  // ── loadStaff ───────────────────────────────────────────────────────────────
  describe('loadStaff', () => {
    test('returns staff array from Supabase', async () => {
      const staffRows = [
        { id: 'STF-001', full_name: 'Dr. A', Occupation: 'Doctor' },
        { id: 'STF-002', full_name: 'Nurse B', Occupation: 'Nurse' },
      ]
      global.supabase = {
        from: jest.fn(() => makeChain({ data: staffRows, error: null })),
      }
      const result = await makeCtrl().loadStaff()
      expect(result).toHaveLength(2)
      expect(result[0].full_name).toBe('Dr. A')
    })

    test('returns empty array when Supabase has no staff', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: null, error: null })),
      }
      expect(await makeCtrl().loadStaff()).toEqual([])
    })

    test('returns empty array on Supabase error', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })),
      }
      expect(await makeCtrl().loadStaff()).toEqual([])
    })
  })

  // ── removeStaff ─────────────────────────────────────────────────────────────
  describe('removeStaff', () => {
    test('returns false when user cancels confirmation', async () => {
      global.confirm = jest.fn(() => false)
      expect(await makeCtrl().removeStaff('STF-001', 'Dr. A')).toBe(false)
    })

    test('returns false when Supabase delete fails', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ error: { message: 'Delete failed' } })),
      }
      const ctrl = makeCtrl()
      ctrl.showToast = jest.fn()
      expect(await ctrl.removeStaff('STF-001', 'Dr. A')).toBe(false)
    })

    test('returns true when delete succeeds', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ error: null })),
      }
      const ctrl = makeCtrl()
      ctrl.showToast = jest.fn()
      expect(await ctrl.removeStaff('STF-001', 'Dr. A')).toBe(true)
    })
  })

  // ── loadPendingStaff ────────────────────────────────────────────────────────
  describe('loadPendingStaff', () => {
    test('returns pending staff filtered to "pending" status', async () => {
      const pendingRows = [
        { email: 'a@clinic.com', full_name: 'Alice', status: 'pending', clinicid: '42' },
      ]
      global.supabase = {
        from: jest.fn(() => makeChain({ data: pendingRows, error: null })),
      }
      const result = await makeCtrl().loadPendingStaff()
      expect(result).toHaveLength(1)
      expect(result[0].email).toBe('a@clinic.com')
    })

    test('returns empty array when no pending staff', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: null, error: null })),
      }
      expect(await makeCtrl().loadPendingStaff()).toEqual([])
    })
  })

  // ── approveStaff ────────────────────────────────────────────────────────────
  describe('approveStaff', () => {
    test('returns true and updates pending_staff status on success', async () => {
      let fromCallCount = 0
      global.supabase = {
        from: jest.fn(() => {
          fromCallCount++
          if (fromCallCount === 1) return makeChain({ data: [], error: null }) // generateStaffId
          if (fromCallCount === 2) return makeChain({ data: null, error: null }) // insert
          return makeChain({ data: null, error: null }) // pending update
        }),
      }
      const ctrl = makeCtrl()
      ctrl.showToast = jest.fn()

      const pending = {
        email: 'new@clinic.com', full_name: 'Bob Jones',
        occupation: 'Nurse', phone_number: '082000000', clinicid: '42',
      }
      const result = await ctrl.approveStaff(pending)
      expect(result).toBe(true)
    })

    test('returns false when Staff insert fails', async () => {
      let fromCallCount = 0
      global.supabase = {
        from: jest.fn(() => {
          fromCallCount++
          if (fromCallCount === 1) return makeChain({ data: [], error: null }) // generateStaffId
          return makeChain({ data: null, error: { message: 'Duplicate key' } }) // insert fails
        }),
      }
      const ctrl = makeCtrl()
      ctrl.showToast = jest.fn()

      const result = await ctrl.approveStaff({
        email: 'x@clinic.com', full_name: 'X', clinicid: '42',
      })
      expect(result).toBe(false)
    })
  })

  // ── loadPendingReceptionists ────────────────────────────────────────────────
  describe('loadPendingReceptionists', () => {
    test('returns pending receptionist rows from Supabase', async () => {
      const rows = [
        { email: 'r@clinic.com', full_name: 'Rhonda', status: 'pending', clinicid: '42' },
      ]
      global.supabase = {
        from: jest.fn(() => makeChain({ data: rows, error: null })),
      }
      const result = await makeCtrl().loadPendingReceptionists()
      expect(result).toHaveLength(1)
      expect(result[0].email).toBe('r@clinic.com')
    })

    test('returns empty array on Supabase error', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })),
      }
      expect(await makeCtrl().loadPendingReceptionists()).toEqual([])
    })

    test('returns empty array when data is null', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: null, error: null })),
      }
      expect(await makeCtrl().loadPendingReceptionists()).toEqual([])
    })
  })

  // ── approveReceptionist ─────────────────────────────────────────────────────
  describe('approveReceptionist', () => {
    test('returns true on successful insert and status update', async () => {
      let fromCallCount = 0
      global.supabase = {
        from: jest.fn(() => {
          fromCallCount++
          if (fromCallCount === 1) return makeChain({ error: null }) // Receptionist insert
          return makeChain({ error: null }) // pending_receptionists update
        }),
      }
      const ctrl = makeCtrl()
      ctrl.showToast = jest.fn()

      const result = await ctrl.approveReceptionist({
        email: 'r@clinic.com', full_name: 'Rhonda',
        phone_number: '083000000', clinicid: '42', clinicname: 'Test Clinic',
      })
      expect(result).toBe(true)
    })

    test('returns false when Receptionist insert fails', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ error: { message: 'Insert failed' } })),
      }
      const ctrl = makeCtrl()
      ctrl.showToast = jest.fn()

      const result = await ctrl.approveReceptionist({
        email: 'r@clinic.com', full_name: 'Rhonda', clinicid: '42',
      })
      expect(result).toBe(false)
    })
  })

  // ── loadReceptionists ───────────────────────────────────────────────────────
  describe('loadReceptionists', () => {
    test('returns receptionist rows from Supabase', async () => {
      const rows = [
        { receptionist_id: 'REC-42-1', full_name: 'Rhonda', email: 'r@clinic.com' },
      ]
      global.supabase = {
        from: jest.fn(() => makeChain({ data: rows, error: null })),
      }
      const result = await makeCtrl().loadReceptionists()
      expect(result).toHaveLength(1)
      expect(result[0].full_name).toBe('Rhonda')
    })

    test('returns empty array on Supabase error', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })),
      }
      expect(await makeCtrl().loadReceptionists()).toEqual([])
    })

    test('returns empty array when data is null', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: null, error: null })),
      }
      expect(await makeCtrl().loadReceptionists()).toEqual([])
    })
  })

  // ── removeReceptionist ──────────────────────────────────────────────────────
  describe('removeReceptionist', () => {
    test('returns false when user cancels confirmation', async () => {
      global.confirm = jest.fn(() => false)
      expect(await makeCtrl().removeReceptionist('REC-42-1', 'Rhonda')).toBe(false)
    })

    test('returns false when Supabase delete fails', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ error: { message: 'Delete failed' } })),
      }
      const ctrl = makeCtrl()
      ctrl.showToast = jest.fn()
      expect(await ctrl.removeReceptionist('REC-42-1', 'Rhonda')).toBe(false)
    })

    test('returns true when delete succeeds', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ error: null })),
      }
      const ctrl = makeCtrl()
      ctrl.showToast = jest.fn()
      expect(await ctrl.removeReceptionist('REC-42-1', 'Rhonda')).toBe(true)
    })
  })

  // ── renderStaffList ─────────────────────────────────────────────────────────
  describe('renderStaffList', () => {
    test('returns early when container element is null', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      global.document.getElementById = jest.fn(() => null)
      await expect(makeCtrl().renderStaffList()).resolves.toBeUndefined()
    })

    test('shows empty-state message when staff list is empty', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderStaffList()
      expect(container.innerHTML).toContain('No staff members')
    })

    test('renders staff row HTML when staff data exists', async () => {
      const staffRows = [
        { id: 'STF-001', full_name: 'Dr. Alpha', email: 'alpha@test.com', Occupation: 'Doctor', contact: '083111111' },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: staffRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderStaffList()
      expect(container.innerHTML).toContain('Dr. Alpha')
      expect(container.innerHTML).toContain('STF-001')
      expect(container.innerHTML).toContain('083111111')
    })

    test('renders N/A for contact when contact is falsy', async () => {
      const staffRows = [
        { id: 'STF-002', full_name: 'Nurse B', email: 'b@test.com', Occupation: 'Nurse', contact: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: staffRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderStaffList()
      expect(container.innerHTML).toContain('N/A')
    })

    test('attaches click listener to each remove-staff-btn', async () => {
      const staffRows = [
        { id: 'STF-001', full_name: 'Dr. A', email: 'a@test.com', Occupation: 'Doctor', contact: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: staffRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      const mockBtn = { getAttribute: jest.fn(), addEventListener: jest.fn() }
      global.document.querySelectorAll = jest.fn(() => [mockBtn])
      await makeCtrl().renderStaffList()
      expect(global.document.querySelectorAll).toHaveBeenCalledWith('.remove-staff-btn')
      expect(mockBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
    })

    test('re-renders after successful remove', async () => {
      const staffRows = [
        { id: 'STF-001', full_name: 'Dr. A', email: 'a@test.com', Occupation: 'Doctor', contact: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: staffRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      let clickFn
      const mockBtn = {
        getAttribute: jest.fn(attr => attr === 'data-id' ? 'STF-001' : 'Dr. A'),
        addEventListener: jest.fn((evt, fn) => { clickFn = fn }),
      }
      global.document.querySelectorAll = jest.fn(() => [mockBtn])
      const ctrl = makeCtrl()
      ctrl.removeStaff = jest.fn(() => Promise.resolve(true))
      const spy = jest.spyOn(ctrl, 'renderStaffList')
      await ctrl.renderStaffList()  // call #1 — attaches listener
      await clickFn()               // remove succeeds → renderStaffList() called again
      expect(spy).toHaveBeenCalledTimes(2)
    })

    test('does not re-render when remove returns false', async () => {
      const staffRows = [
        { id: 'STF-001', full_name: 'Dr. A', email: 'a@test.com', Occupation: 'Doctor', contact: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: staffRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      let clickFn
      const mockBtn = {
        getAttribute: jest.fn(attr => attr === 'data-id' ? 'STF-001' : 'Dr. A'),
        addEventListener: jest.fn((evt, fn) => { clickFn = fn }),
      }
      global.document.querySelectorAll = jest.fn(() => [mockBtn])
      const ctrl = makeCtrl()
      ctrl.removeStaff = jest.fn(() => Promise.resolve(false))
      const spy = jest.spyOn(ctrl, 'renderStaffList')
      await ctrl.renderStaffList()  // call #1
      await clickFn()               // remove cancelled/failed → no re-render
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  // ── renderPendingStaff ──────────────────────────────────────────────────────
  describe('renderPendingStaff', () => {
    test('returns early when container element is null', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      global.document.getElementById = jest.fn(() => null)
      await expect(makeCtrl().renderPendingStaff()).resolves.toBeUndefined()
    })

    test('shows empty-state message when no pending requests', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderPendingStaff()
      expect(container.innerHTML).toContain('No pending staff requests')
    })

    test('renders pending staff rows with occupation and phone number', async () => {
      const pendingRows = [
        { email: 'a@test.com', full_name: 'Alice', occupation: 'Nurse', phone_number: '083000000', clinicid: '42' },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: pendingRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderPendingStaff()
      expect(container.innerHTML).toContain('Alice')
      expect(container.innerHTML).toContain('Nurse')
      expect(container.innerHTML).toContain('083000000')
    })

    test('omits phone row when phone_number is null', async () => {
      const pendingRows = [
        { email: 'a@test.com', full_name: 'Alice', occupation: 'Nurse', phone_number: null, clinicid: '42' },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: pendingRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderPendingStaff()
      expect(container.innerHTML).not.toContain('Phone:')
    })

    test('attaches click listener to each approve-staff-btn', async () => {
      const pendingRows = [
        { email: 'a@test.com', full_name: 'Alice', occupation: 'Nurse', phone_number: null, clinicid: '42' },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: pendingRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      const mockBtn = { getAttribute: jest.fn(() => 'a@test.com'), addEventListener: jest.fn() }
      global.document.querySelectorAll = jest.fn(() => [mockBtn])
      await makeCtrl().renderPendingStaff()
      expect(global.document.querySelectorAll).toHaveBeenCalledWith('.approve-staff-btn')
      expect(mockBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
    })

    test('calls approveStaff with matched item and re-renders on click', async () => {
      const pendingRows = [
        { email: 'a@test.com', full_name: 'Alice', occupation: 'Nurse', phone_number: null, clinicid: '42' },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: pendingRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      let clickFn
      const mockBtn = {
        getAttribute: jest.fn(() => 'a@test.com'),
        addEventListener: jest.fn((evt, fn) => { clickFn = fn }),
      }
      global.document.querySelectorAll = jest.fn(() => [mockBtn])
      const ctrl = makeCtrl()
      ctrl.approveStaff = jest.fn(() => Promise.resolve(true))
      ctrl.renderStaffList = jest.fn(() => Promise.resolve())
      const pendingSpy = jest.spyOn(ctrl, 'renderPendingStaff')
      await ctrl.renderPendingStaff()  // call #1
      await clickFn()
      expect(ctrl.approveStaff).toHaveBeenCalledWith(pendingRows[0])
      expect(pendingSpy).toHaveBeenCalledTimes(2)
      expect(ctrl.renderStaffList).toHaveBeenCalledTimes(1)
    })
  })

  // ── renderPendingReceptionists ──────────────────────────────────────────────
  describe('renderPendingReceptionists', () => {
    test('returns early when container element is null', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      global.document.getElementById = jest.fn(() => null)
      await expect(makeCtrl().renderPendingReceptionists()).resolves.toBeUndefined()
    })

    test('shows empty-state message when no pending receptionist requests', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderPendingReceptionists()
      expect(container.innerHTML).toContain('No pending receptionist requests')
    })

    test('renders pending receptionist rows with clinic name and phone', async () => {
      const pendingRows = [
        { email: 'r@test.com', full_name: 'Rhonda', occupation: 'Receptionist', phone_number: '083999999', clinicid: '42', clinicname: 'Test Clinic' },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: pendingRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderPendingReceptionists()
      expect(container.innerHTML).toContain('Rhonda')
      expect(container.innerHTML).toContain('083999999')
      expect(container.innerHTML).toContain('Test Clinic')
    })

    test('omits phone row when phone_number is null', async () => {
      const pendingRows = [
        { email: 'r@test.com', full_name: 'Rhonda', occupation: null, phone_number: null, clinicid: '42', clinicname: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: pendingRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderPendingReceptionists()
      expect(container.innerHTML).not.toContain('Phone:')
    })

    test('attaches click listener to each approve-rec-btn', async () => {
      const pendingRows = [
        { email: 'r@test.com', full_name: 'Rhonda', occupation: null, phone_number: null, clinicid: '42', clinicname: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: pendingRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      const mockBtn = { getAttribute: jest.fn(() => 'r@test.com'), addEventListener: jest.fn() }
      global.document.querySelectorAll = jest.fn(() => [mockBtn])
      await makeCtrl().renderPendingReceptionists()
      expect(global.document.querySelectorAll).toHaveBeenCalledWith('.approve-rec-btn')
      expect(mockBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
    })

    test('calls approveReceptionist with matched item and re-renders on click', async () => {
      const pendingRows = [
        { email: 'r@test.com', full_name: 'Rhonda', occupation: null, phone_number: null, clinicid: '42', clinicname: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: pendingRows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      let clickFn
      const mockBtn = {
        getAttribute: jest.fn(() => 'r@test.com'),
        addEventListener: jest.fn((evt, fn) => { clickFn = fn }),
      }
      global.document.querySelectorAll = jest.fn(() => [mockBtn])
      const ctrl = makeCtrl()
      ctrl.approveReceptionist = jest.fn(() => Promise.resolve(true))
      const spy = jest.spyOn(ctrl, 'renderPendingReceptionists')
      await ctrl.renderPendingReceptionists()  // call #1
      await clickFn()
      expect(ctrl.approveReceptionist).toHaveBeenCalledWith(pendingRows[0])
      expect(spy).toHaveBeenCalledTimes(2)
    })
  })

  // ── renderReceptionistList ──────────────────────────────────────────────────
  describe('renderReceptionistList', () => {
    test('returns early when container element is null', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      global.document.getElementById = jest.fn(() => null)
      await expect(makeCtrl().renderReceptionistList()).resolves.toBeUndefined()
    })

    test('shows empty-state message when no receptionists', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderReceptionistList()
      expect(container.innerHTML).toContain('No receptionists')
    })

    test('renders receptionist rows with contacts', async () => {
      const rows = [
        { receptionist_id: 'REC-42-1', full_name: 'Rhonda', email: 'r@test.com', contacts: '083777777', occupation: 'Receptionist' },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: rows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderReceptionistList()
      expect(container.innerHTML).toContain('Rhonda')
      expect(container.innerHTML).toContain('083777777')
    })

    test('renders N/A for contacts when contacts is falsy', async () => {
      const rows = [
        { receptionist_id: 'REC-42-2', full_name: 'Jane', email: 'j@test.com', contacts: null, occupation: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: rows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      global.document.querySelectorAll = jest.fn(() => [])
      await makeCtrl().renderReceptionistList()
      expect(container.innerHTML).toContain('N/A')
    })

    test('attaches click listener to each remove-rec-btn', async () => {
      const rows = [
        { receptionist_id: 'REC-42-1', full_name: 'Rhonda', email: 'r@test.com', contacts: null, occupation: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: rows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      const mockBtn = { getAttribute: jest.fn(), addEventListener: jest.fn() }
      global.document.querySelectorAll = jest.fn(() => [mockBtn])
      await makeCtrl().renderReceptionistList()
      expect(global.document.querySelectorAll).toHaveBeenCalledWith('.remove-rec-btn')
      expect(mockBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
    })

    test('re-renders after successful remove', async () => {
      const rows = [
        { receptionist_id: 'REC-42-1', full_name: 'Rhonda', email: 'r@test.com', contacts: null, occupation: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: rows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      let clickFn
      const mockBtn = {
        getAttribute: jest.fn(attr => attr === 'data-id' ? 'REC-42-1' : 'Rhonda'),
        addEventListener: jest.fn((evt, fn) => { clickFn = fn }),
      }
      global.document.querySelectorAll = jest.fn(() => [mockBtn])
      const ctrl = makeCtrl()
      ctrl.removeReceptionist = jest.fn(() => Promise.resolve(true))
      const spy = jest.spyOn(ctrl, 'renderReceptionistList')
      await ctrl.renderReceptionistList()  // call #1
      await clickFn()                       // remove succeeds → renderReceptionistList() again
      expect(spy).toHaveBeenCalledTimes(2)
    })

    test('does not re-render when remove returns false', async () => {
      const rows = [
        { receptionist_id: 'REC-42-1', full_name: 'Rhonda', email: 'r@test.com', contacts: null, occupation: null },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: rows, error: null })) }
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(() => container)
      let clickFn
      const mockBtn = {
        getAttribute: jest.fn(attr => attr === 'data-id' ? 'REC-42-1' : 'Rhonda'),
        addEventListener: jest.fn((evt, fn) => { clickFn = fn }),
      }
      global.document.querySelectorAll = jest.fn(() => [mockBtn])
      const ctrl = makeCtrl()
      ctrl.removeReceptionist = jest.fn(() => Promise.resolve(false))
      const spy = jest.spyOn(ctrl, 'renderReceptionistList')
      await ctrl.renderReceptionistList()  // call #1
      await clickFn()                       // remove cancelled → no re-render
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  // ── renderClinicHeader ──────────────────────────────────────────────────────
  describe('renderClinicHeader', () => {
    test('renders HOSPITAL chip when type is "hospital"', () => {
      const ctrl = new AdminFacilitiesController('42', 'City Hospital', 'hospital', 'public', null, 'Gauteng')
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(id => id === 'dynamic-content' ? container : null)
      ctrl.renderClinicHeader()
      expect(container.innerHTML).toContain('HOSPITAL')
      expect(container.innerHTML).toContain('chip-hosp')
    })

    test('renders CLINIC / CHC chip when type is not "hospital"', () => {
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(id => id === 'dynamic-content' ? container : null)
      makeCtrl().renderClinicHeader()
      expect(container.innerHTML).toContain('CLINIC / CHC')
      expect(container.innerHTML).toContain('chip-clinic')
    })

    test('renders chip-public when sector is "public"', () => {
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(id => id === 'dynamic-content' ? container : null)
      makeCtrl().renderClinicHeader()
      expect(container.innerHTML).toContain('chip-public')
      expect(container.innerHTML).toContain('PUBLIC')
    })

    test('renders chip-private when sector is not "public"', () => {
      const ctrl = new AdminFacilitiesController('42', 'Private Clinic', 'clinic', 'private', null, 'Gauteng')
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(id => id === 'dynamic-content' ? container : null)
      ctrl.renderClinicHeader()
      expect(container.innerHTML).toContain('chip-private')
    })

    test('includes subtype in header when subtype is truthy', () => {
      const ctrl = new AdminFacilitiesController('42', 'Test Clinic', 'clinic', 'public', 'CHC', 'Gauteng')
      const container = { innerHTML: '' }
      global.document.getElementById = jest.fn(id => id === 'dynamic-content' ? container : null)
      ctrl.renderClinicHeader()
      expect(container.innerHTML).toContain('CHC')
    })

    test('updates current-clinic-display-rec textContent when element exists', () => {
      const container = { innerHTML: '' }
      const recDisplay = { textContent: '' }
      global.document.getElementById = jest.fn(id => {
        if (id === 'dynamic-content') return container
        if (id === 'current-clinic-display-rec') return recDisplay
        return null
      })
      makeCtrl().renderClinicHeader()
      expect(recDisplay.textContent).toBe('42')
    })
  })

  // ── renderActionCards ───────────────────────────────────────────────────────
  describe('renderActionCards', () => {
    test('calls insertAdjacentHTML with action card containing "Manage Hours"', () => {
      const container = { innerHTML: '', insertAdjacentHTML: jest.fn() }
      global.document.getElementById = jest.fn(() => container)
      makeCtrl().renderActionCards()
      expect(container.insertAdjacentHTML).toHaveBeenCalledWith('beforeend', expect.stringContaining('Manage Hours'))
    })

    test('includes clinic ID in the hours link href', () => {
      const container = { innerHTML: '', insertAdjacentHTML: jest.fn() }
      global.document.getElementById = jest.fn(() => container)
      makeCtrl().renderActionCards()
      const [, html] = container.insertAdjacentHTML.mock.calls[0]
      expect(html).toContain('clinicID=42')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  AdminHoursController
// ═══════════════════════════════════════════════════════════════════════════════

describe('AdminHoursController', () => {
  function makeHoursCtrl() {
    return new AdminHoursController('clinic-99')
  }

  beforeEach(() => { jest.clearAllMocks() })

  // ── isRowChanged ────────────────────────────────────────────────────────────
  describe('isRowChanged', () => {
    test('returns false when all fields are identical', () => {
      const ctrl = makeHoursCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      expect(ctrl.isRowChanged(0)).toBe(false)
    })

    test('returns true when opentime differs', () => {
      const ctrl = makeHoursCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '09:00:00', closingtime: '17:00:00', isopen: true }]
      expect(ctrl.isRowChanged(0)).toBe(true)
    })

    test('returns true when closingtime differs', () => {
      const ctrl = makeHoursCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '08:00:00', closingtime: '16:00:00', isopen: true }]
      expect(ctrl.isRowChanged(0)).toBe(true)
    })

    test('returns true when isopen toggles from true to false', () => {
      const ctrl = makeHoursCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: false }]
      expect(ctrl.isRowChanged(0)).toBe(true)
    })

    test('returns true when isopen toggles from false to true', () => {
      const ctrl = makeHoursCtrl()
      ctrl.originalHours = [{ opentime: null, closingtime: null, isopen: false }]
      ctrl.currentHours  = [{ opentime: '09:00:00', closingtime: '13:00:00', isopen: true }]
      expect(ctrl.isRowChanged(0)).toBe(true)
    })

    test('handles multiple rows independently', () => {
      const ctrl = makeHoursCtrl()
      ctrl.originalHours = [
        { opentime: '08:00:00', closingtime: '17:00:00', isopen: true },
        { opentime: null,       closingtime: null,       isopen: false },
      ]
      ctrl.currentHours = [
        { opentime: '09:00:00', closingtime: '17:00:00', isopen: true },  // changed
        { opentime: null,       closingtime: null,       isopen: false },  // unchanged
      ]
      expect(ctrl.isRowChanged(0)).toBe(true)
      expect(ctrl.isRowChanged(1)).toBe(false)
    })
  })

  // ── discardChanges ──────────────────────────────────────────────────────────
  describe('discardChanges', () => {
    test('resets currentHours to match originalHours', () => {
      const ctrl = makeHoursCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '10:00:00', closingtime: '15:00:00', isopen: false }]
      ctrl.renderHours   = jest.fn()

      ctrl.discardChanges()

      expect(ctrl.currentHours[0].opentime).toBe('08:00:00')
      expect(ctrl.currentHours[0].closingtime).toBe('17:00:00')
      expect(ctrl.currentHours[0].isopen).toBe(true)
    })

    test('creates independent copies so mutating currentHours does not affect originalHours', () => {
      const ctrl = makeHoursCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '10:00:00', closingtime: '15:00:00', isopen: false }]
      ctrl.renderHours   = jest.fn()

      ctrl.discardChanges()
      ctrl.currentHours[0].opentime = '07:00:00'

      expect(ctrl.originalHours[0].opentime).toBe('08:00:00')
    })

    test('calls renderHours after resetting', () => {
      const ctrl = makeHoursCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.renderHours   = jest.fn()

      ctrl.discardChanges()

      expect(ctrl.renderHours).toHaveBeenCalledTimes(1)
    })

    test('works with multiple rows', () => {
      const ctrl = makeHoursCtrl()
      ctrl.originalHours = [
        { opentime: '08:00:00', closingtime: '17:00:00', isopen: true },
        { opentime: null,       closingtime: null,       isopen: false },
      ]
      ctrl.currentHours = [
        { opentime: '09:00:00', closingtime: '16:00:00', isopen: true },
        { opentime: '10:00:00', closingtime: '14:00:00', isopen: true },
      ]
      ctrl.renderHours = jest.fn()

      ctrl.discardChanges()

      expect(ctrl.currentHours[0].opentime).toBe('08:00:00')
      expect(ctrl.currentHours[1].opentime).toBeNull()
      expect(ctrl.currentHours[1].isopen).toBe(false)
    })
  })

  // ── loadHours ───────────────────────────────────────────────────────────────
  describe('loadHours', () => {
    test('populates originalHours and currentHours from Supabase data', async () => {
      const dbRows = [
        { operatingid: 1, clinicid: 'clinic-99', day: 'Monday',
          opentime: '08:00:00', closingtime: '17:00:00', isopen: true },
        { operatingid: 2, clinicid: 'clinic-99', day: 'Tuesday',
          opentime: '08:00:00', closingtime: '17:00:00', isopen: true },
      ]
      global.supabase = {
        from: jest.fn(() => makeChain({ data: dbRows, error: null })),
      }
      const ctrl = makeHoursCtrl()

      await ctrl.loadHours()

      const monOrig = ctrl.originalHours.find(r => r.day === 'Monday')
      expect(monOrig).toBeDefined()
      expect(monOrig.opentime).toBe('08:00:00')
      expect(ctrl.currentHours).toHaveLength(ctrl.originalHours.length)
    })

    test('uses default hours when Supabase returns an error', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })),
      }
      const ctrl = makeHoursCtrl()

      await ctrl.loadHours()

      expect(ctrl.originalHours).toHaveLength(7)
    })

    test('uses default hours when Supabase returns empty data', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ data: [], error: null })),
      }
      const ctrl = makeHoursCtrl()

      await ctrl.loadHours()

      expect(ctrl.originalHours).toHaveLength(7)
    })

    test('currentHours starts as an independent copy of originalHours', async () => {
      const dbRows = [
        { operatingid: 1, clinicid: 'clinic-99', day: 'Monday',
          opentime: '08:00:00', closingtime: '17:00:00', isopen: true },
      ]
      global.supabase = {
        from: jest.fn(() => makeChain({ data: dbRows, error: null })),
      }
      const ctrl = makeHoursCtrl()
      await ctrl.loadHours()

      const monCurrent = ctrl.currentHours.find(r => r.day === 'Monday')
      monCurrent.opentime = '07:00:00'

      const monOrig = ctrl.originalHours.find(r => r.day === 'Monday')
      expect(monOrig.opentime).toBe('08:00:00')
    })
  })
})
