'use strict'

// ─── Supabase mock ────────────────────────────────────────────────────────────
jest.mock('../backend/supabase.js', () => {
  const m = {}
  Object.defineProperty(m, 'supabase', { get: () => global.supabase, enumerable: true })
  return m
})

// ─── Chain helper (defined before require so auto-execute can use it) ─────────
function makeChain(resolvedValue) {
  const chain = { then: resolve => Promise.resolve(resolvedValue).then(resolve) }
  ;['select', 'eq', 'update', 'insert', 'order'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

// ─── Browser globals (set before require so auto-execute succeeds) ────────────
// Auto-execute calls:
//   document.getElementById('hoursForm').addEventListener(...)
//   controller.loadHours()  →  supabase.from(...).select().eq()
global.location       = { search: '' }
global.URLSearchParams = URLSearchParams
global.alert          = jest.fn()

global.document = {
  getElementById:  jest.fn(id => ({
    innerHTML:       '',
    style:           { display: '' },
    addEventListener: jest.fn(),
  })),
  querySelector:    jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
}

// Supabase must be set before the require so the auto-execute loadHours() succeeds
global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }

// ─── Load module ──────────────────────────────────────────────────────────────
const { TableAdminController } = require('../backend/tableAdmin.js')

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeCtrl(clinicID = '42') {
  // Temporarily set location.search so URLSearchParams returns the given clinic
  const originalSearch = global.location.search
  global.location.search = `?clinicID=${clinicID}`
  const ctrl = new TableAdminController()
  global.location.search = originalSearch
  return ctrl
}

// Build a querySelector mock that returns inputs for the given day/field map.
// dayFields: { Monday: { opentime: '08:00', closingtime: '17:00', isopen: true }, ... }
function makeQuerySelector(dayFields) {
  return jest.fn((selector) => {
    const dayMatch   = selector.match(/data-day="([^"]+)"/)
    const fieldMatch = selector.match(/data-field="([^"]+)"/)
    if (!dayMatch || !fieldMatch) return null
    const [, day]   = dayMatch
    const [, field] = fieldMatch
    const dayData = dayFields[day]
    if (!dayData) return null
    if (field === 'isopen')      return { checked: dayData.isopen }
    if (field === 'opentime')    return { value: dayData.opentime  ?? '' }
    if (field === 'closingtime') return { value: dayData.closingtime ?? '' }
    return null
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
describe('TableAdminController (tableAdmin.js)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.alert  = jest.fn()
    global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
    global.document.getElementById  = jest.fn(() => ({ innerHTML: '', style: {}, addEventListener: jest.fn() }))
    global.document.querySelector   = jest.fn(() => null)
    global.document.querySelectorAll = jest.fn(() => [])
  })

  // ── constructor ───────────────────────────────────────────────────────────────
  describe('constructor', () => {
    test('reads clinicID from the URL query string', () => {
      const ctrl = makeCtrl('99')
      expect(ctrl.clinicID).toBe('99')
    })

    test('sets clinicID to null when not present in URL', () => {
      const ctrl = makeCtrl('')
      // URLSearchParams('?clinicID=') returns '' which is falsy but not null
      // makeCtrl with empty string → '?clinicID=' → get returns ''
      expect(ctrl.clinicID === null || ctrl.clinicID === '').toBe(true)
    })
  })

  // ── loadHours ────────────────────────────────────────────────────────────────
  describe('loadHours', () => {
    test('returns early without touching the DOM on Supabase error', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })) }
      const ctrl = makeCtrl()
      global.document.querySelector = jest.fn(() => null)
      await ctrl.loadHours()
      // querySelector should not have been called for day inputs
      expect(global.document.querySelector).not.toHaveBeenCalled()
    })

    test('does not update DOM when Supabase returns empty data', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const ctrl = makeCtrl()
      const querySpy = jest.fn(() => null)
      global.document.querySelector = querySpy
      await ctrl.loadHours()
      expect(querySpy).not.toHaveBeenCalled()
    })

    test('populates opentime and closingtime inputs from DB rows', async () => {
      const rows = [
        { day: 'Monday', opentime: '08:00:00', closingtime: '17:00:00', isopen: true },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: rows, error: null })) }
      const ctrl = makeCtrl()

      const openInput    = { value: '' }
      const closeInput   = { value: '' }
      const isOpenInput  = { checked: false }

      global.document.querySelector = jest.fn(selector => {
        if (selector.includes('data-day="Monday"') && selector.includes('data-field="opentime"'))    return openInput
        if (selector.includes('data-day="Monday"') && selector.includes('data-field="closingtime"')) return closeInput
        if (selector.includes('data-day="Monday"') && selector.includes('data-field="isopen"'))      return isOpenInput
        return null
      })

      await ctrl.loadHours()

      expect(openInput.value).toBe('08:00')
      expect(closeInput.value).toBe('17:00')
      expect(isOpenInput.checked).toBe(true)
    })

    test('sets opentime input to empty string when opentime is null', async () => {
      const rows = [{ day: 'Sunday', opentime: null, closingtime: null, isopen: false }]
      global.supabase = { from: jest.fn(() => makeChain({ data: rows, error: null })) }
      const ctrl = makeCtrl()

      const openInput   = { value: 'existing' }
      const closeInput  = { value: 'existing' }
      const isOpenInput = { checked: true }

      global.document.querySelector = jest.fn(selector => {
        if (selector.includes('data-day="Sunday"') && selector.includes('data-field="opentime"'))    return openInput
        if (selector.includes('data-day="Sunday"') && selector.includes('data-field="closingtime"')) return closeInput
        if (selector.includes('data-day="Sunday"') && selector.includes('data-field="isopen"'))      return isOpenInput
        return null
      })

      await ctrl.loadHours()

      expect(openInput.value).toBe('')
      expect(closeInput.value).toBe('')
      expect(isOpenInput.checked).toBe(false)
    })
  })

  // ── saveHours ────────────────────────────────────────────────────────────────
  describe('saveHours', () => {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    function makeSaveBtn() {
      return { disabled: false, textContent: 'Save Changes' }
    }

    function setupSaveDom(dayFields, saveBtn = makeSaveBtn()) {
      global.document.getElementById = jest.fn(id => id === 'saveBtn' ? saveBtn : null)
      global.document.querySelector  = makeQuerySelector(dayFields)
      return saveBtn
    }

    // Build a dayFields map where all 7 days use the same settings
    function allDays(settings) {
      return Object.fromEntries(DAYS.map(d => [d, settings]))
    }

    test('calls alert with success message when all days save without error', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ error: null })) }
      const ctrl = makeCtrl('42')
      setupSaveDom(allDays({ opentime: '08:00', closingtime: '17:00', isopen: true }))
      const fakeEvent = { preventDefault: jest.fn() }
      await ctrl.saveHours(fakeEvent)
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('saved successfully'))
    })

    test('uses null payload for closed days (isopen = false)', async () => {
      let capturedPayload
      global.supabase = {
        from: jest.fn(() => {
          const chain = makeChain({ error: null })
          chain.update = jest.fn(payload => { capturedPayload = payload; return makeChain({ error: null }) })
          return chain
        }),
      }
      const ctrl = makeCtrl('42')
      setupSaveDom(allDays({ opentime: '', closingtime: '', isopen: false }))
      await ctrl.saveHours({ preventDefault: jest.fn() })
      expect(capturedPayload).toEqual({ opentime: null, closingtime: null, isopen: false })
    })

    test('adds an error for a day where open time is not before close time', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ error: null })) }
      const ctrl = makeCtrl('42')
      // Monday has open >= close — should generate a validation error
      const dayFields = {
        ...allDays({ opentime: '08:00', closingtime: '17:00', isopen: true }),
        Monday: { opentime: '17:00', closingtime: '08:00', isopen: true },
      }
      setupSaveDom(dayFields)
      await ctrl.saveHours({ preventDefault: jest.fn() })
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Monday'))
    })

    test('adds an error for an open day with missing time values', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ error: null })) }
      const ctrl = makeCtrl('42')
      const dayFields = {
        ...allDays({ opentime: '08:00', closingtime: '17:00', isopen: true }),
        Tuesday: { opentime: '', closingtime: '', isopen: true },  // open but times missing
      }
      setupSaveDom(dayFields)
      await ctrl.saveHours({ preventDefault: jest.fn() })
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Tuesday'))
    })

    test('adds an error when Supabase update fails for a day', async () => {
      global.supabase = {
        from: jest.fn(() => makeChain({ error: { message: 'DB write failed' } })),
      }
      const ctrl = makeCtrl('42')
      setupSaveDom(allDays({ opentime: '08:00', closingtime: '17:00', isopen: true }))
      await ctrl.saveHours({ preventDefault: jest.fn() })
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('DB write failed'))
    })

    test('re-enables the save button regardless of success or failure', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ error: null })) }
      const ctrl = makeCtrl('42')
      const saveBtn = setupSaveDom(allDays({ opentime: '08:00', closingtime: '17:00', isopen: true }))
      saveBtn.disabled = true
      await ctrl.saveHours({ preventDefault: jest.fn() })
      expect(saveBtn.disabled).toBe(false)
      expect(saveBtn.textContent).toBe('Save Changes')
    })
  })
})
