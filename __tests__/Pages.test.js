'use strict'

const realSetTimeout = setTimeout // capture before any global reassignment

jest.mock('../backend/supabase.js', () => {
  const m = {}
  Object.defineProperty(m, 'supabase', { get: () => global.supabase, enumerable: true })
  return m
})

const fs = require('fs')
const path = require('path')

function makeChain(resolvedValue) {
  const chain = { then: resolve => Promise.resolve(resolvedValue).then(resolve) }
  ;['select', 'eq', 'update', 'delete', 'insert', 'order', 'single', 'in', 'maybeSingle'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

const el = {}
function elem(id) {
  if (!el[id]) el[id] = {
    textContent: '', innerHTML: '', value: '',
    style: { display: '' },
    addEventListener: jest.fn(), getAttribute: jest.fn(), remove: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    classList: { remove: jest.fn(), add: jest.fn() },
  }
  return el[id]
}

global.document = { getElementById: jest.fn(id => elem(id)), querySelectorAll: jest.fn(() => []) }
global.window = { location: { href: '', search: '' } }
global.localStorage = { setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn(), getItem: jest.fn() }
global.setInterval = jest.fn(() => 42)
global.clearInterval = jest.fn()
global.setTimeout = jest.fn()
global.supabase = null

function transform(filename) {
  return fs.readFileSync(path.join(__dirname, '../backend', filename), 'utf8')
    .replace(/^import\s.*?;?\s*$/gm, '')
    .replace(/\bsupabase\b(?=\.)/g, 'global.supabase')
    .replace(/^export\s+/gm, '')
}

// ─── eval wrappers (for behavioural assertions) ───────────────────────────────

const redirectCode = transform('redirect.js')
  .replace(/^const controller\s*=\s*new RedirectController\(\);?\s*$/m, '')
  .replace(/^controller\.handleRedirect\(\);?\s*$/m, '')

const { RedirectController } = eval(`(function () {
  ${redirectCode}
  return { RedirectController }
})()`)

const dashboardCode = transform('dashboard.js')
  .replace(/^const controller\s*=\s*new PatientDashboardController\(\);?\s*$/m, '')
  .replace(/^controller\.checkAuth\(\);?\s*$/m, '')
  .replace(/^document\.getElementById\(['"]logoutBtn['"]\)\.addEventListener.*$/m, '')

const { PatientDashboardController } = eval(`(function () {
  ${dashboardCode}
  return { PatientDashboardController }
})()`)

const pendingCode = transform('pending-approval.js')
  .replace(/^const controller\s*=\s*new PendingApprovalController\(\);?\s*$/m, '')
  .replace(/^controller\.startPolling\(\);?\s*$/m, '')
  .replace(/^const logoutBtn\s*=.*$/m, '')
  .replace(/^if \(logoutBtn\).*$/m, '')

const { PendingApprovalController } = eval(`(function () {
  ${pendingCode}
  return { PendingApprovalController }
})()`)

// ─── shared helpers ───────────────────────────────────────────────────────────

const mockSession = {
  user: { email: 'test@example.com', id: 'uid-1', user_metadata: { full_name: 'Test User' } },
}

function makeRedirectSupabase({
  session = null, admin = null, staff = null, pending = null,
  receptionist = null, pendingRec = null, patient = null,
} = {}) {
  return {
    auth: { getSession: jest.fn(async () => ({ data: { session } })) },
    from: jest.fn(table => {
      const map = {
        Admin: { data: admin },
        Staff: { data: staff },
        pending_staff: { data: pending },
        Receptionist: { data: receptionist },
        pending_receptionists: { data: pendingRec },
        Patients: { data: patient },
      }
      return makeChain(map[table] ?? { data: null })
    }),
  }
}

// ─── Istanbul coverage: exercise all three modules via require() ───────────────

const iS = { user: { email: 'i@t.com', id: 'iu1', user_metadata: { full_name: 'IUser' } } }

beforeAll(async () => {
  // ── redirect.js ─────────────────────────────────────────────────────────────

  // 1. no session
  global.supabase = { auth: { getSession: async () => ({ data: { session: null } }) }, from: jest.fn(() => makeChain({ data: null })) }
  global.window.location.search = ''
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 2. actualRole=admin, no selectedRole
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'Admin' ? { id: 1 } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 3. actualRole=receptionist, no selectedRole
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'Receptionist' ? { id: 2, clinicid: 'c1', clinicname: 'CL' } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 4. actualRole=staff, no selectedRole
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'Staff' ? { id: 3 } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 5. actualRole=pending, no selectedRole
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'pending_staff' ? { id: 4 } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 6. actualRole=pending_receptionist, no selectedRole
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'pending_receptionists' ? { id: 5 } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 7. actualRole=patient, patient record exists, no selectedRole
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'Patients' ? { id: 'iu1' } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 8. actualRole=patient, no patient record → insert, no selectedRole
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(() => makeChain({ data: null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 9. selectedRole=admin + actualRole=admin
  global.window.location.search = '?role=admin'
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'Admin' ? { id: 1 } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 10. selectedRole=receptionist + actualRole=receptionist
  global.window.location.search = '?role=receptionist'
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'Receptionist' ? { id: 2, clinicid: 'c1', clinicname: 'CL' } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 11. selectedRole=receptionist + actualRole=pending_receptionist
  global.window.location.search = '?role=receptionist'
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'pending_receptionists' ? { id: 5 } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 12. selectedRole=staff + actualRole=staff
  global.window.location.search = '?role=staff'
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'Staff' ? { id: 3 } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 13. selectedRole=staff + actualRole=pending
  global.window.location.search = '?role=staff'
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'pending_staff' ? { id: 4 } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 14. selectedRole=patient
  global.window.location.search = '?role=patient'
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(t => makeChain({ data: t === 'Patients' ? { id: 'iu1' } : null })),
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 15. access denied → capture and invoke setTimeout callback to cover lines 180-181
  let redirectTimeoutCb = null
  global.setTimeout = fn => { redirectTimeoutCb = fn; return 1 }
  global.window.location.search = '?role=admin'
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: iS } }) },
    from: jest.fn(() => makeChain({ data: null })), // actualRole=patient → denied
  }
  jest.isolateModules(() => { require('../backend/redirect.js') })
  await new Promise(r => realSetTimeout(r, 30))
  if (redirectTimeoutCb) redirectTimeoutCb()
  global.window.location.search = ''
  global.setTimeout = jest.fn()

  // ── dashboard.js ─────────────────────────────────────────────────────────────

  // 1. no session
  global.supabase = { auth: { getSession: async () => ({ data: { session: null } }) } }
  jest.isolateModules(() => { require('../backend/dashboard.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 2. session exists — then invoke the logoutBtn handler to cover logout()
  global.supabase = {
    auth: {
      getSession: async () => ({ data: { session: { user: { email: 'p@t.com' } } } }),
      signOut: jest.fn(async () => {}),
    },
  }
  const dashLogoutCountBefore = elem('logoutBtn').addEventListener.mock.calls.length
  jest.isolateModules(() => { require('../backend/dashboard.js') })
  await new Promise(r => realSetTimeout(r, 30))
  const dashLogoutNewCalls = elem('logoutBtn').addEventListener.mock.calls.slice(dashLogoutCountBefore)
  const dashLogoutHandler = dashLogoutNewCalls.find(c => c[0] === 'click')?.[1]
  if (dashLogoutHandler) await dashLogoutHandler()

  // ── pending-approval.js ───────────────────────────────────────────────────────

  // 1. session + pending + clinic found + no staff → covers startPolling, checkAndRedirect, clinicInfo
  global.supabase = {
    auth: {
      getSession: async () => ({ data: { session: { user: { email: 's@t.com' } } } }),
      signOut: jest.fn(async () => {}),
    },
    from: jest.fn(t => {
      if (t === 'pending_staff') return makeChain({ data: { clinicid: 'c1' } })
      if (t === 'Facilities') return makeChain({ data: { Name: 'TestClinic' } })
      return makeChain({ data: null })
    }),
  }
  const pendLogoutCountBefore = elem('logoutBtn').addEventListener.mock.calls.length
  jest.isolateModules(() => { require('../backend/pending-approval.js') })
  await new Promise(r => realSetTimeout(r, 30))
  // invoke logoutBtn handler to cover logout() lines
  const pendLogoutNewCalls = elem('logoutBtn').addEventListener.mock.calls.slice(pendLogoutCountBefore)
  const pendLogoutHandler = pendLogoutNewCalls.find(c => c[0] === 'click')?.[1]
  if (pendLogoutHandler) await pendLogoutHandler()

  // 2. no session path
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: jest.fn(() => makeChain({ data: null })),
  }
  jest.isolateModules(() => { require('../backend/pending-approval.js') })
  await new Promise(r => realSetTimeout(r, 30))

  // 3. staff approved → clearInterval + redirect to staff-dashboard
  global.supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { email: 's@t.com' } } } }), signOut: jest.fn(async () => {}) },
    from: jest.fn(t => makeChain({ data: t === 'Staff' ? { id: 1 } : null })),
  }
  jest.isolateModules(() => { require('../backend/pending-approval.js') })
  await new Promise(r => realSetTimeout(r, 30))

  global.window.location.href = ''
  global.window.location.search = ''
})

// ─── RedirectController ───────────────────────────────────────────────────────

describe('RedirectController › handleRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.window.location.href = ''
    global.setTimeout = jest.fn()
  })

  test('no session → removes userRole and redirects to index', async () => {
    global.supabase = makeRedirectSupabase({ session: null })
    const ctrl = new RedirectController()
    ctrl.selectedRole = null
    await ctrl.handleRedirect()
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('userRole')
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('actualRole=admin, no selectedRole → admin-dashboard', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession, admin: { id: 1 } })
    const ctrl = new RedirectController()
    ctrl.selectedRole = null
    await ctrl.handleRedirect()
    expect(global.localStorage.setItem).toHaveBeenCalledWith('userRole', 'admin')
    expect(global.window.location.href).toBe('/pages/admin-dashboard.html')
  })

  test('actualRole=receptionist, no selectedRole → receptionist-dashboard', async () => {
    global.supabase = makeRedirectSupabase({
      session: mockSession,
      receptionist: { id: 2, clinicid: 'c1', clinicname: 'Clinic A' },
    })
    const ctrl = new RedirectController()
    ctrl.selectedRole = null
    await ctrl.handleRedirect()
    expect(global.localStorage.setItem).toHaveBeenCalledWith('userRole', 'receptionist')
    expect(global.window.location.href).toBe('/pages/receptionist-dashboard.html')
  })

  test('actualRole=staff, no selectedRole → staff-dashboard', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession, staff: { id: 3 } })
    const ctrl = new RedirectController()
    ctrl.selectedRole = null
    await ctrl.handleRedirect()
    expect(global.localStorage.setItem).toHaveBeenCalledWith('userRole', 'staff')
    expect(global.window.location.href).toBe('/pages/staff-dashboard.html')
  })

  test('actualRole=pending, no selectedRole → pending-approval', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession, pending: { id: 4 } })
    const ctrl = new RedirectController()
    ctrl.selectedRole = null
    await ctrl.handleRedirect()
    expect(global.localStorage.setItem).toHaveBeenCalledWith('userRole', 'pending')
    expect(global.window.location.href).toBe('/pages/pending-approval.html')
  })

  test('actualRole=pending_receptionist, no selectedRole → pending-approval', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession, pendingRec: { id: 5 } })
    const ctrl = new RedirectController()
    ctrl.selectedRole = null
    await ctrl.handleRedirect()
    expect(global.window.location.href).toBe('/pages/pending-approval.html')
  })

  test('actualRole=patient, patient record exists → dashboard', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession, patient: { id: 'uid-1' } })
    const ctrl = new RedirectController()
    ctrl.selectedRole = null
    await ctrl.handleRedirect()
    expect(global.localStorage.setItem).toHaveBeenCalledWith('userRole', 'patient')
    expect(global.window.location.href).toBe('/pages/dashboard.html')
  })

  test('actualRole=patient, patient record NOT exists → inserts then redirects to dashboard', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession }) // patient=null by default
    const ctrl = new RedirectController()
    ctrl.selectedRole = null
    await ctrl.handleRedirect()
    expect(global.supabase.from).toHaveBeenCalledWith('Patients')
    expect(global.window.location.href).toBe('/pages/dashboard.html')
  })

  test('selectedRole=admin + actualRole=admin → admin-dashboard', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession, admin: { id: 1 } })
    const ctrl = new RedirectController()
    ctrl.selectedRole = 'admin'
    await ctrl.handleRedirect()
    expect(global.window.location.href).toBe('/pages/admin-dashboard.html')
  })

  test('selectedRole=receptionist + actualRole=receptionist → receptionist-dashboard', async () => {
    global.supabase = makeRedirectSupabase({
      session: mockSession,
      receptionist: { id: 2, clinicid: 'c1', clinicname: 'Clinic A' },
    })
    const ctrl = new RedirectController()
    ctrl.selectedRole = 'receptionist'
    await ctrl.handleRedirect()
    expect(global.window.location.href).toBe('/pages/receptionist-dashboard.html')
  })

  test('selectedRole=receptionist + actualRole=pending_receptionist → pending-approval', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession, pendingRec: { id: 5 } })
    const ctrl = new RedirectController()
    ctrl.selectedRole = 'receptionist'
    await ctrl.handleRedirect()
    expect(global.window.location.href).toBe('/pages/pending-approval.html')
  })

  test('selectedRole=staff + actualRole=staff → staff-dashboard', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession, staff: { id: 3 } })
    const ctrl = new RedirectController()
    ctrl.selectedRole = 'staff'
    await ctrl.handleRedirect()
    expect(global.window.location.href).toBe('/pages/staff-dashboard.html')
  })

  test('selectedRole=staff + actualRole=pending → pending-approval', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession, pending: { id: 4 } })
    const ctrl = new RedirectController()
    ctrl.selectedRole = 'staff'
    await ctrl.handleRedirect()
    expect(global.window.location.href).toBe('/pages/pending-approval.html')
  })

  test('selectedRole=patient → runs ensurePatientRecord and redirects to dashboard', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession, patient: { id: 'uid-1' } })
    const ctrl = new RedirectController()
    ctrl.selectedRole = 'patient'
    await ctrl.handleRedirect()
    expect(global.window.location.href).toBe('/pages/dashboard.html')
  })

  test('access denied → hides spinner and message, sets errorMsg, schedules redirect', async () => {
    global.supabase = makeRedirectSupabase({ session: mockSession }) // actualRole=patient, selectedRole=admin → denied
    const ctrl = new RedirectController()
    ctrl.selectedRole = 'admin'
    await ctrl.handleRedirect()
    expect(elem('spinner').style.display).toBe('none')
    expect(elem('message').style.display).toBe('none')
    expect(elem('errorMsg').innerHTML).toContain('Access Denied')
    expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000)
    // invoke the scheduled callback to cover the delayed redirect lines
    global.setTimeout.mock.calls[0][0]()
    expect(global.window.location.href).toBe('/pages/index.html')
  })
})

// ─── PatientDashboardController ───────────────────────────────────────────────

describe('PatientDashboardController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.window.location.href = ''
  })

  test('checkAuth: no session → removes userRole and redirects to index', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(async () => ({ data: { session: null } })) },
    }
    const ctrl = new PatientDashboardController()
    await ctrl.checkAuth()
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('userRole')
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('checkAuth: session exists → sets userRole, userEmail, and welcomeMsg', async () => {
    global.supabase = {
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { user: { email: 'patient@test.com' } } },
        })),
      },
    }
    const ctrl = new PatientDashboardController()
    await ctrl.checkAuth()
    expect(global.localStorage.setItem).toHaveBeenCalledWith('userRole', 'patient')
    expect(elem('userEmail').textContent).toBe('patient@test.com')
    expect(elem('welcomeMsg').textContent).toContain('patient')
  })

  test('logout: removes userRole, signs out, and redirects to index', async () => {
    const signOut = jest.fn(async () => {})
    global.supabase = { auth: { signOut } }
    const ctrl = new PatientDashboardController()
    await ctrl.logout()
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('userRole')
    expect(signOut).toHaveBeenCalled()
    expect(global.window.location.href).toBe('/pages/index.html')
  })
})

// ─── PendingApprovalController ────────────────────────────────────────────────

describe('PendingApprovalController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.window.location.href = ''
    global.setInterval = jest.fn(() => 42)
    global.clearInterval = jest.fn()
  })

  test('checkAndRedirect: no session → removes userRole and redirects to index', async () => {
    global.supabase = {
      auth: { getSession: jest.fn(async () => ({ data: { session: null } })) },
      from: jest.fn(() => makeChain({ data: null })),
    }
    const ctrl = new PendingApprovalController()
    await ctrl.checkAndRedirect()
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('userRole')
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('checkAndRedirect: pending found + clinic found → shows clinic name', async () => {
    global.supabase = {
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { user: { email: 'staff@test.com' } } },
        })),
      },
      from: jest.fn(table => {
        if (table === 'pending_staff') return makeChain({ data: { clinicid: 'clinic-1' } })
        if (table === 'Facilities') return makeChain({ data: { Name: 'City Clinic' } })
        return makeChain({ data: null })
      }),
    }
    const ctrl = new PendingApprovalController()
    await ctrl.checkAndRedirect()
    expect(elem('clinicInfo').innerHTML).toContain('City Clinic')
  })

  test('checkAndRedirect: pending found + no clinic → shows clinic ID', async () => {
    global.supabase = {
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { user: { email: 'staff@test.com' } } },
        })),
      },
      from: jest.fn(table => {
        if (table === 'pending_staff') return makeChain({ data: { clinicid: 'clinic-99' } })
        if (table === 'Facilities') return makeChain({ data: null })
        return makeChain({ data: null })
      }),
    }
    const ctrl = new PendingApprovalController()
    await ctrl.checkAndRedirect()
    expect(elem('clinicInfo').innerHTML).toContain('clinic-99')
  })

  test('checkAndRedirect: staff approved → clearInterval and redirect to staff-dashboard', async () => {
    global.supabase = {
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { user: { email: 'staff@test.com' } } },
        })),
      },
      from: jest.fn(table => {
        if (table === 'Staff') return makeChain({ data: { id: 1 } })
        return makeChain({ data: null })
      }),
    }
    const ctrl = new PendingApprovalController()
    ctrl.checkInterval = 99
    await ctrl.checkAndRedirect()
    expect(global.clearInterval).toHaveBeenCalledWith(99)
    expect(global.localStorage.setItem).toHaveBeenCalledWith('userRole', 'staff')
    expect(global.window.location.href).toBe('/pages/staff-dashboard.html')
  })

  test('checkAndRedirect: not yet approved → hides spinner', async () => {
    global.supabase = {
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { user: { email: 'staff@test.com' } } },
        })),
      },
      from: jest.fn(() => makeChain({ data: null })),
    }
    elem('spinner').style.display = 'block'
    const ctrl = new PendingApprovalController()
    await ctrl.checkAndRedirect()
    expect(elem('spinner').style.display).toBe('none')
  })

  test('logout: clears interval, removes userRole, signs out, and redirects', async () => {
    const signOut = jest.fn(async () => {})
    global.supabase = { auth: { signOut } }
    const ctrl = new PendingApprovalController()
    ctrl.checkInterval = 55
    await ctrl.logout()
    expect(global.clearInterval).toHaveBeenCalledWith(55)
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('userRole')
    expect(signOut).toHaveBeenCalled()
    expect(global.window.location.href).toBe('/pages/index.html')
  })

  test('startPolling: calls checkAndRedirect and assigns checkInterval', () => {
    global.supabase = {
      auth: { getSession: jest.fn(async () => ({ data: { session: null } })) },
      from: jest.fn(() => makeChain({ data: null })),
    }
    const ctrl = new PendingApprovalController()
    ctrl.startPolling()
    expect(global.setInterval).toHaveBeenCalled()
    expect(ctrl.checkInterval).toBe(42)
  })
})
