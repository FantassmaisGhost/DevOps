'use strict'

/**
 * __tests__/notifications.test.js
 * Tests for backend/notificationService.js  (the ES-module version with exports)
 *
 * Strategy:
 *  - jest.mock('../backend/supabase.js') intercepts the module before it tries
 *    to call the CDN createClient, providing a plain mock instead.
 *  - global.fetch is replaced with a jest.fn() for each group of email tests.
 */

// Mock the Supabase module BEFORE importing NotificationService so Jest
// replaces the real (CDN-importing) module with our mock everywhere.
jest.mock('../backend/supabase.js', () => ({
  supabase:    { from: jest.fn() },
  supabaseKey: 'test-key',
  supabaseUrl: 'https://test.supabase.co',
}))

const { NotificationService } = require('../backend/notificationService.js')
const { supabase }            = require('../backend/supabase.js')

// ─── Supabase chain helper ───────────────────────────────────────────────────
// The chain is "thenable" so awaiting it resolves to `resolvedValue` regardless
// of which builder method is the terminal call.
function makeChain(resolvedValue) {
  const then = (resolve) => Promise.resolve(resolvedValue).then(resolve)
  const chain = { then }
  ;['select','eq','or','update','insert','delete','order','not','limit'].forEach(
    m => { chain[m] = jest.fn(() => chain) }
  )
  return chain
}

// ─────────────────────────────────────────────────────────────────────────────

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset global fetch stub before each test
    global.fetch = jest.fn()
  })

  // ── sendEmailNotification ───────────────────────────────────────────────────
  describe('sendEmailNotification', () => {
    test('returns true when fetch responds with ok:true', async () => {
      global.fetch.mockResolvedValue({ ok: true })

      const result = await NotificationService.sendEmailNotification(
        'patient@example.com', 'Appointment Confirmed', '<p>See you soon</p>'
      )

      expect(result).toBe(true)
    })

    test('returns false when fetch responds with ok:false', async () => {
      global.fetch.mockResolvedValue({ ok: false })

      const result = await NotificationService.sendEmailNotification(
        'patient@example.com', 'Subject', '<p>body</p>'
      )

      expect(result).toBe(false)
    })

    test('returns false and does not throw when fetch rejects (network error)', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))

      const result = await NotificationService.sendEmailNotification(
        'patient@example.com', 'Subject', '<p>body</p>'
      )

      expect(result).toBe(false)
    })

    test('sends a POST request with JSON content-type', async () => {
      global.fetch.mockResolvedValue({ ok: true })

      await NotificationService.sendEmailNotification('to@test.com', 'Sub', '<p>hi</p>')

      const [, opts] = global.fetch.mock.calls[0]
      expect(opts.method).toBe('POST')
      expect(opts.headers['Content-Type']).toBe('application/json')
    })

    test('includes email, subject, and html in the request body', async () => {
      global.fetch.mockResolvedValue({ ok: true })

      await NotificationService.sendEmailNotification('to@test.com', 'Hello', '<b>World</b>')

      const [, opts] = global.fetch.mock.calls[0]
      const body = JSON.parse(opts.body)
      expect(body.email).toBe('to@test.com')
      expect(body.subject).toBe('Hello')
      expect(body.html).toBe('<b>World</b>')
    })
  })

  // ── createDatabaseNotification ──────────────────────────────────────────────
  describe('createDatabaseNotification', () => {
    test('returns true on successful insert', async () => {
      supabase.from.mockReturnValue(makeChain({ error: null }))

      const result = await NotificationService.createDatabaseNotification(
        'user-1', 'appt-1', 'Your appointment is confirmed', 'appointment'
      )

      expect(result).toBe(true)
    })

    test('returns false when the insert fails', async () => {
      supabase.from.mockReturnValue(makeChain({ error: { message: 'Insert failed' } }))

      const result = await NotificationService.createDatabaseNotification(
        'user-1', 'appt-1', 'msg', 'appointment'
      )

      expect(result).toBe(false)
    })

    test('defaults type to "appointment" when not provided', async () => {
      const chain = makeChain({ error: null })
      supabase.from.mockReturnValue(chain)

      await NotificationService.createDatabaseNotification('user-1', 'appt-1', 'msg')

      // The insert was called — verify is_read defaults to false
      expect(chain.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'appointment', is_read: false }),
        ])
      )
    })

    test('returns false without throwing when supabase.from throws', async () => {
      supabase.from.mockImplementation(() => { throw new Error('Unexpected crash') })

      const result = await NotificationService.createDatabaseNotification('u', 'a', 'msg')

      expect(result).toBe(false)
    })
  })

  // ── getUserNotifications ────────────────────────────────────────────────────
  describe('getUserNotifications', () => {
    test('returns the notifications array on success', async () => {
      const notifs = [
        { id: 1, message: 'Appointment booked', is_read: false },
        { id: 2, message: 'Appointment cancelled', is_read: true },
      ]
      supabase.from.mockReturnValue(makeChain({ data: notifs, error: null }))

      const result = await NotificationService.getUserNotifications('user-1')

      expect(result).toEqual(notifs)
      expect(result).toHaveLength(2)
    })

    test('returns [] when data is null', async () => {
      supabase.from.mockReturnValue(makeChain({ data: null, error: null }))

      expect(await NotificationService.getUserNotifications('user-2')).toEqual([])
    })

    test('returns [] on database error', async () => {
      supabase.from.mockReturnValue(
        makeChain({ data: null, error: { message: 'DB error' } })
      )

      expect(await NotificationService.getUserNotifications('user-3')).toEqual([])
    })

    test('returns [] without throwing on exception', async () => {
      supabase.from.mockImplementation(() => { throw new Error('Crash') })

      expect(await NotificationService.getUserNotifications('user-4')).toEqual([])
    })
  })

  // ── markNotificationAsRead ──────────────────────────────────────────────────
  describe('markNotificationAsRead', () => {
    test('returns true on success', async () => {
      supabase.from.mockReturnValue(makeChain({ error: null }))

      expect(await NotificationService.markNotificationAsRead('notif-1')).toBe(true)
    })

    test('returns false on database error', async () => {
      supabase.from.mockReturnValue(makeChain({ error: { message: 'Update failed' } }))

      expect(await NotificationService.markNotificationAsRead('notif-1')).toBe(false)
    })

    test('returns false without throwing on exception', async () => {
      supabase.from.mockImplementation(() => { throw new Error('Crash') })

      expect(await NotificationService.markNotificationAsRead('notif-1')).toBe(false)
    })
  })

  // ── markAllNotificationsAsRead ──────────────────────────────────────────────
  describe('markAllNotificationsAsRead', () => {
    test('returns true when all notifications are marked read', async () => {
      supabase.from.mockReturnValue(makeChain({ error: null }))

      expect(await NotificationService.markAllNotificationsAsRead('user-1')).toBe(true)
    })

    test('returns false on database error', async () => {
      supabase.from.mockReturnValue(makeChain({ error: { message: 'Update failed' } }))

      expect(await NotificationService.markAllNotificationsAsRead('user-1')).toBe(false)
    })

    test('returns false without throwing on exception', async () => {
      supabase.from.mockImplementation(() => { throw new Error('Crash') })

      expect(await NotificationService.markAllNotificationsAsRead('user-1')).toBe(false)
    })
  })

  // ── deleteNotification ──────────────────────────────────────────────────────
  describe('deleteNotification', () => {
    test('returns true on successful delete', async () => {
      supabase.from.mockReturnValue(makeChain({ error: null }))

      expect(await NotificationService.deleteNotification('notif-1')).toBe(true)
    })

    test('returns false on database error', async () => {
      supabase.from.mockReturnValue(makeChain({ error: { message: 'Delete failed' } }))

      expect(await NotificationService.deleteNotification('notif-2')).toBe(false)
    })

    test('returns false without throwing on exception', async () => {
      supabase.from.mockImplementation(() => { throw new Error('Crash') })

      expect(await NotificationService.deleteNotification('notif-3')).toBe(false)
    })
  })

  // ── getUnreadCount ──────────────────────────────────────────────────────────
  describe('getUnreadCount', () => {
    test('returns the unread notification count', async () => {
      supabase.from.mockReturnValue(makeChain({ count: 7, error: null }))

      expect(await NotificationService.getUnreadCount('user-1')).toBe(7)
    })

    test('returns 0 when count is null', async () => {
      supabase.from.mockReturnValue(makeChain({ count: null, error: null }))

      expect(await NotificationService.getUnreadCount('user-1')).toBe(0)
    })

    test('returns 0 on database error', async () => {
      supabase.from.mockReturnValue(
        makeChain({ count: null, error: { message: 'DB error' } })
      )

      expect(await NotificationService.getUnreadCount('user-2')).toBe(0)
    })

    test('returns 0 without throwing on exception', async () => {
      supabase.from.mockImplementation(() => { throw new Error('Crash') })

      expect(await NotificationService.getUnreadCount('user-3')).toBe(0)
    })

    test('returns 0 when count is explicitly 0', async () => {
      supabase.from.mockReturnValue(makeChain({ count: 0, error: null }))

      expect(await NotificationService.getUnreadCount('user-4')).toBe(0)
    })
  })
})
