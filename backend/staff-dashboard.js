import { supabase } from './supabase.js';

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ─── Check if a single appointment clashes with unavailability records ────────

function isUnavailable(apt, unavailRecords) {
    const aptDate = apt.appointment_date;
    const aptTime = apt.appointment_time?.slice(0, 5); // HH:MM

    return unavailRecords.some(u => {
        if (u.Date !== aptDate) return false;
        if (!u.Start && !u.End) return true; // full day block
        return aptTime >= u.Start?.slice(0, 5) && aptTime < u.End?.slice(0, 5);
    });
}

// ─── Main dashboard loader ────────────────────────────────────────────────────

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

    document.getElementById('userEmail').textContent = session.user.email;

    // Fetch appointments, unavailability, and clinic name in parallel
    const [
        { data: appointments, error: appointmentsError },
        { data: unavailRecords },
        { data: facility }
    ] = await Promise.all([
        supabase
            .from('Appointments')
            .select('*')
            .eq('StaffID', staff.id)
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true }),
        supabase
            .from('staff_unavail')
            .select('*')
            .eq('Staff_id', staff.id),
        supabase
            .from('Facilities')
            .select('Name')
            .eq('ClinicID', staff.ClinicID)
            .single()
    ]);

    const clinicName = facility?.Name || 'Unknown Clinic';

    if (appointmentsError) console.error('Error loading appointments:', appointmentsError);

    const today = new Date().toISOString().split('T')[0];
    const todaysAppointments    = appointments?.filter(a => a.appointment_date === today) || [];
    const waitingAppointments   = todaysAppointments.filter(a => String(a.status).trim().toLowerCase() === 'waiting');
    const completedAppointments = todaysAppointments.filter(a => String(a.status).trim().toLowerCase() === 'complete');

    const main = document.getElementById('dashboardContent');
    main.innerHTML = `
        <article class="welcome-card">
            <h2>Welcome, ${staff.full_name.split(' ')[0]}! 👋</h2>
            <p><strong>Staff ID:</strong> ${escapeHtml(staff.id)}</p>
        </article>

        <section class="stats-grid">
            <article class="stat-card">
                <h3>${waitingAppointments.length}</h3>
                <p>Waiting Patients</p>
            </article>
            <article class="stat-card">
                <h3>${completedAppointments.length}</h3>
                <p>Completed Today</p>
            </article>
            <article class="stat-card">
                <h3>${todaysAppointments.length}</h3>
                <p>Today's Appointments</p>
            </article>
        </section>

        <article class="info-card">
            <h3>Your Profile</h3>
            <section class="info-row">
                <strong class="info-label">Staff ID:</strong>
                ${escapeHtml(staff.id)}
            </section>
            <section class="info-row">
                <strong class="info-label">Full Name:</strong>
                ${escapeHtml(staff.full_name)}
            </section>
            <section class="info-row">
                <strong class="info-label">Email:</strong>
                ${escapeHtml(staff.email)}
            </section>
            <section class="info-row">
                <strong class="info-label">Occupation:</strong>
                ${escapeHtml(staff.Occupation)}
            </section>
            <section class="info-row">
                <strong class="info-label">Phone:</strong>
                ${escapeHtml(staff.contact || 'Not provided')}
            </section>
        </article>

        <article class="info-card">
            <h3>Clinic Information</h3>
            <section class="info-row">
                <strong class="info-label">Clinic Name:</strong>
                ${escapeHtml(clinicName)}
            </section>
            <section class="info-row">
                <strong class="info-label">Clinic ID:</strong>
                ${escapeHtml(staff.ClinicID)}
            </section>
            <section class="info-row">
                <strong class="info-label">Your Role:</strong>
                ${escapeHtml(staff.Occupation)}
            </section>
        </article>

        <article class="info-card quick-action-card">
            <h3>📅 Availability Management</h3>
            <p style="margin-top:10px; color:#9aa4bf;">
                Manage your unavailable dates and working hours.
            </p>
            <button class="btn-primary" onclick="window.location.href='/pages/staff-unavailability.html'">
                Manage Availability
            </button>
        </article>

        <article class="info-card">
            <h3>📋 Today's Appointments</h3>
            ${todaysAppointments.length === 0
                ? '<p style="text-align:center; padding:20px;">No appointments scheduled for today.</p>'
                : `<table class="appointments-table">
                    <thead>
                        <tr>
                            <th>Patient</th>
                            <th>Time</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${todaysAppointments.map(apt => {
                            // Show status exactly as it is in the DB
                            const statusLabel = escapeHtml(apt.status || 'unknown');

                            // Determine badge colour by known statuses, fallback to neutral
                            const statusClass = {
                                waiting:     'status-waiting',
                                complete:   'status-completed',
                                cancelled:   'status-cancelled',
                                unavailable: 'status-unavailable',
                            }[String(apt.status).trim().toLowerCase()] || 'status-unknown';

                            const statusBadge = `<span class="status-badge ${statusClass}">${statusLabel.toUpperCase()}</span>`;

                            // Buttons depend on status first, then clash
                            const status = String(apt.status || '').trim().toLowerCase();
                            const clash  = isUnavailable(apt, unavailRecords || []);
                            let actionButtons = '';

                            if (status === 'complete' || status === 'cancelled') {
                                // No actions for terminal statuses
                                actionButtons = '<span style="color:#5a6280;">—</span>';
                            } else if (clash) {
                                // Waiting but clashes with unavailability — show reschedule
                                actionButtons = `
                                    <button class="reschedule-btn"
                                        data-id="${apt.id}"
                                        data-patient="${escapeHtml(apt.patient_name)}"
                                        data-date="${apt.appointment_date}"
                                        data-time="${apt.appointment_time?.slice(0,5)}">
                                        Reschedule
                                    </button>`;
                            } else if (status === 'waiting') {
                                // Normal waiting — complete and cancel
                                actionButtons = `
                                    <button class="complete-btn" data-id="${apt.id}">Complete</button>
                                    <button class="cancel-btn" data-id="${apt.id}">Cancel</button>`;
                            } else {
                                // Any other unknown status — no actions
                                actionButtons = '<span style="color:#5a6280;">—</span>';
                            }

                            return `
                                <tr${clash ? ' class="row-clash"' : ''}>
                                    <td>${escapeHtml(apt.patient_name)}</td>
                                    <td>${escapeHtml(apt.appointment_time?.slice(0,5)) || 'N/A'}</td>
                                    <td>${escapeHtml(apt.reason || 'N/A')}</td>
                                    <td>${statusBadge}</td>
                                    <td>${actionButtons}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>`
            }
        </article>

        <footer class="action-buttons">
            <button class="btn-primary" id="refreshBtn">🔄 Refresh</button>
        </footer>
    `;

    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            await updateAppointmentStatus(btn.getAttribute('data-id'), 'completed');
        });
    });

    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('Cancel this appointment?')) {
                await updateAppointmentStatus(btn.getAttribute('data-id'), 'cancelled');
            }
        });
    });

    document.querySelectorAll('.reschedule-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            openRescheduleModal(
                btn.getAttribute('data-id'),
                btn.getAttribute('data-patient'),
                btn.getAttribute('data-date'),
                btn.getAttribute('data-time'),
                unavailRecords
            );
        });
    });

    document.getElementById('refreshBtn')?.addEventListener('click', loadStaffDashboard);
}

// ─── Reschedule modal ─────────────────────────────────────────────────────────

function openRescheduleModal(appointmentId, patientName, currentDate, currentTime, unavailRecords) {
    document.getElementById('rescheduleModal')?.remove();

    const modal = document.createElement('dialog');
    modal.id = 'rescheduleModal';
    modal.innerHTML = `
        <article class="modal-box">
            <h3>Reschedule Appointment</h3>
            <p>Patient: <strong>${escapeHtml(patientName)}</strong></p>
            <p style="color:#a0a8c0; font-size:13px;">
                Current: ${formatDate(currentDate)} at ${formatTime(currentTime)}
            </p>
            <section class="modal-form">
                <section class="form-group">
                    <label for="newDate">New Date</label>
                    <input type="date" id="newDate" min="${new Date().toISOString().split('T')[0]}" value="${currentDate}" />
                </section>
                <section class="form-group">
                    <label for="newTime">New Time (09:00 – 17:00)</label>
                    <input type="time" id="newTime" min="09:00" max="17:00" value="${currentTime}" />
                </section>
            </section>
            <p class="modal-error" id="modalError"></p>
            <footer class="modal-actions">
                <button class="btn-secondary" id="cancelModalBtn">Cancel</button>
                <button class="btn-primary" id="confirmRescheduleBtn">Confirm Reschedule</button>
            </footer>
        </article>
    `;

    document.body.appendChild(modal);
    modal.showModal();

    document.getElementById('cancelModalBtn').addEventListener('click', () => modal.close());
    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

    document.getElementById('confirmRescheduleBtn').addEventListener('click', async () => {
        const newDate = document.getElementById('newDate').value;
        const newTime = document.getElementById('newTime').value;
        const errorEl = document.getElementById('modalError');
        errorEl.textContent = '';

        if (!newDate || !newTime) {
            errorEl.textContent = 'Please select both a date and time.';
            return;
        }

        // Enforce 09:00 – 17:00
        if (newTime < '09:00' || newTime > '17:00') {
            errorEl.textContent = 'Please choose a time between 09:00 and 17:00.';
            return;
        }

        // Check against unavailability records
        const clash = (unavailRecords || []).some(u => {
            if (u.Date !== newDate) return false;
            if (!u.Start && !u.End) return true; // full day block
            return newTime >= u.Start?.slice(0, 5) && newTime < u.End?.slice(0, 5);
        });

        if (clash) {
            errorEl.textContent = 'You are marked as unavailable at that date/time. Please choose another slot.';
            return;
        }

        const { error } = await supabase
            .from('Appointments')
            .update({
                appointment_date: newDate,
                appointment_time: newTime,
            })
            .eq('id', appointmentId);

        if (error) {
            errorEl.textContent = 'Failed to reschedule: ' + error.message;
            return;
        }

        modal.close();
        loadStaffDashboard();
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function updateAppointmentStatus(appointmentId, newStatus) {
    const { error } = await supabase
        .from('Appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

    if (error) {
        alert('Failed to update appointment status: ' + error.message);
    } else {
        loadStaffDashboard();
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12  = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);
loadStaffDashboard();