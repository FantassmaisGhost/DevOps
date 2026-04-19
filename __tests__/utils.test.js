/**
 * __tests__/utils.test.js
 * Unit tests for backend/utils.js
 * Target: ≥ 50% overall coverage (these tests alone cover ~100% of utils.js)
 */

'use strict'

const {
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
} = require('../backend/utils')

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
})