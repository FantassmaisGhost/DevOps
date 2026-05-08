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

    const main = document.getElementById('dashboardContent');
    main.innerHTML = `
        <article class="welcome-card">
            <h2>Welcome, ${staff.full_name.split(' ')[0]}! 👋</h2>
            <p>You are logged in as a staff member at Clinic ${staff.clinicid}</p>
        </article>

        <section class="stats-grid">
            <article class="stat-card">
                <h3>0</h3>
                <p>Today's Patients</p>
            </article>
            <article class="stat-card">
                <h3>0</h3>
                <p>In Queue</p>
            </article>
            <article class="stat-card">
                <h3>0</h3>
                <p>This Week</p>
            </article>
        </section>

        <article class="info-card">
            <h3>Your Profile</h3>
            <section class="info-row">
                <strong class="info-label">Full Name:</strong>
                <span class="info-value">${escapeHtml(staff.full_name)}</span>
            </section>
            <section class="info-row">
                <strong class="info-label">Email:</strong>
                <span class="info-value">${escapeHtml(staff.email)}</span>
            </section>
            <section class="info-row">
                <strong class="info-label">Occupation:</strong>
                <span class="info-value">${escapeHtml(staff.occupation)}</span>
            </section>
            <section class="info-row">
                <strong class="info-label">Phone:</strong>
                <span class="info-value">${escapeHtml(staff.phone_number || 'Not provided')}</span>
            </section>
        </article>

        <article class="info-card">
            <h3>Clinic Information</h3>
            <section class="info-row">
                <strong class="info-label">Clinic ID:</strong>
                <span class="info-value">${escapeHtml(staff.clinicid)}</span>
            </section>
            <section class="info-row">
                <strong class="info-label">Your Role:</strong>
                <span class="info-value">${escapeHtml(staff.occupation)}</span>
            </section>
        </article>

        <footer class="action-buttons">
            <button class="btn-primary" id="manageAppointmentsBtn">📅 Manage Appointments</button>
            <button class="btn-secondary" id="viewQueueBtn">👥 View Queue</button>
        </footer>
    `;

    document.getElementById('manageAppointmentsBtn')?.addEventListener('click', () => alert('Appointment management coming soon!'));
    document.getElementById('viewQueueBtn')?.addEventListener('click', () => alert('Queue view coming soon!'));
}

async function logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);
loadStaffDashboard();