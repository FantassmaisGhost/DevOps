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

// ─── Check & mark unavailable appointments ───────────────────────────────────

async function markUnavailableAppointments(staffId, appointments) {
    if (!appointments?.length) return appointments;

    const { data: unavailRecords, error } = await supabase
        .from('staff_unavail')
        .select('*')
        .eq('Staff_id', staffId);

    if (error || !unavailRecords?.length) return appointments;

    const toMark = [];

    for (const apt of appointments) {
        if (apt.status !== 'waiting') continue;

        const aptDate = apt.appointment_date;
        const aptTime = apt.appointment_time?.slice(0, 5);

        const isUnavailable = unavailRecords.some(u => {
            if (u.Date !== aptDate) return false;

            if (!u.Start && !u.End) return true;

            return (
                aptTime >= u.Start?.slice(0, 5) &&
                aptTime < u.End?.slice(0, 5)
            );
        });

        if (isUnavailable) toMark.push(apt.id);
    }

    if (toMark.length > 0) {
        await supabase
            .from('Appointments')
            .update({ status: 'unavailable' })
            .in('id', toMark);

        appointments = appointments.map(apt =>
            toMark.includes(apt.id)
                ? { ...apt, status: 'unavailable' }
                : apt
        );
    }

    return appointments;
}

// ─── Main dashboard loader ───────────────────────────────────────────────────

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

    let { data: appointments, error: appointmentsError } = await supabase
        .from('Appointments')
        .select('*')
        .eq('StaffID', staff.id)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

    if (appointmentsError) {
        console.error('Error loading appointments:', appointmentsError);
        appointments = [];
    }

    appointments = await markUnavailableAppointments(staff.id, appointments);

    const today = new Date().toISOString().split('T')[0];

    const todaysAppointments = appointments?.filter(a => a.appointment_date === today) || [];
    const waitingAppointments = todaysAppointments.filter(a => a.status === 'waiting');
    const completedAppointments = todaysAppointments.filter(a => a.status === 'completed');

    const main = document.getElementById('dashboardContent');

    main.innerHTML = `
        <article class="welcome-card">
            <h2>Welcome, ${escapeHtml(staff.full_name?.split(' ')[0] || 'Staff')}! 👋</h2>
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

            <p style="margin-top: 10px; color: #9aa4bf;">
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
                            const status = String(apt.status || '').trim().toLowerCase();

                            let statusBadge = '';
                            let actionButtons = '';

                            if (status === 'waiting') {
                                statusBadge = '<span class="status-badge status-waiting">WAITING</span>';

                                actionButtons = `
                                    <button class="complete-btn" data-id="${apt.id}">
                                        Complete
                                    </button>

                                    <button class="cancel-btn" data-id="${apt.id}">
                                        Cancel
                                    </button>
                                `;
                            }

                            else if (status === 'completed') {
                                statusBadge = '<span class="status-badge status-completed">COMPLETED</span>';
                                actionButtons = '<span style="color:#5a6280;">-</span>';
                            }

                            else if (status === 'cancelled') {
                                statusBadge = '<span class="status-badge status-cancelled">CANCELLED</span>';
                                actionButtons = '<span style="color:#5a6280;">-</span>';
                            }

                            else if (status === 'unavailable') {
                                statusBadge = '<span class="status-badge status-unavailable">UNAVAILABLE</span>';

                                actionButtons = `
                                    <button
                                        class="reschedule-btn"
                                        data-id="${apt.id}"
                                        data-patient="${escapeHtml(apt.patient_name)}"
                                        data-date="${apt.appointment_date}"
                                        data-time="${apt.appointment_time?.slice(0, 5)}"
                                    >
                                        Reschedule
                                    </button>
                                `;
                            }

                            return `
                                <tr>
                                    <td>${escapeHtml(apt.patient_name)}</td>
                                    <td>${escapeHtml(apt.appointment_time?.slice(0, 5)) || 'N/A'}</td>
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
                btn.getAttribute('data-time')
            );
        });
    });

    document.getElementById('refreshBtn')?.addEventListener('click', loadStaffDashboard);
}

// ─── Reschedule modal ────────────────────────────────────────────────────────

async function openRescheduleModal(appointmentId, patientName, currentDate, currentTime) {
    document.getElementById('rescheduleModal')?.remove();

    const modal = document.createElement('dialog');
    modal.id = 'rescheduleModal';

    modal.innerHTML = `
        <article class="modal-box">
            <h3>Reschedule Appointment</h3>

            <p>
                Patient:
                <strong>${escapeHtml(patientName)}</strong>
            </p>

            <p style="color:#a0a8c0; font-size:13px;">
                Current:
                ${formatDate(currentDate)}
                at
                ${formatTime(currentTime)}
            </p>

            <section class="modal-form">
                <section class="form-group">
                    <label for="newDate">New Date</label>

                    <input
                        type="date"
                        id="newDate"
                        min="${new Date().toISOString().split('T')[0]}"
                        value="${currentDate}"
                    />

                    <small class="field-error" id="newDateError"></small>
                </section>

                <section class="form-group">
                    <label for="newTime">New Time</label>

                    <input
                        type="time"
                        id="newTime"
                        min="09:00"
                        max="17:00"
                        value="${currentTime}"
                    />

                    <small class="field-error" id="newTimeError"></small>
                </section>
            </section>

            <footer class="modal-actions">
                <button class="btn-secondary" id="cancelModalBtn">
                    Cancel
                </button>

                <button class="reschedule-btn" id="confirmRescheduleBtn">
                    Reschedule
                </button>
            </footer>
        </article>
    `;

    document.body.appendChild(modal);
    modal.showModal();

    document.getElementById('cancelModalBtn').addEventListener('click', () => {
        modal.close();
        modal.remove();
    });

    modal.addEventListener('click', e => {
        if (e.target === modal) {
            modal.close();
            modal.remove();
        }
    });

    document.getElementById('confirmRescheduleBtn').addEventListener('click', async () => {
        clearFieldErrors();

        const newDate = document.getElementById('newDate').value;
        const newTime = document.getElementById('newTime').value;

        let hasError = false;

        if (!newDate) {
            showFieldError('newDate', 'Please select a new date.');
            hasError = true;
        }

        if (!newTime) {
            showFieldError('newTime', 'Please select a new time.');
            hasError = true;
        }

        if (hasError) return;

        if (newTime < '09:00' || newTime > '17:00') {
            showFieldError('newTime', 'Time must be between 09:00 and 17:00.');
            return;
        }

        const { data: appointmentData, error: appointmentError } = await supabase
            .from('Appointments')
            .select('StaffID')
            .eq('id', appointmentId)
            .single();

        if (appointmentError || !appointmentData) {
            showFieldError('newDate', 'Could not verify this appointment.');
            showFieldError('newTime', 'Please try again.');
            return;
        }

        const { data: unavailRecords, error: unavailError } = await supabase
            .from('staff_unavail')
            .select('*')
            .eq('Staff_id', appointmentData.StaffID);

        if (unavailError) {
            showFieldError('newDate', 'Could not check availability.');
            showFieldError('newTime', 'Please try again.');
            return;
        }

        const isUnavailable = unavailRecords?.some(u => {
            if (u.Date !== newDate) return false;

            if (!u.Start && !u.End) {
                return true;
            }

            return (
                newTime >= u.Start?.slice(0, 5) &&
                newTime < u.End?.slice(0, 5)
            );
        });

        if (isUnavailable) {
            showFieldError('newDate', 'This date is unavailable.');
            showFieldError('newTime', 'Choose another available slot.');
            return;
        }

        const { error } = await supabase
            .from('Appointments')
            .update({
                appointment_date: newDate,
                appointment_time: newTime,
                status: 'waiting',
            })
            .eq('id', appointmentId);

        if (error) {
            showFieldError('newDate', 'Failed to reschedule.');
            showFieldError('newTime', error.message);
            return;
        }

        modal.close();
        modal.remove();

        showToast('Appointment rescheduled successfully!');
        loadStaffDashboard();
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function updateAppointmentStatus(appointmentId, newStatus) {
    const { error } = await supabase
        .from('Appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

    if (error) {
        showToast('Failed to update appointment status: ' + error.message, true);
        return;
    }

    showToast('Appointment updated successfully!');
    loadStaffDashboard();
}

function formatDate(dateStr) {
    if (!dateStr) return '';

    const d = new Date(dateStr + 'T00:00:00');

    return d.toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(timeStr) {
    if (!timeStr) return '';

    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;

    return `${h12}:${m} ${ampm}`;
}

function showToast(message, isError = false) {
    let toast = document.getElementById('toast');

    if (!toast) {
        toast = document.createElement('aside');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `toast ${isError ? 'error' : 'success'} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(`${inputId}Error`);

    if (!input || !error) return;

    error.textContent = message;
    error.classList.add('show');
    input.classList.add('input-error');
}

function clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(error => {
        error.textContent = '';
        error.classList.remove('show');
    });

    document.querySelectorAll('.input-error').forEach(input => {
        input.classList.remove('input-error');
    });
}

// ─── Logout ──────────────────────────────────────────────────────────────────

async function logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

loadStaffDashboard();