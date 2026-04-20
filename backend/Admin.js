/* ============================================================
   admin.js — Clinic Admin Page Logic
   This version works with your existing HTML structure
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://ixikhufrylaugpdxokwu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4aWtodWZyeWxhdWdwZHhva3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTQ0NTIsImV4cCI6MjA5MTIzMDQ1Mn0.F7g_bNWAsxjWtkHihVNYPicghiKOisgHGV9-zaBjXvQ'
const supabase = createClient(supabaseUrl, supabaseKey)

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ── Parse URL params ─────────────────────────────────────────
const params = new URLSearchParams(location.search)
const clinicID = params.get('clinicID')
const clinicName = params.get('name') || 'Health Facility'
const clinicType = params.get('type') || 'clinic'
const clinicSector = params.get('sector') || 'public'
const clinicSubtype = params.get('subtype') || ''
const clinicProvince = params.get('province') || ''

// ── App state ────────────────────────────────────────────────
let originalHours = []   // rows as fetched from DB
let currentHours = []    // working copy
let staffList = []       // staff members

// ── Entry point ──────────────────────────────────────────────
async function init() {
    if (!clinicID) {
        renderError('No facility selected.', 'Go back to the map and click a clinic or hospital.')
        return
    }
    
    await loadHours()
    renderClinicHeader()
    renderHours()
    renderStaff()
    attachEventListeners()
}

// ── Load operating hours from Supabase ───────────────────────
async function loadHours() {
    const { data, error } = await supabase
        .from('operating_hours')
        .select('*')
        .eq('clinicid', clinicID)
        .order('operatingid', { ascending: true })

    if (error || !data || data.length === 0) {
        // Create default schedule
        originalHours = DAY_NAMES.map((day, i) => ({
            operatingid: null,
            clinicid: clinicID,
            day,
            opentime: ['Saturday', 'Sunday'].includes(day) ? '09:00:00' : '08:00:00',
            closingtime: day === 'Saturday' ? '13:00:00' : day === 'Sunday' ? null : '17:00:00',
            isopen: day !== 'Sunday',
        }))
    } else {
        // Sort by canonical day order
        originalHours = DAY_NAMES.map(day =>
            data.find(r => r.day === day) || {
                operatingid: null, clinicid: clinicID, day,
                opentime: '08:00:00', closingtime: '17:00:00', isopen: false
            }
        )
    }

    // Deep copy for working state
    currentHours = originalHours.map(r => ({ ...r }))
}

// ── Render clinic header ─────────────────────────────────────
function renderClinicHeader() {
    const typeLabel = clinicType === 'hospital' ? 'HOSPITAL' : 'CLINIC / CHC'
    const typeClass = clinicType === 'hospital' ? 'chip-hosp' : 'chip-clinic'
    const sectClass = clinicSector === 'public' ? 'chip-public' : 'chip-private'

    const headerHtml = `
        <div class="clinic-header">
            <a href="index.html" class="back-link">← Back to map</a>
            <h1 class="clinic-name">${escapeHtml(clinicName)}</h1>
            <div class="clinic-meta">
                <span>${escapeHtml(clinicProvince)}</span>
                ${clinicSubtype ? `<span>· ${escapeHtml(clinicSubtype)}</span>` : ''}
            </div>
            <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
                <span class="chip ${typeClass}">${typeLabel}</span>
                <span class="chip ${sectClass}">${clinicSector.toUpperCase()}</span>
                <span class="chip chip-prov">${escapeHtml(clinicProvince).toUpperCase()}</span>
                <span class="chip chip-id">ID: ${escapeHtml(clinicID)}</span>
            </div>
        </div>
    `

    // Insert header at the top of app
    const app = document.getElementById('app')
    app.innerHTML = headerHtml + app.innerHTML
}

// ── Render hours table ───────────────────────────────────────
function renderHours() {
    const hoursRows = currentHours.map((row, i) => {
        const orig = originalHours[i]
        const changed = isRowChanged(i)
        const rowClass = changed ? 'hours-row changed' : 'hours-row'
        
        const toggleClass = row.isopen ? 'toggle-open' : 'toggle-closed'
        const toggleText = row.isopen ? 'OPEN' : 'CLOSED'
        
        const openChanged = row.opentime !== orig.opentime
        const closeChanged = row.closingtime !== orig.closingtime
        
        let timeInputs = ''
        if (row.isopen) {
            timeInputs = `
                <select class="time-sel ${openChanged ? 'changed' : ''}" data-day-index="${i}" data-field="opentime">
                    ${generateTimeOptions(row.opentime)}
                </select>
                <select class="time-sel ${closeChanged ? 'changed' : ''}" data-day-index="${i}" data-field="closingtime">
                    ${generateTimeOptions(row.closingtime)}
                </select>
            `
        } else {
            timeInputs = `<span class="closed-text">Closed</span>`
        }
        
        return `
            <div class="${rowClass}">
                <span class="day-label">${row.day}</span>
                ${timeInputs}
                <button class="toggle-btn ${toggleClass}" data-day-index="${i}">${toggleText}</button>
            </div>
        `
    }).join('')
    
    // Find or create the hours panel
    let hoursPanel = document.querySelector('.panel:first-child')
    if (!hoursPanel) {
        // Create the panel if it doesn't exist
        const app = document.getElementById('app')
        const hoursHtml = `
            <div class="panel">
                <div class="panel-header">
                    <span class="panel-title">Operating Hours</span>
                    <span id="change-badge" class="change-badge" style="display: none;"></span>
                </div>
                <div class="panel-body" id="hours-container">
                    ${hoursRows}
                </div>
                <div class="hours-footer">
                    <div style="display:flex; gap:8px;">
                        <button id="discard-btn" class="btn-ghost" style="display: none;">Discard</button>
                    </div>
                    <button id="save-hours-btn" class="btn-save" disabled>Save changes</button>
                </div>
            </div>
        `
        app.insertAdjacentHTML('beforeend', hoursHtml)
    } else {
        // Update existing panel
        const container = document.getElementById('hours-container')
        if (container) {
            container.innerHTML = hoursRows
        }
    }
    
    updateSaveBar()
}

// ── Render staff list ────────────────────────────────────────
function renderStaff() {
    const avatarColors = [
        { bg: 'rgba(0,229,160,0.15)', color: '#00e5a0' },
        { bg: 'rgba(96,180,255,0.15)', color: '#60b4ff' },
        { bg: 'rgba(245,166,35,0.15)', color: '#f5a623' },
        { bg: 'rgba(255,107,107,0.15)', color: '#ff6b6b' },
    ]
    
    let staffHtml = ''
    if (staffList.length === 0) {
        staffHtml = '<div style="padding:16px; font-size:11px; color:var(--text-muted); text-align:center;">No staff members yet.</div>'
    } else {
        staffHtml = staffList.map((s, idx) => {
            const col = avatarColors[idx % avatarColors.length]
            const initials = s.name.split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('')
            return `
                <div class="staff-row">
                    <div class="avatar" style="background:${col.bg}; color:${col.color};">${initials}</div>
                    <div class="staff-info">
                        <div class="staff-name">${escapeHtml(s.name)}</div>
                        <div class="staff-role">${escapeHtml(s.role)}</div>
                    </div>
                    <button class="btn-danger" data-staff-id="${s.id}">Remove</button>
                </div>
            `
        }).join('')
    }
    
    // Find or create staff panel
    let staffPanel = document.querySelector('.panel:last-child')
    if (!staffPanel || document.querySelectorAll('.panel').length === 1) {
        const staffHtmlFull = `
            <div class="panel">
                <div class="panel-header">
                    <span class="panel-title">Staff Members</span>
                </div>
                <div id="staff-container">
                    ${staffHtml}
                </div>
                <div class="add-row">
                    <input type="text" id="staff-name" class="form-input" placeholder="Full name" />
                    <input type="text" id="staff-role" class="form-input" placeholder="Role (e.g. Doctor)" />
                    <button id="add-staff-btn" class="btn-save">+ Add</button>
                </div>
            </div>
        `
        const app = document.getElementById('app')
        app.insertAdjacentHTML('beforeend', staffHtmlFull)
    } else {
        const container = document.getElementById('staff-container')
        if (container) {
            container.innerHTML = staffHtml
        }
    }
}

// ── Attach event listeners ───────────────────────────────────
function attachEventListeners() {
    // Time select changes
    document.querySelectorAll('.time-sel').forEach(sel => {
        sel.removeEventListener('change', handleTimeChange)
        sel.addEventListener('change', handleTimeChange)
    })
    
    // Toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.removeEventListener('click', handleToggle)
        btn.addEventListener('click', handleToggle)
    })
    
    // Save button
    const saveBtn = document.getElementById('save-hours-btn')
    if (saveBtn) {
        saveBtn.removeEventListener('click', saveHours)
        saveBtn.addEventListener('click', saveHours)
    }
    
    // Discard button
    const discardBtn = document.getElementById('discard-btn')
    if (discardBtn) {
        discardBtn.removeEventListener('click', discardChanges)
        discardBtn.addEventListener('click', discardChanges)
    }
    
    // Add staff button
    const addStaffBtn = document.getElementById('add-staff-btn')
    if (addStaffBtn) {
        addStaffBtn.removeEventListener('click', addStaff)
        addStaffBtn.addEventListener('click', addStaff)
    }
    
    // Remove staff buttons
    document.querySelectorAll('[data-staff-id]').forEach(btn => {
        btn.removeEventListener('click', handleRemoveStaff)
        btn.addEventListener('click', handleRemoveStaff)
    })
}

function handleTimeChange(e) {
    const index = parseInt(e.target.getAttribute('data-day-index'))
    const field = e.target.getAttribute('data-field')
    if (!isNaN(index) && field) {
        currentHours[index][field] = e.target.value
        renderHours()
        attachEventListeners() // Re-attach after re-render
    }
}

function handleToggle(e) {
    const index = parseInt(e.target.getAttribute('data-day-index'))
    if (!isNaN(index)) {
        currentHours[index].isopen = !currentHours[index].isopen
        renderHours()
        attachEventListeners() // Re-attach after re-render
    }
}

function handleRemoveStaff(e) {
    const id = parseInt(e.target.getAttribute('data-staff-id'))
    removeStaff(id)
}

// ── Save hours ───────────────────────────────────────────────
async function saveHours() {
    const saveBtn = document.getElementById('save-hours-btn')
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'
    
    const changed = currentHours.filter((_, i) => isRowChanged(i))
    let errors = 0
    
    for (const row of changed) {
        if (!row.operatingid) {
            // Insert new row
            const { error } = await supabase
                .from('operating_hours')
                .insert([{
                    clinicid: clinicID,
                    day: row.day,
                    opentime: row.isopen ? row.opentime : null,
                    closingtime: row.isopen ? row.closingtime : null,
                    isopen: row.isopen,
                }])
            if (error) {
                console.error('Insert error:', error)
                errors++
            } else {
                // Refresh to get the new operatingid
                await loadHours()
            }
        } else {
            // Update existing row
            const { error } = await supabase
                .from('operating_hours')
                .update({
                    opentime: row.isopen ? row.opentime : null,
                    closingtime: row.isopen ? row.closingtime : null,
                    isopen: row.isopen,
                })
                .eq('operatingid', row.operatingid)
            if (error) {
                console.error('Update error:', error)
                errors++
            }
        }
    }
    
    if (errors === 0) {
        // Refresh data to get latest from DB
        await loadHours()
        renderHours()
        attachEventListeners()
        showToast('Operating hours saved successfully', 'success')
    } else {
        showToast('Some changes failed to save', 'error')
    }
    
    saveBtn.disabled = false
    saveBtn.textContent = 'Save changes'
    updateSaveBar()
}

function discardChanges() {
    currentHours = originalHours.map(r => ({ ...r }))
    renderHours()
    attachEventListeners()
    showToast('Changes discarded', 'success')
}

function updateSaveBar() {
    const changedCount = currentHours.filter((_, i) => isRowChanged(i)).length
    const badge = document.getElementById('change-badge')
    const saveBtn = document.getElementById('save-hours-btn')
    const discardBtn = document.getElementById('discard-btn')
    
    if (changedCount > 0) {
        if (badge) {
            badge.textContent = `${changedCount} unsaved change${changedCount > 1 ? 's' : ''}`
            badge.style.display = 'inline-block'
        }
        if (saveBtn) saveBtn.disabled = false
        if (discardBtn) discardBtn.style.display = 'inline-block'
    } else {
        if (badge) badge.style.display = 'none'
        if (saveBtn) saveBtn.disabled = true
        if (discardBtn) discardBtn.style.display = 'none'
    }
}

// ── Staff functions ──────────────────────────────────────────
let nextStaffId = 100

function addStaff() {
    const nameInput = document.getElementById('staff-name')
    const roleInput = document.getElementById('staff-role')
    const name = nameInput?.value.trim()
    const role = roleInput?.value.trim()
    
    if (!name || !role) {
        showToast('Enter both name and role', 'error')
        return
    }
    
    // TODO: Add to Supabase when staff table is ready
    staffList.push({ id: nextStaffId++, name, role })
    
    if (nameInput) nameInput.value = ''
    if (roleInput) roleInput.value = ''
    
    renderStaff()
    attachEventListeners()
    showToast('Staff member added', 'success')
}

function removeStaff(id) {
    // TODO: Remove from Supabase when staff table is ready
    staffList = staffList.filter(s => s.id !== id)
    renderStaff()
    attachEventListeners()
    showToast('Staff member removed', 'success')
}

// ── Helper functions ─────────────────────────────────────────
function isRowChanged(i) {
    const cur = currentHours[i]
    const orig = originalHours[i]
    return cur.opentime !== orig.opentime ||
           cur.closingtime !== orig.closingtime ||
           cur.isopen !== orig.isopen
}

function generateTimeOptions(selected) {
    const times = []
    for (let h = 6; h <= 20; h++) {
        for (let m = 0; m < 60; m += 30) {
            const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
            const lbl = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
            const isSel = selected && selected.startsWith(lbl)
            times.push(`<option value="${val}"${isSel ? ' selected' : ''}>${lbl}</option>`)
        }
    }
    return times.join('')
}

function showToast(msg, type) {
    const toast = document.getElementById('toast')
    toast.textContent = msg
    toast.className = `toast ${type}`
    setTimeout(() => {
        toast.className = 'toast'
    }, 3000)
}

function renderError(title, msg) {
    const app = document.getElementById('app')
    app.innerHTML = `
        <div class="error-state">
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(msg)}</p>
            <br>
            <a href="index.html" class="btn-outline" style="margin-top:16px; display:inline-block;">← Back to Map</a>
        </div>
    `
}

function escapeHtml(str) {
    if (!str) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// ── Start the app ────────────────────────────────────────────
init()