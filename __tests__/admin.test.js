'use strict'

/**
 * __tests__/admin.test.js
 * Tests for:
 *   backend/AdminFacilitiesController.js  — generateStaffId, loadStaff,
 *                                           loadPendingStaff, approveStaff
 *   backend/AdminHoursController.js       — isRowChanged, discardChanges,
 *                                           loadHours
 *
 * Both files are browser-global scripts (no exports) that reference a global
 * `supabase` variable.  We set global.supabase before each test that needs it.
 */

const fs   = require('fs')
const path = require('path')

// ─── Shared globals both controllers need ───────────────────────────────────
global.supabase = null   // overridden per test
global.confirm  = jest.fn(() => true)   // auto-accept confirmation dialogs

global.DAY_NAMES = [
  'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday',
]
// Fallback row used in AdminHoursController.loadHours when a day is missing
// from the Supabase result set.
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

// ─── Load controllers ────────────────────────────────────────────────────────
// Evaluate each browser-global script inside an IIFE so classes are returned
// into this module's scope.  Method closures resolve `supabase`, `DAY_NAMES`,
// etc. through the scope chain at call time (→ global).
const _facCode = fs.readFileSync(
  path.join(__dirname, '../backend/AdminFacilitiesController.js'), 'utf8'
)
// eslint-disable-next-line no-eval
const AdminFacilitiesController = eval(
  `(function() { ${_facCode}; return AdminFacilitiesController; })()`
)

const _hoursCode = fs.readFileSync(
  path.join(__dirname, '../backend/AdminHoursController.js'), 'utf8'
)
// eslint-disable-next-line no-eval
const AdminHoursController = eval(
  `(function() { ${_hoursCode}; return AdminHoursController; })()`
)

// ─── Supabase chain helper ───────────────────────────────────────────────────
// Returns a mock chain object that is "thenable" — awaiting it resolves to
// `resolvedValue` regardless of which builder method is last.
function makeChain(resolvedValue) {
  const then = (resolve) => Promise.resolve(resolvedValue).then(resolve)
  const chain = { then }
  ;['select','eq','or','not','limit','insert','update','delete','order'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AdminFacilitiesController
// ═══════════════════════════════════════════════════════════════════════════════

describe('AdminFacilitiesController', () => {
  function makeCtrl() {
    return new AdminFacilitiesController(
      '42', 'Test Clinic', 'clinic', 'public', null, 'Gauteng'
    )
  }

  beforeEach(() => { jest.clearAllMocks() })

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
      // First from('Staff') call: generateStaffId query (no existing)
      // Second from('Staff') call: insert
      // Third from('pending_staff'): update status to approved
      let fromCallCount = 0
      global.supabase = {
        from: jest.fn(() => {
          fromCallCount++
          if (fromCallCount === 1) return makeChain({ data: [], error: null }) // generateStaffId
          if (fromCallCount === 2) return makeChain({ data: null, error: null }) // insert
          return makeChain({ data: null, error: null }) // pending update
        }),
        showToast: jest.fn(),
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
      ctrl.renderHours   = jest.fn()  // stub DOM-touching method

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

      // defaultHoursMap stub provides 7 days → 7 rows in a map structure
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
