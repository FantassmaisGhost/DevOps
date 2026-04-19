/* ============================================================
   utils.js — Pure helper functions (no DOM, no Supabase)
   Shared between booking.js, directory.js, and test suite.
   ============================================================ */

// ── Constants ────────────────────────────────────────────────
const DAY_NAMES = [
  'Sunday','Monday','Tuesday','Wednesday',
  'Thursday','Friday','Saturday',
]

const DAY_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa']

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const SLOT_MINUTES = 30

// ── Time-slot generation ─────────────────────────────────────
/**
 * Generate time slots between opentime and closingtime at
 * SLOT_MINUTES intervals.
 *
 * @param {string} opentime    - e.g. '08:00:00' or '08:00'
 * @param {string} closingtime - e.g. '17:00:00' or '17:00'
 * @param {number} [intervalMinutes=SLOT_MINUTES]
 * @returns {string[]} Array of 'HH:MM' strings
 */
function generateSlots(opentime, closingtime, intervalMinutes = SLOT_MINUTES) {
  if (!opentime || !closingtime) return []

  const [oh, om] = opentime.split(':').map(Number)
  const [ch, cm] = closingtime.split(':').map(Number)

  if (isNaN(oh) || isNaN(om) || isNaN(ch) || isNaN(cm)) return []

  const start = oh * 60 + om
  const end   = ch * 60 + cm

  if (start >= end || intervalMinutes <= 0) return []

  const slots = []
  for (let t = start; t + intervalMinutes <= end; t += intervalMinutes) {
    const h = String(Math.floor(t / 60)).padStart(2, '0')
    const m = String(t % 60).padStart(2, '0')
    slots.push(`${h}:${m}`)
  }
  return slots
}

// ── Time formatting ──────────────────────────────────────────
/**
 * Format '08:00:00' → '08:00'. Handles both HH:MM:SS and HH:MM.
 * Returns '' for falsy input.
 *
 * @param {string|null} t
 * @returns {string}
 */
function fmtTime(t) {
  if (!t) return ''
  return String(t).slice(0, 5)
}

// ── HTML escaping ────────────────────────────────────────────
/**
 * Escape a string for safe HTML insertion.
 *
 * @param {string|null|undefined} str
 * @returns {string}
 */
function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;')
}

// ── Haversine distance ───────────────────────────────────────
/**
 * Calculate the great-circle distance in kilometres between two
 * geographic coordinates using the Haversine formula.
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in km
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Marker colour selection ──────────────────────────────────
/**
 * Return the hex fill colour for a facility marker based on
 * sector and type.
 *
 * @param {{ sector: string, type: string }} facility
 * @returns {string} Hex colour string
 */
function getMarkerColor(facility) {
  if (facility.sector === 'private')         return '#ff6b6b'
  if (facility.type   === 'hospital')        return '#60b4ff'
  return '#00e5a0'
}

// ── Booking reference code generation ────────────────────────
/**
 * Generate a short human-readable booking reference code.
 * Not guaranteed unique; intended as a display aid only.
 *
 * @returns {string} e.g. 'BK-A1B2C3'
 */
function generateRefCode() {
  const ts  = Date.now().toString(36).toUpperCase().slice(-4)
  const rnd = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0')
  return `BK-${ts}${rnd}`
}

// ── Operating-hours fallback ─────────────────────────────────
/**
 * Build a default Mon–Fri 08:00–17:00, Sat–Sun closed hours map.
 * Used when Supabase returns no data for a clinic.
 *
 * @returns {Object.<string, {opentime:string|null, closingtime:string|null, isopen:boolean}>}
 */
function defaultHoursMap() {
  const map = {}
  DAY_NAMES.forEach(day => {
    const weekday = !['Saturday', 'Sunday'].includes(day)
    map[day] = {
      opentime:    weekday ? '08:00:00' : null,
      closingtime: weekday ? '17:00:00' : null,
      isopen:      weekday,
    }
  })
  return map
}

// ── Date helpers ─────────────────────────────────────────────
/**
 * Format a Date to a 'YYYY-MM-DD' string in local time.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatDateISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Return true if a given Date is today (ignores time).
 *
 * @param {Date} date
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
function isToday(date, now = new Date()) {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth()    === now.getMonth()    &&
    date.getDate()     === now.getDate()
  )
}

/**
 * Return true if a given Date is in the past relative to today.
 *
 * @param {Date} date
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
function isPastDate(date, now = new Date()) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d < today
}

/**
 * Validate a basic patient booking form payload.
 *
 * @param {{ firstName:string, lastName:string, phone:string }} fields
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateBookingForm({ firstName, lastName, phone } = {}) {
  if (!firstName || !firstName.trim())
    return { valid: false, error: 'First name is required.' }
  if (!lastName || !lastName.trim())
    return { valid: false, error: 'Last name is required.' }
  if (!phone || !phone.trim())
    return { valid: false, error: 'Phone number is required.' }
  return { valid: true, error: null }
}

// ── Facility filtering ────────────────────────────────────────
/**
 * Filter an array of facilities by query string, province, type,
 * sector and optional radius around a reference point.
 *
 * @param {Object[]} facilities
 * @param {{ query?:string, province?:string, type?:string, sector?:string,
 *           userLat?:number|null, userLng?:number|null, activeRadius?:number }} filters
 * @returns {Object[]} Filtered (and distance-annotated) facilities
 */
function filterFacilities(facilities, filters = {}) {
  const {
    query        = '',
    province     = '',
    type         = '',
    sector       = '',
    userLat      = null,
    userLng      = null,
    activeRadius = 0,
  } = filters

  const q = query.trim().toLowerCase()

  return facilities.filter(f => {
    if (q) {
      const haystack = `${f.name} ${f.city} ${f.province}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (province && f.province !== province) return false
    if (type     && f.type     !== type)     return false
    if (sector   && f.sector   !== sector)   return false

    if (userLat != null && activeRadius > 0) {
      const dist = haversineKm(userLat, userLng, f.lat, f.lng)
      if (dist > activeRadius) return false
    }

    return true
  })
}

// ── Exports (CommonJS for Jest; also used as ESM via bundler) ─
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
  }
}