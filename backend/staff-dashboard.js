/*
import { supabase } from './supabase.js';
import { Utils } from './utils.js';

const esc = Utils.esc;
let currentStaff = null;

async function loadStaffDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        localStorage.removeItem('userRole');
        window.location.href = '/pages/index.html';
        return;
    }
    localStorage.setItem('userRole', 'staff');

    const { data: staff, error } = await supabase
        .from('Staff')
        .select('*')
        .eq('email', session.user.email)
        .single();

    if (error || !staff) {
        window.location.href = '/pages/dashboard.html';
        return;
    }
    currentStaff = staff;
    document.getElementById('userEmail').textContent = session.user.email;

    const [apptRes, unavailRes, facilityRes] = await Promise.all([
        supabase.from('Appointments').select('*').eq('StaffID', staff.id).order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true }),
        supabase.from('staff_unavail').select('*').eq('Staff_id', staff.id),
        supabase.from('Facilities').select('Name').eq('ClinicID', staff.ClinicID).single()
    ]);

    const appointments = apptRes.data || [];
    const unavailRecords = unavailRes.data || [];
    const clinicName = facilityRes.data?.Name || 'Unknown Clinic';

    const today = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments.filter(a => a.appointment_date === today);
    const waitingCount = todaysAppointments.filter(a => a.status === 'waiting').length;
    const completedCount = todaysAppointments.filter(a => a.status === 'complete').length;

    // ========== PATIENT NOTES SYSTEM - START ==========
    // Get note counts for each patient
    const noteCounts = {};
    if (todaysAppointments.length > 0) {
        const patientIds = [...new Set(todaysAppointments.map(a => a.PatientID))];
        const { data: notes } = await supabase
            .from('patient_notes')
            .select('patient_id, id')
            .in('patient_id', patientIds);
        
        if (notes) {
            notes.forEach(n => {
                noteCounts[n.patient_id] = (noteCounts[n.patient_id] || 0) + 1;
            });
        }
    }
    // ========== PATIENT NOTES SYSTEM - END ==========

    const main = document.getElementById('dashboardContent');
    main.innerHTML = `
        <div class="welcome-banner">
            <h2>Welcome, ${esc(staff.full_name.split(' ')[0])}! 👋</h2>
            <p><strong>Staff ID:</strong> ${esc(staff.id)}</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card"><h3>${waitingCount}</h3><p>Waiting Patients</p></div>
            <div class="stat-card"><h3>${completedCount}</h3><p>Completed Today</p></div>
            <div class="stat-card"><h3>${todaysAppointments.length}</h3><p>Today's Appointments</p></div>
        </div>

        <div class="action-bar">
            <div class="action-info">
                <h4>📅 Availability Management</h4>
                <p>Mark when you are not available — patients cannot book you then.</p>
            </div>
            <div class="action-buttons-group">
                <button class="btn-primary btn-small" id="manageAvailabilityBtn">Manage Availability</button>
            </div>
        </div>

        <div class="info-card">
            <div class="section-header-actions">
                <h3>📋 Today's Appointments</h3>
                <button class="btn-primary btn-small" id="refreshBtn">🔄 Refresh</button>
            </div>
            ${todaysAppointments.length === 0 
                ? '<p style="text-align:center; padding:32px; color:var(--ink-3);">✨ No appointments scheduled for today.</p>'
                : `<table class="appointments-table">
                    <thead>
                        <tr>
                            <th>Patient</th>
                            <th>Time</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <!-- ========== PATIENT NOTES SYSTEM - START ========== -->
                            <th>Notes</th>
                            <!-- ========== PATIENT NOTES SYSTEM - END ========== -->
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${todaysAppointments.map(apt => {
                            const status = (apt.status || '').toLowerCase();
                            // ========== PATIENT NOTES SYSTEM - START ==========
                            const noteCount = noteCounts[apt.PatientID] || 0;
                            // ========== PATIENT NOTES SYSTEM - END ==========
                            const statusClass = {
                                waiting: 'status-waiting',
                                complete: 'status-completed',
                                cancelled: 'status-cancelled'
                            }[status] || 'status-unknown';
                            const statusBadge = `<span class="status-badge ${statusClass}">${esc(apt.status || 'unknown').toUpperCase()}</span>`;
                            
                            let actionHtml = '';
                            if (status === 'complete' || status === 'cancelled') {
                                actionHtml = '<span style="color:var(--ink-4);">—</span>';
                            } else if (status === 'waiting') {
                                actionHtml = `<button class="complete-btn btn-small" data-id="${apt.id}">Complete</button> <button class="cancel-btn btn-small" data-id="${apt.id}">Cancel</button>`;
                            } else {
                                actionHtml = '<span style="color:var(--ink-4);">—</span>';
                            }
                            
                            return `
                                <tr>
                                    <td>${esc(apt.patient_name)}</td>
                                    <td>${esc(apt.appointment_time?.slice(0,5)) || 'N/A'}</td>
                                    <td>${esc(apt.reason || 'N/A')}</td>
                                    <td>${statusBadge}</td>
                                    <!-- ========== PATIENT NOTES SYSTEM - START ========== -->
                                    <td class="notes-cell">
                                        <button class="view-notes-btn" 
                                            data-patient-id="${apt.PatientID}" 
                                            data-appointment-id="${apt.id}"
                                            data-patient-name="${esc(apt.patient_name)}">
                                            📝 Notes
                                            ${noteCount > 0 ? `<span class="note-count-badge">${noteCount}</span>` : ''}
                                        </button>
                                    </td>
                                    <!-- ========== PATIENT NOTES SYSTEM - END ========== -->
                                    <td>${actionHtml}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                  </table>`
            }
        </div>
    `;

    // Attach event listeners
    document.getElementById('manageAvailabilityBtn')?.addEventListener('click', () => {
        window.location.href = '/pages/staff-unavailability.html';
    });
    
    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', () => updateAppointmentStatus(btn.dataset.id, 'complete'));
    });
    
    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('Cancel this appointment?')) updateAppointmentStatus(btn.dataset.id, 'cancelled');
        });
    });
    
    document.getElementById('refreshBtn')?.addEventListener('click', loadStaffDashboard);

    // ========== PATIENT NOTES SYSTEM - START ==========
    document.querySelectorAll('.view-notes-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const patientId = btn.dataset.patientId;
            const appointmentId = btn.dataset.appointmentId;
            const patientName = btn.dataset.patientName;
            showPatientNotes(patientId, appointmentId, patientName);
        });
    });
    // ========== PATIENT NOTES SYSTEM - END ==========
}

// ========== PATIENT NOTES SYSTEM - START ==========
// Show patient notes modal
async function showPatientNotes(patientId, appointmentId, patientName) {
    console.log('Loading notes for patient:', patientId);
    
    // Fetch existing notes for this patient directly from patient_notes table
    const { data: notes, error } = await supabase
        .from('patient_notes')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
    
    console.log('Notes fetched:', notes);
    
    if (error) {
        console.error('Error:', error);
        showToast('Failed to load notes: ' + error.message, true);
        return;
    }
    
    // Get staff name for display
    let staffName = 'Staff';
    if (currentStaff) {
        staffName = currentStaff.full_name || 'Staff';
    }
    
    const modal = document.createElement('dialog');
    modal.id = 'notesModal';
    modal.className = 'notes-modal';
    modal.innerHTML = `
        <div class="modal-box" style="max-width: 550px; width: 90%;">
            <div class="modal-title">📋 Patient Medical Notes</div>
            <div style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 8px;">
                <strong>${Utils.esc(patientName)}</strong>
                <span style="color: var(--ink-3); font-size: 11px; margin-left: 8px;">
                    Total: ${notes?.length || 0} note(s)
                </span>
            </div>
            
            <div class="notes-history">
                ${!notes || notes.length === 0 
                    ? '<div class="no-notes">📝 No medical notes yet. Add the first note below.</div>'
                    : notes.map(n => `
                        <div class="note-item">
                            <div class="note-text">${Utils.esc(n.note)}</div>
                            <div class="note-meta">
                                <span class="note-staff">${Utils.esc(staffName)} (Medical)</span>
                                <span class="note-date">${new Date(n.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
            
            <textarea id="newNoteInput" class="new-note-input" rows="3" placeholder="Add a new medical note about this patient..."></textarea>
            
            <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn-secondary" id="closeNotesModal">Close</button>
                <button class="btn-primary" id="addNoteBtn">➕ Add Note</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.showModal();
    
    document.getElementById('closeNotesModal').onclick = () => modal.remove();
    
    document.getElementById('addNoteBtn').onclick = async () => {
        const newNote = document.getElementById('newNoteInput').value.trim();
        if (!newNote) {
            showToast('Please enter a note', true);
            return;
        }
        
        console.log('Saving note for patient:', patientId);
        
        const { error: insertError } = await supabase
            .from('patient_notes')
            .insert([{
                patient_id: patientId,
                appointment_id: appointmentId,
                staff_id: currentStaff?.id || null,
                note: newNote
            }]);
        
        if (insertError) {
            console.error('Insert error:', insertError);
            showToast('Failed to save note: ' + insertError.message, true);
        } else {
            showToast('✅ Medical note added successfully');
            modal.remove();
            loadStaffDashboard();
        }
    };
    
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}
// ========== PATIENT NOTES SYSTEM - END ==========

async function updateAppointmentStatus(id, newStatus) {
    const { error } = await supabase.from('Appointments').update({ status: newStatus }).eq('id', id);
    if (error) showToast('Failed: ' + error.message, true);
    else loadStaffDashboard();
}

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast ${isError ? 'error' : 'success'} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);
loadStaffDashboard();
*/

import { supabase } from './supabase.js';
import { Utils } from './utils.js';

const esc = Utils.esc;
let currentStaff = null;

async function loadStaffDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        localStorage.removeItem('userRole');
        window.location.href = '/pages/index.html';
        return;
    }
    localStorage.setItem('userRole', 'staff');

    const { data: staff, error } = await supabase
        .from('Staff')
        .select('*')
        .eq('email', session.user.email)
        .single();

    if (error || !staff) {
        window.location.href = '/pages/dashboard.html';
        return;
    }
    currentStaff = staff;
    document.getElementById('userEmail').textContent = session.user.email;

    const [apptRes, unavailRes, facilityRes] = await Promise.all([
        supabase.from('Appointments').select('*').eq('StaffID', staff.id).order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true }),
        supabase.from('staff_unavail').select('*').eq('Staff_id', staff.id),
        supabase.from('Facilities').select('Name').eq('ClinicID', staff.ClinicID).single()
    ]);

    const appointments = apptRes.data || [];
    const unavailRecords = unavailRes.data || [];
    const clinicName = facilityRes.data?.Name || 'Unknown Clinic';

    const today = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments.filter(a => a.appointment_date === today);
    const waitingCount = todaysAppointments.filter(a => a.status === 'waiting').length;
    const completedCount = todaysAppointments.filter(a => a.status === 'complete').length;

    // Get note counts for each patient
    const noteCounts = {};
    if (todaysAppointments.length > 0) {
        const patientIds = [...new Set(todaysAppointments.map(a => a.PatientID))];
        const { data: notes } = await supabase
            .from('patient_notes')
            .select('patient_id, id')
            .in('patient_id', patientIds);
        
        if (notes) {
            notes.forEach(n => {
                noteCounts[n.patient_id] = (noteCounts[n.patient_id] || 0) + 1;
            });
        }
    }

    const main = document.getElementById('dashboardContent');
    main.innerHTML = `
        <div class="welcome-banner">
            <h2>Welcome, ${esc(staff.full_name.split(' ')[0])}! 👋</h2>
            <p><strong>Staff ID:</strong> ${esc(staff.id)}</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card"><h3>${waitingCount}</h3><p>Waiting Patients</p></div>
            <div class="stat-card"><h3>${completedCount}</h3><p>Completed Today</p></div>
            <div class="stat-card"><h3>${todaysAppointments.length}</h3><p>Today's Appointments</p></div>
        </div>

        <div class="action-bar">
            <div class="action-info">
                <h4>📅 Availability Management</h4>
                <p>Mark when you are not available — patients cannot book you then.</p>
            </div>
            <div class="action-buttons-group">
                <button class="btn-primary btn-small" id="manageAvailabilityBtn">Manage Availability</button>
            </div>
        </div>

        <div class="info-card">
            <div class="section-header-actions">
                <h3>📋 Today's Appointments</h3>
                <button class="btn-primary btn-small" id="refreshBtn">🔄 Refresh</button>
            </div>
            ${todaysAppointments.length === 0 
                ? '<p style="text-align:center; padding:32px; color:var(--ink-3);">✨ No appointments scheduled for today.</p>'
                : `<table class="appointments-table">
                    <thead>
                        <tr>
                            <th>Patient</th>
                            <th>Time</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Notes</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${todaysAppointments.map(apt => {
                            const status = (apt.status || '').toLowerCase();
                            const noteCount = noteCounts[apt.PatientID] || 0;
                            const statusClass = {
                                waiting: 'status-waiting',
                                complete: 'status-completed',
                                cancelled: 'status-cancelled'
                            }[status] || 'status-unknown';
                            const statusBadge = `<span class="status-badge ${statusClass}">${esc(apt.status || 'unknown').toUpperCase()}</span>`;
                            
                            let actionHtml = '';
                            if (status === 'complete' || status === 'cancelled') {
                                actionHtml = '<span style="color:var(--ink-4);">—</span>';
                            } else if (status === 'waiting') {
                                actionHtml = `<button class="complete-btn btn-small" data-id="${apt.id}">Complete</button> <button class="cancel-btn btn-small" data-id="${apt.id}">Cancel</button>`;
                            } else {
                                actionHtml = '<span style="color:var(--ink-4);">—</span>';
                            }
                            
                            return `
                                <tr>
                                    <td>${esc(apt.patient_name)}</td>
                                    <td>${esc(apt.appointment_time?.slice(0,5)) || 'N/A'}</td>
                                    <td>${esc(apt.reason || 'N/A')}</td>
                                    <td>${statusBadge}</td>
                                    <td class="notes-cell">
                                        <button class="view-notes-btn" 
                                            data-patient-id="${apt.PatientID}" 
                                            data-appointment-id="${apt.id}"
                                            data-patient-name="${esc(apt.patient_name)}">
                                            📝 Notes
                                            ${noteCount > 0 ? `<span class="note-count-badge">${noteCount}</span>` : ''}
                                        </button>
                                    </td>
                                    <td>${actionHtml}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                 </table>`
            }
        </div>
    `;

    document.getElementById('manageAvailabilityBtn')?.addEventListener('click', () => {
        window.location.href = '/pages/staff-unavailability.html';
    });
    
    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', () => updateAppointmentStatus(btn.dataset.id, 'complete'));
    });
    
    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('Cancel this appointment?')) updateAppointmentStatus(btn.dataset.id, 'cancelled');
        });
    });
    
    document.querySelectorAll('.view-notes-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showPatientNotes(btn.dataset.patientId, btn.dataset.appointmentId, btn.dataset.patientName);
        });
    });
    
    document.getElementById('refreshBtn')?.addEventListener('click', loadStaffDashboard);
}

async function showPatientNotes(patientId, appointmentId, patientName) {
    const { data: notes, error } = await supabase
        .from('patient_notes')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
    
    if (error) {
        showToast('Failed to load notes: ' + error.message, true);
        return;
    }
    
    let staffName = currentStaff?.full_name || 'Staff';
    
    const modal = document.createElement('dialog');
    modal.id = 'notesModal';
    modal.className = 'notes-modal';
    modal.innerHTML = `
        <div class="modal-box" style="max-width: 550px; width: 90%;">
            <div class="modal-title">📋 Patient Medical Notes</div>
            <div style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 8px;">
                <strong>${Utils.esc(patientName)}</strong>
                <span style="color: var(--ink-3); font-size: 11px; margin-left: 8px;">
                    Total: ${notes?.length || 0} note(s)
                </span>
            </div>
            <div class="notes-history">
                ${!notes || notes.length === 0 
                    ? '<div class="no-notes">📝 No medical notes yet. Add the first note below.</div>'
                    : notes.map(n => `
                        <div class="note-item">
                            <div class="note-text">${Utils.esc(n.note)}</div>
                            <div class="note-meta">
                                <span class="note-staff">${Utils.esc(staffName)}</span>
                                <span class="note-date">${new Date(n.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
            <textarea id="newNoteInput" class="new-note-input" rows="3" placeholder="Add a new medical note..."></textarea>
            <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px;">
                <button class="btn-secondary" id="closeNotesModal">Close</button>
                <button class="btn-primary" id="addNoteBtn">➕ Add Note</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.showModal();
    
    document.getElementById('closeNotesModal').onclick = () => modal.remove();
    
    document.getElementById('addNoteBtn').onclick = async () => {
        const newNote = document.getElementById('newNoteInput').value.trim();
        if (!newNote) {
            showToast('Please enter a note', true);
            return;
        }
        
        const { error: insertError } = await supabase
            .from('patient_notes')
            .insert([{
                patient_id: patientId,
                appointment_id: appointmentId,
                staff_id: currentStaff?.id || null,
                note: newNote
            }]);
        
        if (insertError) {
            showToast('Failed to save note: ' + insertError.message, true);
        } else {
            showToast('✅ Medical note added successfully');
            modal.remove();
            loadStaffDashboard();
        }
    };
    
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

async function updateAppointmentStatus(id, newStatus) {
    const { error } = await supabase.from('Appointments').update({ status: newStatus }).eq('id', id);
    if (error) showToast('Failed: ' + error.message, true);
    else loadStaffDashboard();
}

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast ${isError ? 'error' : 'success'} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);
loadStaffDashboard();