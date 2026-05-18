'use strict'

/**
 * __tests__/auth.test.js
 * Tests for backend/AuthService.js
 * AuthService accepts a supabase client via constructor (clean DI), so no
 * global setup is needed — we just pass a jest mock.
 */

const fs   = require('fs')
const path = require('path')

// Load AuthService by evaluating the file inside an IIFE so the class is
// returned rather than leaked into a scope we can't access.
const _authCode = fs.readFileSync(
  path.join(__dirname, '../backend/AuthService.js'), 'utf8'
)
// eslint-disable-next-line no-eval
const AuthService = eval(`(function() { ${_authCode}; return AuthService; })()`)

// ─────────────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let mockSupabase
  let service

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getSession:          jest.fn(),
        signInWithPassword:  jest.fn(),
        signInWithOAuth:     jest.fn(),
        signUp:              jest.fn(),
        signOut:             jest.fn(),
      },
    }
    service = new AuthService(mockSupabase)
  })

  // ── getSession ──────────────────────────────────────────────────────────────
  describe('getSession', () => {
    test('returns the session object when a session exists', async () => {
      const fakeSession = { user: { id: 'u1', email: 'a@test.com' }, access_token: 'tok' }
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: fakeSession } })

      const result = await service.getSession()

      expect(result).toBe(fakeSession)
      expect(mockSupabase.auth.getSession).toHaveBeenCalledTimes(1)
    })

    test('returns null when no active session exists', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })

      expect(await service.getSession()).toBeNull()
    })
  })

  // ── signInWithPassword ──────────────────────────────────────────────────────
  describe('signInWithPassword', () => {
    test('returns session on successful login', async () => {
      const sess = { access_token: 'tok123', user: { id: 'u1' } }
      mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: { session: sess }, error: null })

      const result = await service.signInWithPassword('a@test.com', 'pass123')

      expect(result).toBe(sess)
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'a@test.com', password: 'pass123',
      })
    })

    test('throws the supabase error when credentials are wrong', async () => {
      const err = new Error('Invalid login credentials')
      mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: err })

      await expect(service.signInWithPassword('a@test.com', 'wrong')).rejects.toThrow(
        'Invalid login credentials'
      )
    })

    test('throws when supabase call itself rejects', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'))

      await expect(service.signInWithPassword('a@test.com', 'pass')).rejects.toThrow('Network error')
    })
  })

  // ── signInWithOAuth ─────────────────────────────────────────────────────────
  describe('signInWithOAuth', () => {
    test('calls supabase with provider and options', async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: null })

      await service.signInWithOAuth('google', { redirectTo: 'http://localhost/callback' })

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options:  { redirectTo: 'http://localhost/callback' },
      })
    })

    test('throws the error returned by the OAuth provider', async () => {
      const err = new Error('OAuth provider error')
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: err })

      await expect(service.signInWithOAuth('google', {})).rejects.toThrow('OAuth provider error')
    })

    test('resolves without error on success', async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: null })

      await expect(service.signInWithOAuth('github', { redirectTo: '/' })).resolves.not.toThrow()
    })
  })

  // ── signUp ──────────────────────────────────────────────────────────────────
  describe('signUp', () => {
    test('returns the user object on successful registration', async () => {
      const user = { id: 'new-user-id', email: 'new@test.com' }
      mockSupabase.auth.signUp.mockResolvedValue({ data: { user }, error: null })

      expect(await service.signUp('new@test.com', 'securePass1')).toBe(user)
    })

    test('throws when the email is already registered', async () => {
      const err = new Error('User already registered')
      mockSupabase.auth.signUp.mockResolvedValue({ data: {}, error: err })

      await expect(service.signUp('dup@test.com', 'pass')).rejects.toThrow('User already registered')
    })

    test('throws a weak-password error from supabase', async () => {
      const err = new Error('Password should be at least 6 characters')
      mockSupabase.auth.signUp.mockResolvedValue({ data: {}, error: err })

      await expect(service.signUp('user@test.com', '123')).rejects.toThrow(
        'Password should be at least 6 characters'
      )
    })
  })

  // ── signOut ─────────────────────────────────────────────────────────────────
  describe('signOut', () => {
    test('calls supabase.auth.signOut exactly once', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({})

      await service.signOut()

      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1)
    })

    test('resolves without throwing on success', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({})

      await expect(service.signOut()).resolves.not.toThrow()
    })
  })
})
