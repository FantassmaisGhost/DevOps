'use strict'

// ─── Supabase module mock ─────────────────────────────────────────────────────
jest.mock('../backend/supabase.js', () => {
  const m = {}
  Object.defineProperty(m, 'supabase', { get: () => global.supabase, enumerable: true })
  return m
})

// ─── Browser globals ──────────────────────────────────────────────────────────
global.window = { location: { href: '', origin: 'http://localhost' } }
global.document = {
  getElementById:   jest.fn(() => null),
  querySelector:    jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
  createElement:    jest.fn(() => ({
    className: '', innerHTML: '',
    addEventListener: jest.fn(),
    appendChild: jest.fn(),
  })),
  addEventListener: jest.fn(),
}
global.supabase = null

// ─── Load module ──────────────────────────────────────────────────────────────
const { LoginController } = require('../backend/login.js')

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeEl(props = {}) {
  return {
    addEventListener: jest.fn(),
    removeAttribute:  jest.fn(),
    setAttribute:     jest.fn(),
    getAttribute:     jest.fn(() => null),
    textContent:      '',
    innerHTML:        '',
    value:            '',
    disabled:         false,
    style:            { display: 'none', borderColor: '' },
    className:        '',
    close:            jest.fn(),
    showModal:        jest.fn(),
    appendChild:      jest.fn(),
    ...props,
  }
}

function makeDomMap(overrides = {}) {
  return {
    email:                   makeEl({ value: '' }),
    password:                makeEl({ value: '' }),
    actionBtn:               makeEl({ innerHTML: 'Login', disabled: false }),
    googleBtn:               makeEl({ disabled: false }),
    toggleBtn:               makeEl({ textContent: 'Create new account' }),
    registerStaffBtn:        makeEl(),
    registerReceptionistBtn: makeEl(),
    formTitle:               makeEl({ textContent: 'Login' }),
    message:                 makeEl({ style: { display: 'none' }, className: '' }),
    staffModal:              makeEl({
      getAttribute: jest.fn(() => 'staff'),
      setAttribute: jest.fn(),
      close:        jest.fn(),
      showModal:    jest.fn(),
    }),
    closeModal:     makeEl(),
    submitStaffReg: makeEl(),
    ...overrides,
  }
}

function makeCtrl(domOverrides = {}) {
  const domMap = makeDomMap(domOverrides)
  global.document.getElementById = jest.fn(id => domMap[id] ?? null)
  global.document.querySelector   = jest.fn(() => null)
  return new LoginController()
}

// Chain helper that mimics the Supabase fluent query builder
function makeChain(resolvedValue) {
  const then  = resolve => Promise.resolve(resolvedValue).then(resolve)
  const chain = { then }
  ;['select', 'eq', 'ilike', 'limit', 'insert', 'update', 'delete', 'single', 'order'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

// Build a LoginController wired to registration-form DOM elements.
// Returns the ctrl and the form element stubs so tests can inspect them.
function makeRegCtrl(registerType = 'staff', regOverrides = {}) {
  const regMessage    = regOverrides.regMessage    || makeEl({ innerHTML: '' })
  const regEmail      = regOverrides.regEmail      || makeEl({ value: 'test@example.com' })
  const regName       = regOverrides.regName       || makeEl({ value: 'Jane Doe' })
  const regOccupation = regOverrides.regOccupation || makeEl({ value: 'Doctor' })
  const regPhone      = regOverrides.regPhone      || makeEl({ value: '082 123 4567' })
  const regClinicName = regOverrides.regClinicName || makeEl({
    value: 'Test Clinic',
    getAttribute: jest.fn(attr => attr === 'data-selected-id' ? '42' : null),
  })
  const staffModal = makeEl({
    getAttribute: jest.fn(() => registerType),
    close:        jest.fn(),
    showModal:    jest.fn(),
  })
  const domMap = makeDomMap({
    staffModal, regMessage, regEmail, regName, regOccupation, regPhone, regClinicName,
  })
  global.document.getElementById = jest.fn(id => domMap[id] ?? null)
  const ctrl = new LoginController()
  return { ctrl, regMessage, regEmail, regName, regPhone, regClinicName }
}

// ═══════════════════════════════════════════════════════════════════════════════
describe('LoginController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.window.location.href = ''
    global.supabase = null
  })

  // ── escapeHtml ───────────────────────────────────────────────────────────────
  describe('escapeHtml', () => {
    test('returns empty string for falsy values', () => {
      const ctrl = makeCtrl()
      expect(ctrl.escapeHtml(null)).toBe('')
      expect(ctrl.escapeHtml(undefined)).toBe('')
      expect(ctrl.escapeHtml('')).toBe('')
    })

    test('escapes & < >', () => {
      const ctrl = makeCtrl()
      expect(ctrl.escapeHtml('a & b')).toBe('a &amp; b')
      expect(ctrl.escapeHtml('<b>')).toBe('&lt;b&gt;')
      expect(ctrl.escapeHtml('a<b>c')).toBe('a&lt;b&gt;c')
    })

    test('does not escape double quotes', () => {
      expect(makeCtrl().escapeHtml('"hello"')).toBe('"hello"')
    })

    test('returns plain strings unchanged', () => {
      expect(makeCtrl().escapeHtml('hello world')).toBe('hello world')
    })
  })

  // ── isValidPhoneNumber ───────────────────────────────────────────────────────
  describe('isValidPhoneNumber', () => {
    test('accepts valid SA mobile numbers (06x / 07x / 08x, 10 digits)', () => {
      const ctrl = makeCtrl()
      expect(ctrl.isValidPhoneNumber('0821234567')).toBe(true)
      expect(ctrl.isValidPhoneNumber('0711234567')).toBe(true)
      expect(ctrl.isValidPhoneNumber('0611234567')).toBe(true)
    })

    test('accepts valid 9-digit landline numbers', () => {
      expect(makeCtrl().isValidPhoneNumber('011123456')).toBe(true)
    })

    test('strips spaces and dashes before validating', () => {
      expect(makeCtrl().isValidPhoneNumber('082 123 4567')).toBe(true)
      expect(makeCtrl().isValidPhoneNumber('082-123-4567')).toBe(true)
    })

    test('rejects numbers that are too short or too long', () => {
      const ctrl = makeCtrl()
      expect(ctrl.isValidPhoneNumber('082123')).toBe(false)
      expect(ctrl.isValidPhoneNumber('08212345678')).toBe(false)
    })

    test('rejects numbers with disallowed mobile prefixes (09x)', () => {
      expect(makeCtrl().isValidPhoneNumber('0901234567')).toBe(false)
    })
  })

  // ── formatPhoneNumber ────────────────────────────────────────────────────────
  describe('formatPhoneNumber', () => {
    test('formats 10-digit number as "XXX XXX XXXX"', () => {
      expect(makeCtrl().formatPhoneNumber('0821234567')).toBe('082 123 4567')
    })

    test('strips non-digit characters before formatting', () => {
      expect(makeCtrl().formatPhoneNumber('082-123-4567')).toBe('082 123 4567')
    })

    test('converts 27-prefix to leading 0', () => {
      expect(makeCtrl().formatPhoneNumber('27821234567')).toBe('082 123 4567')
    })

    test('formats exactly 6 digits as "XXX XXX"', () => {
      expect(makeCtrl().formatPhoneNumber('082123')).toBe('082 123')
    })

    test('formats 7+ digits as "XXX XXX X..."', () => {
      expect(makeCtrl().formatPhoneNumber('0821234')).toBe('082 123 4')
    })

    test('formats exactly 3 digits as "XXX"', () => {
      expect(makeCtrl().formatPhoneNumber('082')).toBe('082')
    })

    test('returns fewer than 3 digits unchanged', () => {
      expect(makeCtrl().formatPhoneNumber('08')).toBe('08')
      expect(makeCtrl().formatPhoneNumber('0')).toBe('0')
    })
  })

  // ── showMessage ──────────────────────────────────────────────────────────────
  describe('showMessage', () => {
    test('sets textContent, className, and display on messageArticle', () => {
      const message = makeEl({ style: { display: 'none' }, className: '' })
      const ctrl = makeCtrl({ message })
      ctrl.showMessage('Something went wrong', 'error')
      expect(message.textContent).toBe('Something went wrong')
      expect(message.className).toBe('message error')
      expect(message.style.display).toBe('block')
    })

    test('works with success type', () => {
      const message = makeEl({ style: { display: 'none' }, className: '' })
      const ctrl = makeCtrl({ message })
      ctrl.showMessage('All good!', 'success')
      expect(message.className).toBe('message success')
    })
  })

  // ── setLoading ───────────────────────────────────────────────────────────────
  describe('setLoading', () => {
    test('disables both buttons and shows spinner when loading is true', () => {
      const actionBtn = makeEl({ innerHTML: 'Login', disabled: false })
      const googleBtn = makeEl({ disabled: false })
      const ctrl = makeCtrl({ actionBtn, googleBtn })
      ctrl.setLoading(true)
      expect(actionBtn.disabled).toBe(true)
      expect(googleBtn.disabled).toBe(true)
      expect(actionBtn.innerHTML).toContain('Processing...')
    })

    test('re-enables both buttons when loading is false', () => {
      const actionBtn = makeEl({ disabled: true })
      const googleBtn = makeEl({ disabled: true })
      const ctrl = makeCtrl({ actionBtn, googleBtn })
      ctrl.setLoading(false)
      expect(actionBtn.disabled).toBe(false)
      expect(googleBtn.disabled).toBe(false)
    })

    test('restores "Login" label when isLogin is true', () => {
      const actionBtn = makeEl({ innerHTML: '' })
      const googleBtn = makeEl()
      const ctrl = makeCtrl({ actionBtn, googleBtn })
      ctrl.isLogin = true
      ctrl.setLoading(false)
      expect(actionBtn.innerHTML).toBe('Login')
    })

    test('restores "Sign Up" label when isLogin is false', () => {
      const actionBtn = makeEl({ innerHTML: '' })
      const googleBtn = makeEl()
      const ctrl = makeCtrl({ actionBtn, googleBtn })
      ctrl.isLogin = false
      ctrl.setLoading(false)
      expect(actionBtn.innerHTML).toBe('Sign Up')
    })
  })

  // ── toggleMode ───────────────────────────────────────────────────────────────
  describe('toggleMode', () => {
    test('switches from login to signup mode', () => {
      const formTitle               = makeEl({ textContent: 'Login' })
      const actionBtn               = makeEl({ innerHTML: 'Login' })
      const toggleBtn               = makeEl({ textContent: 'Create new account' })
      const registerStaffBtn        = makeEl({ style: { display: 'block' } })
      const registerReceptionistBtn = makeEl({ style: { display: 'block' } })
      const message                 = makeEl({ style: { display: 'block' } })
      const ctrl = makeCtrl({ formTitle, actionBtn, toggleBtn, registerStaffBtn, registerReceptionistBtn, message })

      ctrl.toggleMode()

      expect(ctrl.isLogin).toBe(false)
      expect(formTitle.textContent).toBe('Sign Up')
      expect(actionBtn.innerHTML).toBe('Sign Up')
      expect(toggleBtn.textContent).toBe('Back to Login')
      expect(registerStaffBtn.style.display).toBe('none')
      expect(registerReceptionistBtn.style.display).toBe('none')
      expect(message.style.display).toBe('none')
    })

    test('switches from signup back to login mode', () => {
      const formTitle               = makeEl({ textContent: 'Sign Up' })
      const actionBtn               = makeEl({ innerHTML: 'Sign Up' })
      const toggleBtn               = makeEl({ textContent: 'Back to Login' })
      const registerStaffBtn        = makeEl({ style: { display: 'none' } })
      const registerReceptionistBtn = makeEl({ style: { display: 'none' } })
      const message                 = makeEl({ style: { display: 'none' } })
      const ctrl = makeCtrl({ formTitle, actionBtn, toggleBtn, registerStaffBtn, registerReceptionistBtn, message })
      ctrl.isLogin = false

      ctrl.toggleMode()

      expect(ctrl.isLogin).toBe(true)
      expect(formTitle.textContent).toBe('Login')
      expect(actionBtn.innerHTML).toBe('Login')
      expect(toggleBtn.textContent).toBe('Create new account')
      expect(registerStaffBtn.style.display).toBe('block')
      expect(registerReceptionistBtn.style.display).toBe('block')
    })
  })

  // ── checkSession ─────────────────────────────────────────────────────────────
  describe('checkSession', () => {
    test('redirects to redirect.html when a session exists', async () => {
      const ctrl = makeCtrl()
      global.supabase = {
        auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { id: '1' } } } })) },
      }
      await ctrl.checkSession()
      expect(global.window.location.href).toBe('/pages/redirect.html')
    })

    test('does not redirect when session is null', async () => {
      const ctrl = makeCtrl()
      global.supabase = {
        auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) },
      }
      await ctrl.checkSession()
      expect(global.window.location.href).toBe('')
    })
  })

  // ── handleEmailAuth ──────────────────────────────────────────────────────────
  describe('handleEmailAuth', () => {
    test('shows error when email or password is empty', async () => {
      const ctrl = makeCtrl()
      ctrl.showMessage = jest.fn()
      await ctrl.handleEmailAuth()
      expect(ctrl.showMessage).toHaveBeenCalledWith('Please fill in all fields', 'error')
    })

    test('calls signInWithPassword and redirects on successful login', async () => {
      const email    = makeEl({ value: 'user@test.com' })
      const password = makeEl({ value: 'pass123' })
      const ctrl = makeCtrl({ email, password })
      ctrl.setLoading   = jest.fn()
      ctrl.showMessage  = jest.fn()

      global.supabase = {
        auth: { signInWithPassword: jest.fn(() => Promise.resolve({ error: null })) },
      }

      await ctrl.handleEmailAuth()

      expect(global.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@test.com', password: 'pass123',
      })
      expect(global.window.location.href).toBe('/pages/redirect.html')
    })

    test('shows error message when login fails', async () => {
      const email    = makeEl({ value: 'bad@test.com' })
      const password = makeEl({ value: 'wrong' })
      const ctrl = makeCtrl({ email, password })
      ctrl.setLoading  = jest.fn()
      ctrl.showMessage = jest.fn()

      global.supabase = {
        auth: { signInWithPassword: jest.fn(() => Promise.resolve({ error: { message: 'Invalid credentials' } })) },
      }

      await ctrl.handleEmailAuth()

      expect(ctrl.showMessage).toHaveBeenCalledWith('Invalid credentials', 'error')
    })

    test('calls signUp and shows success on successful registration', async () => {
      const email    = makeEl({ value: 'new@test.com' })
      const password = makeEl({ value: 'newpass' })
      const ctrl = makeCtrl({ email, password })
      ctrl.isLogin     = false
      ctrl.setLoading  = jest.fn()
      ctrl.showMessage = jest.fn()
      ctrl.toggleMode  = jest.fn()

      global.supabase = {
        auth: { signUp: jest.fn(() => Promise.resolve({ error: null })) },
      }

      await ctrl.handleEmailAuth()

      expect(global.supabase.auth.signUp).toHaveBeenCalled()
      expect(ctrl.showMessage).toHaveBeenCalledWith('Account created. Please login.', 'success')
      expect(ctrl.toggleMode).toHaveBeenCalledTimes(1)
    })

    test('shows error when signUp fails', async () => {
      const email    = makeEl({ value: 'dup@test.com' })
      const password = makeEl({ value: 'pass' })
      const ctrl = makeCtrl({ email, password })
      ctrl.isLogin     = false
      ctrl.setLoading  = jest.fn()
      ctrl.showMessage = jest.fn()

      global.supabase = {
        auth: { signUp: jest.fn(() => Promise.resolve({ error: { message: 'Email already taken' } })) },
      }

      await ctrl.handleEmailAuth()

      expect(ctrl.showMessage).toHaveBeenCalledWith('Email already taken', 'error')
    })
  })

  // ── handleGoogleLogin ────────────────────────────────────────────────────────
  describe('handleGoogleLogin', () => {
    test('calls signInWithOAuth with google provider and correct redirect URL', async () => {
      const ctrl = makeCtrl()
      ctrl.setLoading  = jest.fn()
      ctrl.showMessage = jest.fn()
      global.document.querySelector = jest.fn(() => ({ value: 'patient' }))
      global.supabase = {
        auth: { signInWithOAuth: jest.fn(() => Promise.resolve({ error: null })) },
      }

      await ctrl.handleGoogleLogin()

      expect(global.supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options:  { redirectTo: 'http://localhost/pages/redirect.html?role=patient' },
      })
    })

    test('shows error and re-enables loading when Google OAuth fails', async () => {
      const ctrl = makeCtrl()
      ctrl.setLoading  = jest.fn()
      ctrl.showMessage = jest.fn()
      global.document.querySelector = jest.fn(() => ({ value: 'staff' }))
      global.supabase = {
        auth: { signInWithOAuth: jest.fn(() => Promise.resolve({ error: { message: 'OAuth error' } })) },
      }

      await ctrl.handleGoogleLogin()

      expect(ctrl.showMessage).toHaveBeenCalledWith('OAuth error', 'error')
      expect(ctrl.setLoading).toHaveBeenLastCalledWith(false)
    })
  })

  // ── submitStaffRegistration ──────────────────────────────────────────────────
  describe('submitStaffRegistration', () => {
    test('sets error when email or name is empty', async () => {
      const { ctrl, regMessage } = makeRegCtrl('staff', {
        regEmail: makeEl({ value: '' }),
        regName:  makeEl({ value: '' }),
      })
      await ctrl.submitStaffRegistration()
      expect(regMessage.innerHTML).toContain('Please fill in email and full name')
    })

    test('sets error when email lacks @', async () => {
      const { ctrl, regMessage } = makeRegCtrl('staff', {
        regEmail: makeEl({ value: 'notanemail' }),
      })
      await ctrl.submitStaffRegistration()
      expect(regMessage.innerHTML).toContain('valid email address')
    })

    test('sets error for invalid phone number', async () => {
      const { ctrl, regMessage } = makeRegCtrl('staff', {
        regPhone: makeEl({ value: '123' }),
      })
      await ctrl.submitStaffRegistration()
      expect(regMessage.innerHTML).toContain('valid South African phone number')
    })

    test('sets error when no clinic is selected from the list', async () => {
      const { ctrl, regMessage } = makeRegCtrl('staff', {
        regClinicName: makeEl({ value: 'Some Clinic', getAttribute: jest.fn(() => null) }),
      })
      await ctrl.submitStaffRegistration()
      expect(regMessage.innerHTML).toContain('select a clinic from the list')
    })

    test('inserts into pending_staff and shows success for staff registration', async () => {
      const { ctrl, regMessage } = makeRegCtrl('staff')
      global.supabase = { from: jest.fn(() => makeChain({ error: null })) }
      await ctrl.submitStaffRegistration()
      expect(regMessage.innerHTML).toContain('Staff registration complete')
    })

    test('shows insert error when staff registration fails', async () => {
      const { ctrl, regMessage } = makeRegCtrl('staff')
      global.supabase = { from: jest.fn(() => makeChain({ error: { message: 'Duplicate email' } })) }
      await ctrl.submitStaffRegistration()
      expect(regMessage.innerHTML).toContain('Duplicate email')
    })

    test('shows error when receptionist email is already pending', async () => {
      const { ctrl, regMessage } = makeRegCtrl('receptionist')
      global.supabase = {
        from: jest.fn(() => makeChain({ data: { email: 'test@example.com' }, error: null })),
      }
      await ctrl.submitStaffRegistration()
      expect(regMessage.innerHTML).toContain('already registered as pending receptionist')
    })

    test('inserts into pending_receptionists and shows success', async () => {
      const { ctrl, regMessage } = makeRegCtrl('receptionist')
      let callCount = 0
      global.supabase = {
        from: jest.fn(() => {
          callCount++
          return makeChain(callCount === 1
            ? { data: null, error: null }   // no existing receptionist
            : { error: null }               // insert succeeds
          )
        }),
      }
      await ctrl.submitStaffRegistration()
      expect(regMessage.innerHTML).toContain('Receptionist registration complete')
    })

    test('shows insert error when receptionist registration fails', async () => {
      const { ctrl, regMessage } = makeRegCtrl('receptionist')
      let callCount = 0
      global.supabase = {
        from: jest.fn(() => {
          callCount++
          return makeChain(callCount === 1
            ? { data: null, error: null }
            : { error: { message: 'Insert failed' } }
          )
        }),
      }
      await ctrl.submitStaffRegistration()
      expect(regMessage.innerHTML).toContain('Insert failed')
    })
  })
})
