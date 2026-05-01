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

async function loadStaffDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        localStorage.removeItem('userRole');
        window.location.href = '/pages/index.html';
        return;
    }

    // Restore role
    localStorage.setItem('userRole', 'staff');

    const { data: staff, error } = await supabase
        .from('staffs')
        .select('*')
        .eq('email', session.user.email)
        .single();

    if (error || !staff) {
        window.location.href = '/pages/dashboard.html';
        return;
    }

    document.getElementById('userEmail').textContent = session.user.email;

    // Load appointments for this staff member using their staffid
    const { data: appointments, error: appointmentsError } = await supabase
        .from('Appointments')
        .select('*')
        .eq('StaffID', staff.staffid)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

    if (appointmentsError) {
        console.error('Error loading appointments:', appointmentsError);
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Filter today's appointments
    const todaysAppointments = appointments?.filter(a => a.appointment_date === today) || [];
    const waitingAppointments = todaysAppointments.filter(a => a.status === 'waiting');
    const completedAppointments = todaysAppointments.filter(a => a.status === 'completed');
    const cancelledAppointments = todaysAppointments.filter(a => a.status === 'cancelled');

    const main = document.getElementById('dashboardContent');
    main.innerHTML = `
        <article class="welcome-card">
            <h2>Welcome, ${staff.full_name.split(' ')[0]}! 👋</h2>
            <p>You are logged in as a staff member at Clinic ${staff.clinicid}</p>
            <p><strong>Staff ID:</strong> ${escapeHtml(staff.staffid || 'Not assigned')}</p>
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
                ${escapeHtml(staff.staffid || 'Not assigned')}
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
                ${escapeHtml(staff.occupation)}
            </section>
            <section class="info-row">
                <strong class="info-label">Phone:</strong>
                ${escapeHtml(staff.phone_number || 'Not provided')}
            </section>
        </article>

        <article class="info-card">
            <h3>Clinic Information</h3>
            <section class="info-row">
                <strong class="info-label">Clinic ID:</strong>
                ${escapeHtml(staff.clinicid)}
            </section>
            <section class="info-row">
                <strong class="info-label">Your Role:</strong>
                ${escapeHtml(staff.occupation)}
            </section>
        </article>

        <article class="info-card">
            <h3>📋 Today's Appointments</h3>
            ${todaysAppointments.length === 0 ? 
                '<p style="text-align: center; padding: 20px;">No appointments scheduled for today.</p>' : 
                `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #252b3d;">Patient</th>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #252b3d;">Time</th>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #252b3d;">Reason</th>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #252b3d;">Status</th>
                            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #252b3d;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${todaysAppointments.map(apt => {
                            let statusBadge = '';
                            let actionButtons = '';
                            
                            if (apt.status === 'waiting') {
                                statusBadge = '<span style="background: #f5a623; color: #0b0e14; padding: 2px 8px; border-radius: 12px; font-size: 11px;">WAITING</span>';
                                actionButtons = `
                                    <button class="complete-btn" data-id="${apt.id}" style="background: #00e5a0; color: #0b0e14; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Complete</button>
                                    <button class="cancel-btn" data-id="${apt.id}" style="background: #ff6b6b; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer;">Cancel</button>
                                `;
                            } else if (apt.status === 'completed') {
                                statusBadge = '<span style="background: #00e5a0; color: #0b0e14; padding: 2px 8px; border-radius: 12px; font-size: 11px;">COMPLETED</span>';
                                actionButtons = '<span style="color: #5a6280;">-</span>';
                            } else if (apt.status === 'cancelled') {
                                statusBadge = '<span style="background: #ff6b6b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">CANCELLED</span>';
                                actionButtons = '<span style="color: #5a6280;">-</span>';
                            }
                            
                            return `
                                <tr>
                                    <td style="padding: 8px; border-bottom: 1px solid #252b3d;">${escapeHtml(apt.patient_name)}</td>
                                    <td style="padding: 8px; border-bottom: 1px solid #252b3d;">${escapeHtml(apt.appointment_time?.slice(0,5)) || 'N/A'}</td>
                                    <td style="padding: 8px; border-bottom: 1px solid #252b3d;">${escapeHtml(apt.reason || 'N/A')}</td>
                                    <td style="padding: 8px; border-bottom: 1px solid #252b3d;">${statusBadge}</td>
                                    <td style="padding: 8px; border-bottom: 1px solid #252b3d;">${actionButtons}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                `
            }
        </article>

        <footer class="action-buttons">
            <button class="btn-primary" id="refreshBtn">🔄 Refresh</button>
        </footer>
    `;

    // Add event listeners for Complete and Cancel buttons
    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const appointmentId = btn.getAttribute('data-id');
            await updateAppointmentStatus(appointmentId, 'completed');
        });
    });

    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const appointmentId = btn.getAttribute('data-id');
            if (confirm('Cancel this appointment?')) {
                await updateAppointmentStatus(appointmentId, 'cancelled');
            }
        });
    });

    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadStaffDashboard();
    });
}

async function updateAppointmentStatus(appointmentId, newStatus) {
    const { error } = await supabase
        .from('Appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);
    
    if (error) {
        alert('Failed to update appointment status: ' + error.message);
    } else {
        // Refresh the dashboard to show updated status
        loadStaffDashboard();
    }
}

async function logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);
loadStaffDashboard();