/**
 * __tests__/utils.test.js
 * Unit tests for backend/utils.js
 * Target: ≥ 50% overall coverage (these tests alone cover ~100% of utils.js)
 */

'use strict'

/**
 * __tests__/utils.test.js
 * Unit tests for backend/utils.js
 * Target: ≥ 50% overall coverage (these tests alone cover ~100% of utils.js)
 */

'use strict'

import { Utils } from '../backend/utils.js'
import {
  DAY_NAMES,
  DAY_SHORT,
  MONTH_NAMES,
  SLOT_MINUTES,
  generateSlots,
  fmtTime,
  esc,
  haversineKm,
  getMarkerColor,
  generateRefCode,
  defaultHoursMap,
  formatDateISO,
  isToday,
  isPastDate,
  validateBookingForm,
  filterFacilities,
} from '../backend/utils.js'

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────
describe('Constants', () => {
  test('DAY_NAMES has 7 entries starting with Sunday', () => {
    expect(DAY_NAMES).toHaveLength(7)
    expect(DAY_NAMES[0]).toBe('Sunday')
    expect(DAY_NAMES[6]).toBe('Saturday')
  })

  test('DAY_SHORT has 7 entries', () => {
    expect(DAY_SHORT).toHaveLength(7)
    expect(DAY_SHORT[0]).toBe('Su')
    expect(DAY_SHORT[6]).toBe('Sa')
  })

  test('MONTH_NAMES has 12 entries', () => {
    expect(MONTH_NAMES).toHaveLength(12)
    expect(MONTH_NAMES[0]).toBe('January')
    expect(MONTH_NAMES[11]).toBe('December')
  })

  test('SLOT_MINUTES is 30', () => {
    expect(SLOT_MINUTES).toBe(30)
  })
})

// ────────────────────────────────────────────────────────────
// generateSlots
// ────────────────────────────────────────────────────────────
describe('generateSlots', () => {
  test('generates correct slots for 08:00–10:00 (4 slots)', () => {
    const slots = generateSlots('08:00:00', '10:00:00')
    expect(slots).toEqual(['08:00', '08:30', '09:00', '09:30'])
  })

  test('generates single slot when window equals interval', () => {
    const slots = generateSlots('09:00', '09:30')
    expect(slots).toEqual(['09:00'])
  })

  test('returns empty array when open equals close', () => {
    expect(generateSlots('09:00', '09:00')).toEqual([])
  })

  test('returns empty array when open is after close', () => {
    expect(generateSlots('17:00', '08:00')).toEqual([])
  })

  test('returns empty array for null inputs', () => {
    expect(generateSlots(null, '17:00')).toEqual([])
    expect(generateSlots('08:00', null)).toEqual([])
    expect(generateSlots(null, null)).toEqual([])
  })

  test('handles HH:MM format (no seconds)', () => {
    const slots = generateSlots('08:00', '09:00')
    expect(slots).toEqual(['08:00', '08:30'])
  })

  test('respects custom interval (60 minutes)', () => {
    const slots = generateSlots('08:00', '11:00', 60)
    expect(slots).toEqual(['08:00', '09:00', '10:00'])
  })

  test('returns empty array for non-positive interval', () => {
    expect(generateSlots('08:00', '10:00', 0)).toEqual([])
    expect(generateSlots('08:00', '10:00', -10)).toEqual([])
  })

  test('does not include a slot that would run over closing time', () => {
    // 08:00–09:00 with 40-min slots → only 08:00 fits
    const slots = generateSlots('08:00', '09:00', 40)
    expect(slots).toEqual(['08:00'])
  })

  test('pads hours and minutes with leading zeros', () => {
    const slots = generateSlots('09:00', '09:30')
    expect(slots[0]).toMatch(/^\d{2}:\d{2}$/)
  })

  test('handles full working day 08:00–17:00 (18 slots)', () => {
    const slots = generateSlots('08:00:00', '17:00:00')
    expect(slots).toHaveLength(18)
    expect(slots[0]).toBe('08:00')
    expect(slots[slots.length - 1]).toBe('16:30')
  })

  test('returns empty array for invalid time strings', () => {
    expect(generateSlots('invalid', '10:00')).toEqual([])
    expect(generateSlots('08:00', 'invalid')).toEqual([])
  })
})

// ────────────────────────────────────────────────────────────
// fmtTime
// ────────────────────────────────────────────────────────────
describe('fmtTime', () => {
  test('trims seconds from HH:MM:SS', () => {
    expect(fmtTime('08:30:00')).toBe('08:30')
  })

  test('returns HH:MM unchanged', () => {
    expect(fmtTime('14:00')).toBe('14:00')
  })

  test('returns empty string for null', () => {
    expect(fmtTime(null)).toBe('')
  })

  test('returns empty string for undefined', () => {
    expect(fmtTime(undefined)).toBe('')
  })

  test('returns empty string for empty string', () => {
    expect(fmtTime('')).toBe('')
  })

  test('handles midnight 00:00:00', () => {
    expect(fmtTime('00:00:00')).toBe('00:00')
  })
})

// ────────────────────────────────────────────────────────────
// esc
// ────────────────────────────────────────────────────────────
describe('esc', () => {
  test('escapes ampersand', () => {
    expect(esc('a & b')).toBe('a &amp; b')
  })

  test('escapes less-than', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;')
  })

  test('escapes greater-than', () => {
    expect(esc('a > b')).toBe('a &gt; b')
  })

  test('escapes double quotes', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;')
  })

  test('escapes single quotes', () => {
    expect(esc("it's")).toBe('it&#039;s')
  })

  test('returns empty string for null', () => {
    expect(esc(null)).toBe('')
  })

  test('returns empty string for undefined', () => {
    expect(esc(undefined)).toBe('')
  })

  test('leaves safe strings unchanged', () => {
    expect(esc('Hello World')).toBe('Hello World')
  })

  test('handles numbers coerced to strings', () => {
    expect(esc(42)).toBe('42')
  })

  test('handles XSS payload', () => {
    const result = esc('<img src=x onerror="alert(1)">')
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })
})

// ────────────────────────────────────────────────────────────
// haversineKm
// ────────────────────────────────────────────────────────────
describe('haversineKm', () => {
  test('distance from a point to itself is 0', () => {
    expect(haversineKm(-26.2, 28.0, -26.2, 28.0)).toBeCloseTo(0, 5)
  })

  test('Johannesburg to Cape Town is ~1270 km', () => {
    // JHB: -26.2041, 28.0473  |  CPT: -33.9249, 18.4241
    const dist = haversineKm(-26.2041, 28.0473, -33.9249, 18.4241)
    expect(dist).toBeGreaterThan(1200)
    expect(dist).toBeLessThan(1350)
  })

  test('Pretoria to Johannesburg is ~50 km', () => {
    // PTA: -25.7479, 28.2293  |  JHB: -26.2041, 28.0473
    const dist = haversineKm(-25.7479, 28.2293, -26.2041, 28.0473)
    expect(dist).toBeGreaterThan(40)
    expect(dist).toBeLessThan(60)
  })

  test('is symmetric (A→B equals B→A)', () => {
    const ab = haversineKm(-26.0, 28.0, -30.0, 25.0)
    const ba = haversineKm(-30.0, 25.0, -26.0, 28.0)
    expect(ab).toBeCloseTo(ba, 5)
  })

  test('returns positive value for different points', () => {
    expect(haversineKm(-26.0, 28.0, -27.0, 29.0)).toBeGreaterThan(0)
  })
})

// ────────────────────────────────────────────────────────────
// getMarkerColor
// ────────────────────────────────────────────────────────────
describe('getMarkerColor', () => {
  test('private facility → coral red', () => {
    expect(getMarkerColor({ sector: 'private', type: 'clinic' })).toBe('#ff6b6b')
  })

  test('private hospital still → coral red (sector takes priority)', () => {
    expect(getMarkerColor({ sector: 'private', type: 'hospital' })).toBe('#ff6b6b')
  })

  test('public hospital → blue', () => {
    expect(getMarkerColor({ sector: 'public', type: 'hospital' })).toBe('#60b4ff')
  })

  test('public clinic → teal-green', () => {
    expect(getMarkerColor({ sector: 'public', type: 'clinic' })).toBe('#00e5a0')
  })

  test('unknown sector and type → default teal-green', () => {
    expect(getMarkerColor({ sector: 'ngo', type: 'other' })).toBe('#00e5a0')
  })
})

// ────────────────────────────────────────────────────────────
// generateRefCode
// ────────────────────────────────────────────────────────────
describe('generateRefCode', () => {
  test('starts with BK-', () => {
    expect(generateRefCode()).toMatch(/^BK-/)
  })

  test('is a non-empty string', () => {
    const code = generateRefCode()
    expect(typeof code).toBe('string')
    expect(code.length).toBeGreaterThan(3)
  })

  test('successive calls produce different codes (almost certainly)', () => {
    // Very unlikely to collide within the same ms but not guaranteed
    const codes = new Set(Array.from({ length: 10 }, generateRefCode))
    // At least some should differ
    expect(codes.size).toBeGreaterThan(1)
  })
})

// ────────────────────────────────────────────────────────────
// defaultHoursMap
// ────────────────────────────────────────────────────────────
describe('defaultHoursMap', () => {
  let map

  beforeEach(() => {
    map = defaultHoursMap()
  })

  test('returns an object with all 7 day keys', () => {
    DAY_NAMES.forEach(day => expect(map).toHaveProperty(day))
  })

  test('weekdays are open 08:00–17:00', () => {
    const weekdays = ['Monday','Tuesday','Wednesday','Thursday','Friday']
    weekdays.forEach(day => {
      expect(map[day].isopen).toBe(true)
      expect(map[day].opentime).toBe('08:00:00')
      expect(map[day].closingtime).toBe('17:00:00')
    })
  })

  test('Saturday and Sunday are closed', () => {
    expect(map['Saturday'].isopen).toBe(false)
    expect(map['Sunday'].isopen).toBe(false)
  })

  test('weekend opentime and closingtime are null', () => {
    expect(map['Saturday'].opentime).toBeNull()
    expect(map['Saturday'].closingtime).toBeNull()
    expect(map['Sunday'].opentime).toBeNull()
    expect(map['Sunday'].closingtime).toBeNull()
  })

  test('returns a new object each call (not a shared reference)', () => {
    const map2 = defaultHoursMap()
    map2['Monday'].isopen = false
    expect(defaultHoursMap()['Monday'].isopen).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────
// formatDateISO
// ────────────────────────────────────────────────────────────
describe('formatDateISO', () => {
  test('formats a date to YYYY-MM-DD', () => {
    expect(formatDateISO(new Date(2025, 0, 5))).toBe('2025-01-05')
  })

  test('pads single-digit month and day', () => {
    expect(formatDateISO(new Date(2025, 2, 9))).toBe('2025-03-09')
  })

  test('handles end-of-year date', () => {
    expect(formatDateISO(new Date(2025, 11, 31))).toBe('2025-12-31')
  })

  test('handles leap year Feb 29', () => {
    expect(formatDateISO(new Date(2024, 1, 29))).toBe('2024-02-29')
  })
})

// ────────────────────────────────────────────────────────────
// isToday
// ────────────────────────────────────────────────────────────
describe('isToday', () => {
  const fakeNow = new Date(2025, 5, 15, 12, 0, 0) // 15 Jun 2025 noon

  test('returns true for the same calendar day', () => {
    expect(isToday(new Date(2025, 5, 15, 0, 0, 0), fakeNow)).toBe(true)
  })

  test('returns false for yesterday', () => {
    expect(isToday(new Date(2025, 5, 14), fakeNow)).toBe(false)
  })

  test('returns false for tomorrow', () => {
    expect(isToday(new Date(2025, 5, 16), fakeNow)).toBe(false)
  })

  test('returns false for same day but different year', () => {
    expect(isToday(new Date(2024, 5, 15), fakeNow)).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────
// isPastDate
// ────────────────────────────────────────────────────────────
describe('isPastDate', () => {
  const fakeNow = new Date(2025, 5, 15, 12, 0, 0)

  test('returns true for a date before today', () => {
    expect(isPastDate(new Date(2025, 5, 14), fakeNow)).toBe(true)
  })

  test('returns false for today', () => {
    expect(isPastDate(new Date(2025, 5, 15), fakeNow)).toBe(false)
  })

  test('returns false for a future date', () => {
    expect(isPastDate(new Date(2025, 5, 16), fakeNow)).toBe(false)
  })

  test('returns true for a date in a previous year', () => {
    expect(isPastDate(new Date(2024, 5, 15), fakeNow)).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────
// validateBookingForm
// ────────────────────────────────────────────────────────────
describe('validateBookingForm', () => {
  test('returns valid for complete fields', () => {
    const result = validateBookingForm({
      firstName: 'Thabo', lastName: 'Nkosi', phone: '0712345678',
    })
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
  })

  test('fails when firstName is missing', () => {
    const r = validateBookingForm({ firstName: '', lastName: 'Nkosi', phone: '071' })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/first name/i)
  })

  test('fails when firstName is only whitespace', () => {
    const r = validateBookingForm({ firstName: '   ', lastName: 'Nkosi', phone: '071' })
    expect(r.valid).toBe(false)
  })

  test('fails when lastName is missing', () => {
    const r = validateBookingForm({ firstName: 'Thabo', lastName: '', phone: '071' })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/last name/i)
  })

  test('fails when phone is missing', () => {
    const r = validateBookingForm({ firstName: 'Thabo', lastName: 'Nkosi', phone: '' })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/phone/i)
  })

  test('fails gracefully with no arguments', () => {
    const r = validateBookingForm()
    expect(r.valid).toBe(false)
  })

  test('fails gracefully with null fields', () => {
    const r = validateBookingForm({ firstName: null, lastName: null, phone: null })
    expect(r.valid).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────
// filterFacilities
// ────────────────────────────────────────────────────────────
describe('filterFacilities', () => {
  // Minimal fixture dataset
  const facilities = [
    { name: 'Aberdeen Hospital', type: 'hospital', sector: 'public',  province: 'Eastern Cape', city: 'Aberdeen',  lat: -32.4862, lng: 24.0609 },
    { name: 'Addo Clinic',       type: 'clinic',   sector: 'public',  province: 'Eastern Cape', city: 'Addo',     lat: -33.5422, lng: 25.6908 },
    { name: 'Cape Town Medical', type: 'hospital', sector: 'private', province: 'Western Cape',  city: 'Cape Town',lat: -33.9249, lng: 18.4241 },
    { name: 'Joburg Wellness',   type: 'clinic',   sector: 'private', province: 'Gauteng',      city: 'Joburg',   lat: -26.2041, lng: 28.0473 },
    { name: 'Pretoria Clinic',   type: 'clinic',   sector: 'public',  province: 'Gauteng',      city: 'Pretoria', lat: -25.7479, lng: 28.2293 },
  ]

  test('returns all when no filters applied', () => {
    expect(filterFacilities(facilities, {})).toHaveLength(5)
  })

  test('filters by text query (name match)', () => {
    const result = filterFacilities(facilities, { query: 'aberdeen' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Aberdeen Hospital')
  })

  test('filters by text query (city match)', () => {
    const result = filterFacilities(facilities, { query: 'cape town' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Cape Town Medical')
  })

  test('filters by text query (province match)', () => {
    const result = filterFacilities(facilities, { query: 'gauteng' })
    expect(result).toHaveLength(2)
  })

  test('returns empty array when query matches nothing', () => {
    expect(filterFacilities(facilities, { query: 'xyznotexist' })).toHaveLength(0)
  })

  test('filters by province', () => {
    const result = filterFacilities(facilities, { province: 'Gauteng' })
    expect(result).toHaveLength(2)
    result.forEach(f => expect(f.province).toBe('Gauteng'))
  })

  test('filters by type = hospital', () => {
    const result = filterFacilities(facilities, { type: 'hospital' })
    expect(result).toHaveLength(2)
    result.forEach(f => expect(f.type).toBe('hospital'))
  })

  test('filters by type = clinic', () => {
    const result = filterFacilities(facilities, { type: 'clinic' })
    expect(result).toHaveLength(3)
  })

  test('filters by sector = private', () => {
    const result = filterFacilities(facilities, { sector: 'private' })
    expect(result).toHaveLength(2)
    result.forEach(f => expect(f.sector).toBe('private'))
  })

  test('filters by sector = public', () => {
    const result = filterFacilities(facilities, { sector: 'public' })
    expect(result).toHaveLength(3)
  })

  test('combines province + type filters', () => {
    const result = filterFacilities(facilities, { province: 'Eastern Cape', type: 'clinic' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Addo Clinic')
  })

  test('combines province + sector filters', () => {
    const result = filterFacilities(facilities, { province: 'Gauteng', sector: 'public' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Pretoria Clinic')
  })

  test('radius filter excludes distant facilities', () => {
    // Reference point: Pretoria (-25.7479, 28.2293)
    // Pretoria Clinic is ~0 km away; JHB Wellness is ~50 km
    const result = filterFacilities(facilities, {
      userLat: -25.7479, userLng: 28.2293, activeRadius: 10,
    })
    const names = result.map(f => f.name)
    expect(names).toContain('Pretoria Clinic')
    expect(names).not.toContain('Cape Town Medical')
  })

  test('radius=0 with location set does not filter by distance', () => {
    const result = filterFacilities(facilities, {
      userLat: -25.7479, userLng: 28.2293, activeRadius: 0,
    })
    expect(result).toHaveLength(5)
  })

  test('returns empty array for empty input', () => {
    expect(filterFacilities([], { query: 'anything' })).toHaveLength(0)
  })

  test('query is case-insensitive', () => {
    expect(filterFacilities(facilities, { query: 'PRETORIA' })).toHaveLength(1)
    expect(filterFacilities(facilities, { query: 'pretoria' })).toHaveLength(1)
  })

  describe('generateSlots — additional', () => {
  test('45-minute interval fits correctly into a 3-hour window', () => {
    // 08:00–11:00 → 08:00, 08:45, 09:30, 10:15
    const slots = generateSlots('08:00:00', '11:00:00', 45)
    expect(slots).toEqual(['08:00', '08:45', '09:30', '10:15'])
  })
 
  test('slot at exactly closing time is excluded', () => {
    // 08:00–09:00 with 60-min interval → only 08:00 fits; 09:00 is the boundary
    const slots = generateSlots('08:00:00', '09:00:00', 60)
    expect(slots).toEqual(['08:00'])
    expect(slots).not.toContain('09:00')
  })
 
  test('generates slots spanning midnight boundary correctly (early morning)', () => {
    // 00:00–01:00
    const slots = generateSlots('00:00:00', '01:00:00', 30)
    expect(slots).toEqual(['00:00', '00:30'])
  })
 
  test('very short interval (1 minute) produces many slots', () => {
    const slots = generateSlots('08:00:00', '08:05:00', 1)
    expect(slots).toHaveLength(5)
    expect(slots[0]).toBe('08:00')
    expect(slots[4]).toBe('08:04')
  })
 
  test('interval larger than window returns empty array', () => {
    // 30-minute window, 60-minute interval → no slot fits
    const slots = generateSlots('08:00:00', '08:30:00', 60)
    expect(slots).toEqual([])
  })
 
  test('all returned slots match HH:MM format', () => {
    const slots = generateSlots('07:00:00', '10:00:00', 30)
    slots.forEach(s => expect(s).toMatch(/^\d{2}:\d{2}$/))
  })
 
  test('start time with non-zero minutes is handled correctly', () => {
    // 08:15–09:15 with 30 min → 08:15, 08:45
    const slots = generateSlots('08:15:00', '09:15:00', 30)
    expect(slots).toEqual(['08:15', '08:45'])
  })
})
 
// ────────────────────────────────────────────────────────────
// fmtTime — additional edge cases
// ────────────────────────────────────────────────────────────
describe('fmtTime — additional', () => {
  test('handles a time string shorter than 5 characters', () => {
    // '8:30' → returns '8:30' (slice(0,5) on 4-char string is fine)
    expect(fmtTime('8:30')).toBe('8:30')
  })
 
  test('handles numeric zero (falsy) and returns empty string', () => {
    expect(fmtTime(0)).toBe('')
  })
 
  test('returns only first 5 characters when string is longer than HH:MM:SS', () => {
    expect(fmtTime('12:34:56.789')).toBe('12:34')
  })
 
  test('treats false as falsy and returns empty string', () => {
    expect(fmtTime(false)).toBe('')
  })
})
 
// ────────────────────────────────────────────────────────────
// esc — additional edge cases
// ────────────────────────────────────────────────────────────
describe('esc — additional', () => {
  test('escapes multiple special characters in one string', () => {
    const result = esc('<b>Tom & "Jerry"</b>')
    expect(result).toBe('&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt;')
  })
 
  test('escapes a script injection attempt', () => {
    const result = esc('<script>alert("xss")</script>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('"')
  })
 
  test('handles an empty string', () => {
    expect(esc('')).toBe('')
  })
 
  test('handles a boolean true', () => {
    expect(esc(true)).toBe('true')
  })
 
  test('handles an object (coerces via toString)', () => {
    expect(esc({ toString: () => 'safe' })).toBe('safe')
  })
 
  test('handles a string with only special characters', () => {
    expect(esc('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#039;')
  })
 
  test('does not double-escape already escaped strings', () => {
    // The function escapes raw characters — it is not idempotent by design
    const once = esc('&')
    expect(once).toBe('&amp;')
    // Calling again on the output should escape the ampersand again
    const twice = esc(once)
    expect(twice).toBe('&amp;amp;')
  })
})
 
// ────────────────────────────────────────────────────────────
// haversineKm — additional edge cases
// ────────────────────────────────────────────────────────────
describe('haversineKm — additional', () => {
  test('returns a number type', () => {
    expect(typeof haversineKm(-26.0, 28.0, -27.0, 29.0)).toBe('number')
  })
 
  test('Durban to Johannesburg is roughly 500–600 km', () => {
    // DUR: -29.8587, 31.0218  |  JHB: -26.2041, 28.0473
    const dist = haversineKm(-29.8587, 31.0218, -26.2041, 28.0473)
    expect(dist).toBeGreaterThan(450)
    expect(dist).toBeLessThan(650)
  })
 
  test('crossing the equator gives a positive distance', () => {
    const dist = haversineKm(1.0, 0.0, -1.0, 0.0)
    expect(dist).toBeGreaterThan(0)
    expect(dist).toBeCloseTo(222.4, 0)
  })
 
  test('very close points (< 1 km) produce a near-zero result', () => {
    // Two points ~100m apart
    const dist = haversineKm(-26.2041, 28.0473, -26.2050, 28.0480)
    expect(dist).toBeGreaterThan(0)
    expect(dist).toBeLessThan(0.2)
  })
 
  test('distance is never negative', () => {
    const dist = haversineKm(-33.9249, 18.4241, -25.7479, 28.2293)
    expect(dist).toBeGreaterThanOrEqual(0)
  })
})
 
// ────────────────────────────────────────────────────────────
// getMarkerColor — additional edge cases
// ────────────────────────────────────────────────────────────
describe('getMarkerColor — additional', () => {
  test('private clinic returns private color (not hospital color)', () => {
    const color = getMarkerColor({ sector: 'private', type: 'clinic' })
    expect(color).toBe('#ff6b6b')
  })
 
  test('private hospital also returns private color (sector takes priority)', () => {
    const color = getMarkerColor({ sector: 'private', type: 'hospital' })
    expect(color).toBe('#ff6b6b')
  })
 
  test('public hospital returns hospital color', () => {
    const color = getMarkerColor({ sector: 'public', type: 'hospital' })
    expect(color).toBe('#60b4ff')
  })
 
  test('public clinic returns default clinic color', () => {
    const color = getMarkerColor({ sector: 'public', type: 'clinic' })
    expect(color).toBe('#00e5a0')
  })
 
  test('public CHC (type=chc) returns default color', () => {
    const color = getMarkerColor({ sector: 'public', type: 'chc' })
    expect(color).toBe('#00e5a0')
  })
 
  test('unknown sector and unknown type returns default color', () => {
    const color = getMarkerColor({ sector: 'unknown', type: 'unknown' })
    expect(color).toBe('#00e5a0')
  })
 
  test('returns a valid hex color string in all cases', () => {
    const cases = [
      { sector: 'private', type: 'clinic' },
      { sector: 'public', type: 'hospital' },
      { sector: 'public', type: 'clinic' },
    ]
    cases.forEach(f => {
      expect(getMarkerColor(f)).toMatch(/^#[0-9a-fA-F]{6}$/)
    })
  })
})
 
// ────────────────────────────────────────────────────────────
// generateRefCode — additional edge cases
// ────────────────────────────────────────────────────────────
describe('generateRefCode — additional', () => {
  test('always starts with "BK-"', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateRefCode()).toMatch(/^BK-/)
    }
  })
 
  test('is always at least 7 characters long', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateRefCode().length).toBeGreaterThanOrEqual(7)
    }
  })
 
  test('contains only uppercase alphanumeric characters after the prefix', () => {
    for (let i = 0; i < 20; i++) {
      const suffix = generateRefCode().replace('BK-', '')
      expect(suffix).toMatch(/^[A-Z0-9]+$/)
    }
  })
 
  test('two calls in rapid succession produce different codes (usually)', () => {
    // Probabilistic — could theoretically collide but extremely unlikely
    const codes = new Set(Array.from({ length: 50 }, () => generateRefCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})
 
// ────────────────────────────────────────────────────────────
// defaultHoursMap — additional edge cases
// ────────────────────────────────────────────────────────────
describe('defaultHoursMap — additional', () => {
  test('contains exactly 7 day keys', () => {
    expect(Object.keys(defaultHoursMap())).toHaveLength(7)
  })
 
  test('keys match DAY_NAMES exactly', () => {
    expect(Object.keys(defaultHoursMap())).toEqual(expect.arrayContaining(DAY_NAMES))
  })
 
  test('all weekday entries have isopen = true', () => {
    const map = defaultHoursMap()
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    weekdays.forEach(day => expect(map[day].isopen).toBe(true))
  })
 
  test('weekday opentime is 08:00:00', () => {
    const map = defaultHoursMap()
    expect(map['Monday'].opentime).toBe('08:00:00')
    expect(map['Friday'].opentime).toBe('08:00:00')
  })
 
  test('weekday closingtime is 17:00:00', () => {
    const map = defaultHoursMap()
    expect(map['Tuesday'].closingtime).toBe('17:00:00')
  })
 
  test('mutating one map does not affect another', () => {
    const a = defaultHoursMap()
    const b = defaultHoursMap()
    a['Monday'].opentime = '06:00:00'
    expect(b['Monday'].opentime).toBe('08:00:00')
  })
})
 
// ────────────────────────────────────────────────────────────
// formatDateISO — additional edge cases
// ────────────────────────────────────────────────────────────
describe('formatDateISO — additional', () => {
  test('output is always exactly 10 characters (YYYY-MM-DD)', () => {
    const dates = [
      new Date(2025, 0, 1),
      new Date(2025, 11, 31),
      new Date(2000, 1, 29),
    ]
    dates.forEach(d => expect(formatDateISO(d)).toHaveLength(10))
  })
 
  test('month is always zero-padded', () => {
    // January is month 0 → should produce '01'
    expect(formatDateISO(new Date(2025, 0, 15))).toMatch(/^\d{4}-01-/)
  })
 
  test('day is always zero-padded', () => {
    expect(formatDateISO(new Date(2025, 5, 5))).toMatch(/-05$/)
  })
 
  test('handles year 2000 (Y2K boundary)', () => {
    expect(formatDateISO(new Date(2000, 0, 1))).toBe('2000-01-01')
  })
 
  test('handles a far-future date', () => {
    expect(formatDateISO(new Date(2099, 11, 31))).toBe('2099-12-31')
  })
 
  test('result is a string', () => {
    expect(typeof formatDateISO(new Date(2025, 5, 15))).toBe('string')
  })
})
 
// ────────────────────────────────────────────────────────────
// isToday — additional edge cases
// ────────────────────────────────────────────────────────────
describe('isToday — additional', () => {
  test('returns true regardless of time of day on the same date', () => {
    const now = new Date(2025, 5, 15, 23, 59, 59)
    expect(isToday(new Date(2025, 5, 15, 0, 0, 0), now)).toBe(true)
    expect(isToday(new Date(2025, 5, 15, 23, 59, 59), now)).toBe(true)
  })
 
  test('returns false when month differs', () => {
    const now = new Date(2025, 5, 15)
    expect(isToday(new Date(2025, 4, 15), now)).toBe(false)
  })
 
  test('handles month boundary (last day of month vs first day of next)', () => {
    const now = new Date(2025, 0, 31) // 31 Jan
    expect(isToday(new Date(2025, 1, 1), now)).toBe(false)
  })
})
 
// ────────────────────────────────────────────────────────────
// isPastDate — additional edge cases
// ────────────────────────────────────────────────────────────
describe('isPastDate — additional', () => {
  test('time of day on "today" does not affect the result', () => {
    const now = new Date(2025, 5, 15, 23, 59, 59)
    // Today at midnight should NOT be past
    expect(isPastDate(new Date(2025, 5, 15, 0, 0, 0), now)).toBe(false)
  })
 
  test('one second before midnight of today is still today (not past)', () => {
    const now = new Date(2025, 5, 15, 0, 0, 1)
    expect(isPastDate(new Date(2025, 5, 15), now)).toBe(false)
  })
 
  test('a date in a future year is not past', () => {
    const now = new Date(2025, 5, 15)
    expect(isPastDate(new Date(2030, 0, 1), now)).toBe(false)
  })
 
  test('far past date (year 2000) is past', () => {
    const now = new Date(2025, 5, 15)
    expect(isPastDate(new Date(2000, 0, 1), now)).toBe(true)
  })
})
 
// ────────────────────────────────────────────────────────────
// validateBookingForm — additional edge cases
// ────────────────────────────────────────────────────────────
describe('validateBookingForm — additional', () => {
  test('fails when lastName is only whitespace', () => {
    const r = validateBookingForm({ firstName: 'Thabo', lastName: '   ', phone: '071' })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/last name/i)
  })
 
  test('fails when phone is only whitespace', () => {
    const r = validateBookingForm({ firstName: 'Thabo', lastName: 'Nkosi', phone: '   ' })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/phone/i)
  })
 
  test('accepts names with spaces and hyphens', () => {
    const r = validateBookingForm({
      firstName: 'Mary-Jane', lastName: 'van der Berg', phone: '0821234567',
    })
    expect(r.valid).toBe(true)
  })
 
  test('error is null on success', () => {
    const r = validateBookingForm({ firstName: 'A', lastName: 'B', phone: '1' })
    expect(r.error).toBeNull()
  })
 
  test('returns an object with valid and error keys', () => {
    const r = validateBookingForm({ firstName: 'A', lastName: 'B', phone: '1' })
    expect(r).toHaveProperty('valid')
    expect(r).toHaveProperty('error')
  })
 
  test('fails when called with an empty object', () => {
    const r = validateBookingForm({})
    expect(r.valid).toBe(false)
  })
})
 
// ────────────────────────────────────────────────────────────
// filterFacilities — additional edge cases
// ────────────────────────────────────────────────────────────
describe('filterFacilities — additional', () => {
  const facilities = [
    { name: 'Aberdeen Hospital', type: 'hospital', sector: 'public',  province: 'Eastern Cape', city: 'Aberdeen',  lat: -32.4862, lng: 24.0609 },
    { name: 'Addo Clinic',       type: 'clinic',   sector: 'public',  province: 'Eastern Cape', city: 'Addo',     lat: -33.5422, lng: 25.6908 },
    { name: 'Cape Town Medical', type: 'hospital', sector: 'private', province: 'Western Cape',  city: 'Cape Town',lat: -33.9249, lng: 18.4241 },
    { name: 'Joburg Wellness',   type: 'clinic',   sector: 'private', province: 'Gauteng',      city: 'Joburg',   lat: -26.2041, lng: 28.0473 },
    { name: 'Pretoria Clinic',   type: 'clinic',   sector: 'public',  province: 'Gauteng',      city: 'Pretoria', lat: -25.7479, lng: 28.2293 },
  ]
 
  test('returns a new array (does not mutate the original)', () => {
    const original = [...facilities]
    filterFacilities(facilities, { query: 'aberdeen' })
    expect(facilities).toHaveLength(original.length)
  })
 
  test('query matching is trimmed (leading/trailing spaces ignored)', () => {
    const result = filterFacilities(facilities, { query: '  pretoria  ' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Pretoria Clinic')
  })
 
  test('province filter is case-sensitive (wrong case returns nothing)', () => {
    const result = filterFacilities(facilities, { province: 'gauteng' })
    expect(result).toHaveLength(0)
  })
 
  test('combining all three filters narrows to zero when no match', () => {
    const result = filterFacilities(facilities, {
      province: 'Gauteng', type: 'hospital', sector: 'public',
    })
    expect(result).toHaveLength(0)
  })
 
  test('large radius includes all facilities from a central point', () => {
    // Midpoint of SA — with 2000 km radius, all 5 should be included
    const result = filterFacilities(facilities, {
      userLat: -29.0, userLng: 25.0, activeRadius: 2000,
    })
    expect(result).toHaveLength(5)
  })
 
  test('radius filter with no userLat/userLng set ignores radius', () => {
    // activeRadius set but no coordinates → should return all
    const result = filterFacilities(facilities, { activeRadius: 10 })
    expect(result).toHaveLength(5)
  })
 
  test('query matches on province name (full word)', () => {
    const result = filterFacilities(facilities, { query: 'Western Cape' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Cape Town Medical')
  })
 
  test('filters correctly when all criteria match multiple facilities', () => {
    const result = filterFacilities(facilities, { type: 'clinic', sector: 'public' })
    expect(result).toHaveLength(2)
    result.forEach(f => {
      expect(f.type).toBe('clinic')
      expect(f.sector).toBe('public')
    })
  })
 
  test('handles facilities with no matching province gracefully', () => {
    const result = filterFacilities(facilities, { province: 'Limpopo' })
    expect(result).toHaveLength(0)
  })
})
})