'use strict'

// ─── Supabase mock ────────────────────────────────────────────────────────────
jest.mock('../backend/supabase.js', () => {
  const m = {}
  Object.defineProperty(m, 'supabase', { get: () => global.supabase, enumerable: true })
  return m
})

// ─── Browser globals (set before require so auto-execute succeeds) ────────────
// Auto-execute: clinicID is null → init() → renderError() → app.innerHTML = ...
global.location       = { search: '' }
global.URLSearchParams = URLSearchParams
global.document = {
  getElementById:   jest.fn(() => ({ innerHTML: '', insertAdjacentHTML: jest.fn() })),
  querySelector:    jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
}
global.supabase = null

// ─── Load module ──────────────────────────────────────────────────────────────
const { AdminHoursController } = require('../backend/Admin.js')

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeChain(resolvedValue) {
  const chain = { then: resolve => Promise.resolve(resolvedValue).then(resolve) }
  ;['select', 'eq', 'order', 'insert', 'update', 'not', 'limit'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

function makeCtrl(opts = {}) {
  return new AdminHoursController(
    opts.clinicID   ?? '42',
    opts.clinicName ?? 'Test Clinic',
    opts.type       ?? 'clinic',
    opts.sector     ?? 'public',
    opts.subtype    ?? '',
    opts.province   ?? 'Gauteng'
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
describe('AdminHoursController (Admin.js)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.supabase = null
    global.document.getElementById   = jest.fn(() => ({ innerHTML: '', insertAdjacentHTML: jest.fn() }))
    global.document.querySelector    = jest.fn(() => null)
    global.document.querySelectorAll = jest.fn(() => [])
  })

  // ── escapeHtml ───────────────────────────────────────────────────────────────
  describe('escapeHtml', () => {
    test('returns empty string for falsy input', () => {
      const ctrl = makeCtrl()
      expect(ctrl.escapeHtml(null)).toBe('')
      expect(ctrl.escapeHtml(undefined)).toBe('')
      expect(ctrl.escapeHtml('')).toBe('')
    })

    test('escapes &, <, >, and "', () => {
      const ctrl = makeCtrl()
      expect(ctrl.escapeHtml('a & b')).toBe('a &amp; b')
      expect(ctrl.escapeHtml('<b>')).toBe('&lt;b&gt;')
      expect(ctrl.escapeHtml('"hi"')).toBe('&quot;hi&quot;')
    })

    test('leaves plain strings unchanged', () => {
      expect(makeCtrl().escapeHtml('hello world')).toBe('hello world')
    })
  })

  // ── generateTimeOptions ──────────────────────────────────────────────────────
  describe('generateTimeOptions', () => {
    test('includes options from 06:00 to 20:30', () => {
      const html = makeCtrl().generateTimeOptions(null)
      expect(html).toContain('value="06:00:00"')
      expect(html).toContain('value="20:30:00"')
    })

    test('marks only the matching time as selected', () => {
      const html = makeCtrl().generateTimeOptions('08:00:00')
      expect(html).toContain('value="08:00:00" selected')
      expect((html.match(/ selected/g) || []).length).toBe(1)
    })

    test('generates options in 30-minute increments', () => {
      const html = makeCtrl().generateTimeOptions(null)
      expect(html).toContain('value="08:00:00"')
      expect(html).toContain('value="08:30:00"')
      expect(html).not.toContain('value="08:15:00"')
    })

    test('marks no option selected when selected is null', () => {
      const html = makeCtrl().generateTimeOptions(null)
      expect(html).not.toContain(' selected')
    })
  })

  // ── isRowChanged ─────────────────────────────────────────────────────────────
  describe('isRowChanged', () => {
    test('returns false when all fields match originalHours', () => {
      const ctrl = makeCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      expect(ctrl.isRowChanged(0)).toBe(false)
    })

    test('returns true when opentime differs', () => {
      const ctrl = makeCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '09:00:00', closingtime: '17:00:00', isopen: true }]
      expect(ctrl.isRowChanged(0)).toBe(true)
    })

    test('returns true when closingtime differs', () => {
      const ctrl = makeCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '08:00:00', closingtime: '16:00:00', isopen: true }]
      expect(ctrl.isRowChanged(0)).toBe(true)
    })

    test('returns true when isopen toggles', () => {
      const ctrl = makeCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: false }]
      expect(ctrl.isRowChanged(0)).toBe(true)
    })

    test('checks the correct index when multiple rows exist', () => {
      const ctrl = makeCtrl()
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

  // ── loadHours ────────────────────────────────────────────────────────────────
  describe('loadHours', () => {
    test('maps DB rows to originalHours and clones them into currentHours', async () => {
      const dbRows = [
        { day: 'Monday',    opentime: '08:00:00', closingtime: '17:00:00', isopen: true },
        { day: 'Wednesday', opentime: '09:00:00', closingtime: '16:00:00', isopen: true },
      ]
      global.supabase = { from: jest.fn(() => makeChain({ data: dbRows, error: null })) }
      const ctrl = makeCtrl()
      await ctrl.loadHours()
      const mon = ctrl.originalHours.find(r => r.day === 'Monday')
      expect(mon).toBeDefined()
      expect(mon.opentime).toBe('08:00:00')
      expect(ctrl.currentHours).toHaveLength(ctrl.originalHours.length)
    })

    test('falls back to 7-day defaults on Supabase error', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: null, error: { message: 'DB error' } })) }
      const ctrl = makeCtrl()
      await ctrl.loadHours()
      expect(ctrl.originalHours).toHaveLength(7)
    })

    test('falls back to defaults when Supabase returns empty array', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const ctrl = makeCtrl()
      await ctrl.loadHours()
      expect(ctrl.originalHours).toHaveLength(7)
    })

    test('defaults Saturday to 09:00–13:00 and open', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const ctrl = makeCtrl()
      await ctrl.loadHours()
      const sat = ctrl.originalHours.find(r => r.day === 'Saturday')
      expect(sat.opentime).toBe('09:00:00')
      expect(sat.closingtime).toBe('13:00:00')
      expect(sat.isopen).toBe(true)
    })

    test('defaults Sunday to closed with null times', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const ctrl = makeCtrl()
      await ctrl.loadHours()
      const sun = ctrl.originalHours.find(r => r.day === 'Sunday')
      expect(sun.isopen).toBe(false)
      expect(sun.closingtime).toBeNull()
    })

    test('currentHours is an independent copy so mutations do not affect originalHours', async () => {
      global.supabase = { from: jest.fn(() => makeChain({ data: [], error: null })) }
      const ctrl = makeCtrl()
      await ctrl.loadHours()
      ctrl.currentHours[0].opentime = '10:00:00'
      expect(ctrl.originalHours[0].opentime).not.toBe('10:00:00')
    })
  })

  // ── discardChanges ───────────────────────────────────────────────────────────
  describe('discardChanges', () => {
    function makeDiscardCtrl() {
      const ctrl = makeCtrl()
      ctrl.originalHours        = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours         = [{ opentime: '10:00:00', closingtime: '15:00:00', isopen: false }]
      ctrl.renderHours          = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      ctrl.showToast            = jest.fn()
      return ctrl
    }

    test('resets currentHours values to match originalHours', () => {
      const ctrl = makeDiscardCtrl()
      ctrl.discardChanges()
      expect(ctrl.currentHours[0].opentime).toBe('08:00:00')
      expect(ctrl.currentHours[0].isopen).toBe(true)
    })

    test('creates independent copies so further edits leave originalHours intact', () => {
      const ctrl = makeDiscardCtrl()
      ctrl.discardChanges()
      ctrl.currentHours[0].opentime = '12:00:00'
      expect(ctrl.originalHours[0].opentime).toBe('08:00:00')
    })

    test('calls renderHours, attachEventListeners, and shows discard toast', () => {
      const ctrl = makeDiscardCtrl()
      ctrl.discardChanges()
      expect(ctrl.renderHours).toHaveBeenCalledTimes(1)
      expect(ctrl.attachEventListeners).toHaveBeenCalledTimes(1)
      expect(ctrl.showToast).toHaveBeenCalledWith('Changes discarded', 'success')
    })
  })

  // ── handleTimeChange ─────────────────────────────────────────────────────────
  describe('handleTimeChange', () => {
    test('updates the targeted field in currentHours and re-renders', () => {
      const ctrl = makeCtrl()
      ctrl.currentHours         = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.renderHours          = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      ctrl.handleTimeChange({
        target: {
          getAttribute: jest.fn(a => a === 'data-day-index' ? '0' : 'opentime'),
          value: '09:00:00',
        }
      })
      expect(ctrl.currentHours[0].opentime).toBe('09:00:00')
      expect(ctrl.renderHours).toHaveBeenCalledTimes(1)
    })

    test('does nothing when data-day-index attribute is missing', () => {
      const ctrl = makeCtrl()
      ctrl.currentHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.renderHours  = jest.fn()
      ctrl.handleTimeChange({ target: { getAttribute: jest.fn(() => null), value: '09:00:00' } })
      expect(ctrl.renderHours).not.toHaveBeenCalled()
    })
  })

  // ── handleToggle ─────────────────────────────────────────────────────────────
  describe('handleToggle', () => {
    test('flips isopen on the specified row and re-renders', () => {
      const ctrl = makeCtrl()
      ctrl.currentHours         = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.renderHours          = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      ctrl.handleToggle({ target: { getAttribute: jest.fn(() => '0') } })
      expect(ctrl.currentHours[0].isopen).toBe(false)
      expect(ctrl.renderHours).toHaveBeenCalledTimes(1)
    })

    test('does nothing when data-day-index attribute is missing', () => {
      const ctrl = makeCtrl()
      ctrl.currentHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.renderHours  = jest.fn()
      ctrl.handleToggle({ target: { getAttribute: jest.fn(() => null) } })
      expect(ctrl.renderHours).not.toHaveBeenCalled()
    })
  })

  // ── addStaff ─────────────────────────────────────────────────────────────────
  describe('addStaff', () => {
    function setupStaffDom(name = '', role = '') {
      const nameInput = { value: name }
      const roleInput = { value: role }
      global.document.getElementById = jest.fn(id => {
        if (id === 'staff-name') return nameInput
        if (id === 'staff-role') return roleInput
        return { innerHTML: '', insertAdjacentHTML: jest.fn() }
      })
      return { nameInput, roleInput }
    }

    test('shows error toast and does not add when name or role is blank', () => {
      setupStaffDom('', '')
      const ctrl = makeCtrl()
      ctrl.showToast = jest.fn()
      ctrl.addStaff()
      expect(ctrl.showToast).toHaveBeenCalledWith('Enter both name and role', 'error')
      expect(ctrl.staffList).toHaveLength(0)
    })

    test('adds member to staffList and shows success toast', () => {
      setupStaffDom('Dr. Smith', 'Doctor')
      const ctrl = makeCtrl()
      ctrl.showToast            = jest.fn()
      ctrl.renderStaff          = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      ctrl.addStaff()
      expect(ctrl.staffList).toHaveLength(1)
      expect(ctrl.staffList[0].name).toBe('Dr. Smith')
      expect(ctrl.staffList[0].role).toBe('Doctor')
      expect(ctrl.showToast).toHaveBeenCalledWith('Staff member added', 'success')
    })

    test('clears input fields after adding', () => {
      const { nameInput, roleInput } = setupStaffDom('Dr. Smith', 'Doctor')
      const ctrl = makeCtrl()
      ctrl.showToast            = jest.fn()
      ctrl.renderStaff          = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      ctrl.addStaff()
      expect(nameInput.value).toBe('')
      expect(roleInput.value).toBe('')
    })

    test('auto-increments id for each new member', () => {
      setupStaffDom('Alice', 'Nurse')
      const ctrl = makeCtrl()
      ctrl.showToast            = jest.fn()
      ctrl.renderStaff          = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      const firstId = ctrl.nextStaffId
      ctrl.addStaff()
      setupStaffDom('Bob', 'Doctor')
      ctrl.addStaff()
      expect(ctrl.staffList[0].id).toBe(firstId)
      expect(ctrl.staffList[1].id).toBe(firstId + 1)
    })
  })

  // ── removeStaff ──────────────────────────────────────────────────────────────
  describe('removeStaff', () => {
    test('removes the member with the matching id', () => {
      const ctrl = makeCtrl()
      ctrl.staffList            = [{ id: 1, name: 'Alice', role: 'Doctor' }, { id: 2, name: 'Bob', role: 'Nurse' }]
      ctrl.renderStaff          = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      ctrl.showToast            = jest.fn()
      ctrl.removeStaff(1)
      expect(ctrl.staffList).toHaveLength(1)
      expect(ctrl.staffList[0].id).toBe(2)
    })

    test('shows success toast and does not affect remaining members', () => {
      const ctrl = makeCtrl()
      ctrl.staffList            = [{ id: 1, name: 'Alice', role: 'Doctor' }, { id: 2, name: 'Bob', role: 'Nurse' }]
      ctrl.renderStaff          = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      ctrl.showToast            = jest.fn()
      ctrl.removeStaff(1)
      expect(ctrl.showToast).toHaveBeenCalledWith('Staff member removed', 'success')
      expect(ctrl.staffList[0].name).toBe('Bob')
    })
  })

  // ── updateSaveBar ────────────────────────────────────────────────────────────
  describe('updateSaveBar', () => {
    function makeSaveBarDom() {
      const badge      = { textContent: '', style: { display: 'none' } }
      const saveBtn    = { disabled: true }
      const discardBtn = { style: { display: 'none' } }
      global.document.getElementById = jest.fn(id => ({
        'change-badge':   badge,
        'save-hours-btn': saveBtn,
        'discard-btn':    discardBtn,
      }[id] ?? null))
      return { badge, saveBtn, discardBtn }
    }

    test('enables save button and shows badge when rows have changed', () => {
      const { badge, saveBtn, discardBtn } = makeSaveBarDom()
      const ctrl = makeCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '09:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.updateSaveBar()
      expect(saveBtn.disabled).toBe(false)
      expect(badge.style.display).toBe('inline-block')
      expect(discardBtn.style.display).toBe('inline-block')
    })

    test('disables save button and hides badge when nothing has changed', () => {
      const { badge, saveBtn, discardBtn } = makeSaveBarDom()
      const ctrl = makeCtrl()
      ctrl.originalHours = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.updateSaveBar()
      expect(saveBtn.disabled).toBe(true)
      expect(badge.style.display).toBe('none')
      expect(discardBtn.style.display).toBe('none')
    })

    test('badge text shows the number of unsaved changes', () => {
      const { badge } = makeSaveBarDom()
      const ctrl = makeCtrl()
      ctrl.originalHours = [
        { opentime: '08:00:00', closingtime: '17:00:00', isopen: true },
        { opentime: '08:00:00', closingtime: '17:00:00', isopen: true },
      ]
      ctrl.currentHours = [
        { opentime: '09:00:00', closingtime: '17:00:00', isopen: true },
        { opentime: '10:00:00', closingtime: '17:00:00', isopen: true },
      ]
      ctrl.updateSaveBar()
      expect(badge.textContent).toContain('2')
    })
  })

  // ── saveHours ────────────────────────────────────────────────────────────────
  describe('saveHours', () => {
    function makeSaveCtrl() {
      const saveBtn = { disabled: false, textContent: 'Save changes' }
      global.document.getElementById   = jest.fn(id => id === 'save-hours-btn' ? saveBtn : null)
      global.document.querySelectorAll  = jest.fn(() => [])
      const ctrl = makeCtrl()
      ctrl.renderHours          = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      ctrl.showToast            = jest.fn()
      ctrl.updateSaveBar        = jest.fn()
      ctrl.loadHours            = jest.fn(() => Promise.resolve())
      return { ctrl, saveBtn }
    }

    test('calls insert for a new row (no operatingid) and toasts success', async () => {
      const { ctrl } = makeSaveCtrl()
      global.supabase = { from: jest.fn(() => makeChain({ error: null })) }
      ctrl.originalHours = [{ operatingid: null, day: 'Monday', opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ operatingid: null, day: 'Monday', opentime: '09:00:00', closingtime: '17:00:00', isopen: true }]
      await ctrl.saveHours()
      expect(global.supabase.from).toHaveBeenCalledWith('operating_hours')
      expect(ctrl.showToast).toHaveBeenCalledWith('Operating hours saved successfully', 'success')
    })

    test('calls update for an existing row (has operatingid) and toasts success', async () => {
      const { ctrl } = makeSaveCtrl()
      let updateCalled = false
      global.supabase = {
        from: jest.fn(() => {
          const chain = makeChain({ error: null })
          chain.update = jest.fn(() => { updateCalled = true; return makeChain({ error: null }) })
          return chain
        }),
      }
      ctrl.originalHours = [{ operatingid: 5, day: 'Monday', opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ operatingid: 5, day: 'Monday', opentime: '09:00:00', closingtime: '17:00:00', isopen: true }]
      await ctrl.saveHours()
      expect(updateCalled).toBe(true)
      expect(ctrl.showToast).toHaveBeenCalledWith('Operating hours saved successfully', 'success')
    })

    test('toasts failure when a Supabase call returns an error', async () => {
      const { ctrl } = makeSaveCtrl()
      global.supabase = { from: jest.fn(() => makeChain({ error: { message: 'DB error' } })) }
      ctrl.originalHours = [{ operatingid: 5, day: 'Monday', opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ operatingid: 5, day: 'Monday', opentime: '09:00:00', closingtime: '17:00:00', isopen: true }]
      await ctrl.saveHours()
      expect(ctrl.showToast).toHaveBeenCalledWith('Some changes failed to save', 'error')
    })

    test('skips unchanged rows and still toasts success', async () => {
      const { ctrl } = makeSaveCtrl()
      global.supabase = { from: jest.fn(() => makeChain({ error: null })) }
      ctrl.originalHours = [{ operatingid: 5, day: 'Monday', opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ operatingid: 5, day: 'Monday', opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      await ctrl.saveHours()
      expect(global.supabase.from).not.toHaveBeenCalled()
      expect(ctrl.showToast).toHaveBeenCalledWith('Operating hours saved successfully', 'success')
    })
  })

  // ── showToast ────────────────────────────────────────────────────────────────
  describe('showToast', () => {
    test('sets textContent and className on the toast element', () => {
      const toast = { textContent: '', className: '' }
      global.document.getElementById = jest.fn(id => id === 'toast' ? toast : null)
      jest.useFakeTimers()
      makeCtrl().showToast('Hello', 'success')
      expect(toast.textContent).toBe('Hello')
      expect(toast.className).toBe('toast success')
      jest.useRealTimers()
    })

    test('resets className to "toast" after 3 seconds', () => {
      const toast = { textContent: '', className: '' }
      global.document.getElementById = jest.fn(id => id === 'toast' ? toast : null)
      jest.useFakeTimers()
      makeCtrl().showToast('Oops', 'error')
      jest.advanceTimersByTime(3000)
      expect(toast.className).toBe('toast')
      jest.useRealTimers()
    })
  })

  // ── renderHours ──────────────────────────────────────────────────────────────
  describe('renderHours', () => {
    function makeHoursDom(panelExists = false) {
      const app       = { innerHTML: '', insertAdjacentHTML: jest.fn() }
      const container = { innerHTML: '' }
      const badge     = { textContent: '', style: { display: '' } }
      const saveBtn   = { disabled: true }
      const discardBtn = { style: { display: '' } }
      global.document.querySelector    = jest.fn(sel => sel === '.panel:first-child' ? (panelExists ? {} : null) : null)
      global.document.getElementById   = jest.fn(id => ({ app, 'hours-container': container, 'change-badge': badge, 'save-hours-btn': saveBtn, 'discard-btn': discardBtn }[id] ?? null))
      global.document.querySelectorAll = jest.fn(() => [])
      return { app, container }
    }

    test('calls insertAdjacentHTML on first render when no panel exists', () => {
      const { app } = makeHoursDom(false)
      const ctrl = makeCtrl()
      ctrl.originalHours = ctrl.currentHours = [{ day: 'Monday', opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.renderHours()
      expect(app.insertAdjacentHTML).toHaveBeenCalled()
    })

    test('updates hours-container innerHTML when panel already exists', () => {
      const { container } = makeHoursDom(true)
      const ctrl = makeCtrl()
      ctrl.originalHours = ctrl.currentHours = [{ day: 'Monday', opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.renderHours()
      expect(container.innerHTML).toContain('Monday')
    })

    test('renders "Closed" text for a closed day', () => {
      const { container } = makeHoursDom(true)
      const ctrl = makeCtrl()
      ctrl.originalHours = ctrl.currentHours = [{ day: 'Sunday', opentime: null, closingtime: null, isopen: false }]
      ctrl.renderHours()
      expect(container.innerHTML).toContain('Closed')
    })

    test('marks a row with "changed" class when it differs from original', () => {
      const { container } = makeHoursDom(true)
      const ctrl = makeCtrl()
      ctrl.originalHours = [{ day: 'Monday', opentime: '08:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.currentHours  = [{ day: 'Monday', opentime: '09:00:00', closingtime: '17:00:00', isopen: true }]
      ctrl.renderHours()
      expect(container.innerHTML).toContain('changed')
    })
  })

  // ── renderStaff ──────────────────────────────────────────────────────────────
  describe('renderStaff', () => {
    test('calls insertAdjacentHTML when no staff panel exists yet', () => {
      const app = { innerHTML: '', insertAdjacentHTML: jest.fn() }
      global.document.querySelector    = jest.fn(() => null)
      global.document.querySelectorAll = jest.fn(() => [])
      global.document.getElementById  = jest.fn(id => id === 'app' ? app : null)
      makeCtrl().renderStaff()
      expect(app.insertAdjacentHTML).toHaveBeenCalled()
    })

    test('updates staff-container when staff panel already exists', () => {
      const container = { innerHTML: '' }
      global.document.querySelector    = jest.fn(() => ({}))
      global.document.querySelectorAll = jest.fn(() => [{}, {}])
      global.document.getElementById  = jest.fn(id => id === 'staff-container' ? container : null)
      const ctrl = makeCtrl()
      ctrl.staffList = [{ id: 1, name: 'Dr. Smith', role: 'Doctor' }]
      ctrl.renderStaff()
      expect(container.innerHTML).toContain('Dr. Smith')
    })

    test('shows empty-state message when staffList is empty', () => {
      const container = { innerHTML: '' }
      global.document.querySelector    = jest.fn(() => ({}))
      global.document.querySelectorAll = jest.fn(() => [{}, {}])
      global.document.getElementById  = jest.fn(id => id === 'staff-container' ? container : null)
      makeCtrl().renderStaff()
      expect(container.innerHTML).toContain('No staff members yet')
    })

    test('renders initials avatar from staff name', () => {
      const container = { innerHTML: '' }
      global.document.querySelector    = jest.fn(() => ({}))
      global.document.querySelectorAll = jest.fn(() => [{}, {}])
      global.document.getElementById  = jest.fn(id => id === 'staff-container' ? container : null)
      const ctrl = makeCtrl()
      ctrl.staffList = [{ id: 1, name: 'Alice Brown', role: 'Nurse' }]
      ctrl.renderStaff()
      expect(container.innerHTML).toContain('AB')
    })
  })

  // ── handleRemoveStaff ────────────────────────────────────────────────────────
  describe('handleRemoveStaff', () => {
    test('calls removeStaff with the parsed integer from data-staff-id', () => {
      const ctrl = makeCtrl()
      ctrl.removeStaff = jest.fn()
      ctrl.handleRemoveStaff({ target: { getAttribute: jest.fn(() => '7') } })
      expect(ctrl.removeStaff).toHaveBeenCalledWith(7)
    })
  })

  // ── attachEventListeners ─────────────────────────────────────────────────────
  describe('attachEventListeners', () => {
    test('attaches event listeners to time-sel, toggle-btn, and action buttons', () => {
      const timeSel    = { removeEventListener: jest.fn(), addEventListener: jest.fn() }
      const toggleBtn  = { removeEventListener: jest.fn(), addEventListener: jest.fn() }
      const saveBtn    = { removeEventListener: jest.fn(), addEventListener: jest.fn() }
      const discardBtn = { removeEventListener: jest.fn(), addEventListener: jest.fn() }
      const addBtn     = { removeEventListener: jest.fn(), addEventListener: jest.fn() }
      const removeBtn  = { removeEventListener: jest.fn(), addEventListener: jest.fn() }

      global.document.querySelectorAll = jest.fn(sel => {
        if (sel === '.time-sel')       return [timeSel]
        if (sel === '.toggle-btn')     return [toggleBtn]
        if (sel === '[data-staff-id]') return [removeBtn]
        return []
      })
      global.document.getElementById = jest.fn(id => ({
        'save-hours-btn': saveBtn,
        'discard-btn':    discardBtn,
        'add-staff-btn':  addBtn,
      }[id] ?? null))

      const ctrl = makeCtrl()
      ctrl.boundHandleTimeChange   = jest.fn()
      ctrl.boundHandleToggle       = jest.fn()
      ctrl.boundSaveHours          = jest.fn()
      ctrl.boundDiscardChanges     = jest.fn()
      ctrl.boundAddStaff           = jest.fn()
      ctrl.boundHandleRemoveStaff  = jest.fn()

      ctrl.attachEventListeners()

      expect(timeSel.addEventListener).toHaveBeenCalledWith('change', ctrl.boundHandleTimeChange)
      expect(toggleBtn.addEventListener).toHaveBeenCalledWith('click', ctrl.boundHandleToggle)
      expect(saveBtn.addEventListener).toHaveBeenCalledWith('click', ctrl.boundSaveHours)
      expect(discardBtn.addEventListener).toHaveBeenCalledWith('click', ctrl.boundDiscardChanges)
      expect(addBtn.addEventListener).toHaveBeenCalledWith('click', ctrl.boundAddStaff)
      expect(removeBtn.addEventListener).toHaveBeenCalledWith('click', ctrl.boundHandleRemoveStaff)
    })
  })

  // ── init ─────────────────────────────────────────────────────────────────────
  describe('init', () => {
    test('calls renderError and skips loadHours when clinicID is null', async () => {
      const ctrl = new AdminHoursController(null, 'Test', 'clinic', 'public', '', 'Gauteng')
      ctrl.renderError = jest.fn()
      ctrl.loadHours   = jest.fn()
      await ctrl.init()
      expect(ctrl.renderError).toHaveBeenCalled()
      expect(ctrl.loadHours).not.toHaveBeenCalled()
    })

    test('calls loadHours, renders all panels, and attaches listeners when clinicID is set', async () => {
      const ctrl = makeCtrl({ clinicID: '42' })
      ctrl.loadHours          = jest.fn(() => Promise.resolve())
      ctrl.renderClinicHeader = jest.fn()
      ctrl.renderHours        = jest.fn()
      ctrl.renderStaff        = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      await ctrl.init()
      expect(ctrl.loadHours).toHaveBeenCalled()
      expect(ctrl.renderClinicHeader).toHaveBeenCalled()
      expect(ctrl.renderHours).toHaveBeenCalled()
      expect(ctrl.renderStaff).toHaveBeenCalled()
      expect(ctrl.attachEventListeners).toHaveBeenCalled()
    })

    test('binds handler methods so they are defined after init', async () => {
      const ctrl = makeCtrl({ clinicID: '42' })
      ctrl.loadHours          = jest.fn(() => Promise.resolve())
      ctrl.renderClinicHeader = jest.fn()
      ctrl.renderHours        = jest.fn()
      ctrl.renderStaff        = jest.fn()
      ctrl.attachEventListeners = jest.fn()
      await ctrl.init()
      expect(typeof ctrl.boundHandleTimeChange).toBe('function')
      expect(typeof ctrl.boundHandleToggle).toBe('function')
      expect(typeof ctrl.boundSaveHours).toBe('function')
      expect(typeof ctrl.boundDiscardChanges).toBe('function')
      expect(typeof ctrl.boundAddStaff).toBe('function')
      expect(typeof ctrl.boundHandleRemoveStaff).toBe('function')
    })
  })

  // ── renderError ──────────────────────────────────────────────────────────────
  describe('renderError', () => {
    test('sets app.innerHTML with the provided title and message', () => {
      const app = { innerHTML: '' }
      global.document.getElementById = jest.fn(id => id === 'app' ? app : null)
      const ctrl = makeCtrl()
      ctrl.renderError('No facility', 'Go back to the map.')
      expect(app.innerHTML).toContain('No facility')
      expect(app.innerHTML).toContain('Go back to the map.')
    })

    test('HTML-escapes the title and message', () => {
      const app = { innerHTML: '' }
      global.document.getElementById = jest.fn(id => id === 'app' ? app : null)
      const ctrl = makeCtrl()
      ctrl.renderError('<script>', '"XSS"')
      expect(app.innerHTML).not.toContain('<script>')
      expect(app.innerHTML).toContain('&lt;script&gt;')
    })
  })

  // ── renderClinicHeader ───────────────────────────────────────────────────────
  describe('renderClinicHeader', () => {
    function makeAppEl() {
      const app = { innerHTML: '' }
      global.document.getElementById = jest.fn(id => id === 'app' ? app : null)
      return app
    }

    test('prepends clinic name into app.innerHTML', () => {
      const app = makeAppEl()
      makeCtrl({ clinicName: 'City Clinic' }).renderClinicHeader()
      expect(app.innerHTML).toContain('City Clinic')
    })

    test('uses HOSPITAL label and chip-hosp class for hospital type', () => {
      const app = makeAppEl()
      makeCtrl({ type: 'hospital' }).renderClinicHeader()
      expect(app.innerHTML).toContain('HOSPITAL')
      expect(app.innerHTML).toContain('chip-hosp')
    })

    test('uses CLINIC / CHC label and chip-clinic class for non-hospital type', () => {
      const app = makeAppEl()
      makeCtrl({ type: 'clinic' }).renderClinicHeader()
      expect(app.innerHTML).toContain('CLINIC / CHC')
      expect(app.innerHTML).toContain('chip-clinic')
    })

    test('uses chip-public class for public sector', () => {
      const app = makeAppEl()
      makeCtrl({ sector: 'public' }).renderClinicHeader()
      expect(app.innerHTML).toContain('chip-public')
      expect(app.innerHTML).toContain('PUBLIC')
    })

    test('uses chip-private class for private sector', () => {
      const app = makeAppEl()
      makeCtrl({ sector: 'private' }).renderClinicHeader()
      expect(app.innerHTML).toContain('chip-private')
    })

    test('includes subtype text when subtype is non-empty', () => {
      const app = makeAppEl()
      makeCtrl({ subtype: 'CHC' }).renderClinicHeader()
      expect(app.innerHTML).toContain('CHC')
    })

    test('shows province in uppercase chip', () => {
      const app = makeAppEl()
      makeCtrl({ province: 'Gauteng' }).renderClinicHeader()
      expect(app.innerHTML).toContain('GAUTENG')
    })
  })
})
