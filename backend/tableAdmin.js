import { supabase } from './supabase.js'

const CLINIC_ID = 1

async function loadHours() {
    const { data, error } = await supabase
        .from('operating_hours')
        .select('*')
        .eq('clinicid', CLINIC_ID)

    if (error) {
        console.error('Error loading hours:', error)
        return
    }

    data.forEach(row => {
        const day = row.day

        const openInput   = document.querySelector(`input[data-day="${day}"][data-field="opentime"]`)
        const closeInput  = document.querySelector(`input[data-day="${day}"][data-field="closingtime"]`)
        const isOpenInput = document.querySelector(`input[data-day="${day}"][data-field="isopen"]`)

        if (openInput)   openInput.value     = row.opentime ? row.opentime.slice(0, 5) : ''
        if (closeInput)  closeInput.value    = row.closingtime ? row.closingtime.slice(0, 5) : ''
        if (isOpenInput) isOpenInput.checked = row.isopen
    })
}

// Save data for the table
async function saveHours(e) {
    e.preventDefault()

    const saveBtn = document.getElementById('saveBtn')
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving...'

    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

    for (const day of days) {
        const openTime  = document.querySelector(`input[data-day="${day}"][data-field="opentime"]`).value
        const closeTime = document.querySelector(`input[data-day="${day}"][data-field="closingtime"]`).value
        const isOpen    = document.querySelector(`input[data-day="${day}"][data-field="isopen"]`).checked

        const { error } = await supabase
            .from('operating_hours')
            .update({
                opentime: openTime || null,
                closingtime: closeTime || null,
                isopen: isOpen
            })
            .eq('clinicid', CLINIC_ID)
            .eq('day', day)

        if (error) {
            console.error(`Error saving ${day}:`, error)
        }
    }

    saveBtn.disabled = false
    saveBtn.textContent = 'Save Changes'

    alert("Hours saved successfully!")
}

// button event listener
document.getElementById('hoursForm').addEventListener('submit', saveHours)

loadHours()