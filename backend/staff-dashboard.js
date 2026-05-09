// staff-dashboard.js
import { supabase } from './supabase.js';

export class StaffDashboardController {
  constructor() {
    this.currentStaff = null;
    this.appointments = [];
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  async loadStaffDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      localStorage.removeItem('userRole');
      window.location.href = '/pages/index.html';
      return;
    }
    localStorage.setItem('userRole', 'staff');
    const { data: staff, error } = await supabase.from('Staff').select('*').eq('email', session.user.email).single();
    if (error || !staff) {
      window.location.href = '/pages/dashboard.html';
      return;
    }
    this.currentStaff = staff;
    document.getElementById('userEmail').textContent = session.user.email;

    const { data: appointments, error: appointmentsError } = await supabase.from('Appointments').select('*').eq('StaffID', staff.id).order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true });
    if (!appointmentsError) this.appointments = appointments || [];

    const today = new Date().toISOString().split('T')[0];
    const todaysAppointments = this.appointments.filter(a => a.appointment_date === today);
    const waitingAppointments = todaysAppointments.filter(a => a.status === 'waiting');
    const completedAppointments = todaysAppointments.filter(a => a.status === 'completed');

    const main = document.getElementById('dashboardContent');
    main.innerHTML = `
      <article class="welcome-card">
        <h2>Welcome, ${staff.full_name.split(' ')[0]}! 👋</h2>
        <p><strong>Staff ID:</strong> ${this.escapeHtml(staff.id)}</p>
      </article>
      <section class="stats-grid">
        <article class="stat-card"><h3>${waitingAppointments.length}</h3><p>Waiting Patients</p></article>
        <article class="stat-card"><h3>${completedAppointments.length}</h3><p>Completed Today</p></article>
        <article class="stat-card"><h3>${todaysAppointments.length}</h3><p>Today's Appointments</p></article>
      </section>
      <article class="info-card">
        <h3>Your Profile</h3>
        <div class="info-row"><strong class="info-label">Staff ID:</strong> ${this.escapeHtml(staff.id)}</div>
        <div class="info-row"><strong class="info-label">Full Name:</strong> ${this.escapeHtml(staff.full_name)}</div>
        <div class="info-row"><strong class="info-label">Email:</strong> ${this.escapeHtml(staff.email)}</div>
        <div class="info-row"><strong class="info-label">Occupation:</strong> ${this.escapeHtml(staff.Occupation)}</div>
        <div class="info-row"><strong class="info-label">Phone:</strong> ${this.escapeHtml(staff.contact || 'Not provided')}</div>
      </article>
      <article class="info-card">
        <h3>Clinic Information</h3>
        <div class="info-row"><strong class="info-label">Clinic ID:</strong> ${this.escapeHtml(staff.ClinicID)}</div>
        <div class="info-row"><strong class="info-label">Your Role:</strong> ${this.escapeHtml(staff.Occupation)}</div>
      </article>
      <article class="info-card">
        <h3>📋 Today's Appointments</h3>
        ${todaysAppointments.length === 0 ? '<p style="text-align: center; padding: 20px;">No appointments scheduled for today.</p>' : `
        <table style="width: 100%; border-collapse: collapse;">
          <thead><tr><th>Patient</th><th>Time</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${todaysAppointments.map(apt => {
              let statusBadge = '';
              let actionButtons = '';
              if (apt.status === 'waiting') {
                statusBadge = '<span style="background: #f5a623; color: #0b0e14; padding: 2px 8px; border-radius: 12px; font-size: 11px;">WAITING</span>';
                actionButtons = `<button class="complete-btn" data-id="${apt.id}" style="background:#00e5a0;color:#0b0e14;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;margin-right:5px;">Complete</button>
                                 <button class="cancel-btn" data-id="${apt.id}" style="background:#ff6b6b;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Cancel</button>`;
              } else if (apt.status === 'completed') {
                statusBadge = '<span style="background:#00e5a0;color:#0b0e14;padding:2px 8px;border-radius:12px;font-size:11px;">COMPLETED</span>';
                actionButtons = '<span style="color:#5a6280;">-</span>';
              } else if (apt.status === 'cancelled') {
                statusBadge = '<span style="background:#ff6b6b;color:white;padding:2px 8px;border-radius:12px;font-size:11px;">CANCELLED</span>';
                actionButtons = '<span style="color:#5a6280;">-</span>';
              }
              return `<tr><td>${this.escapeHtml(apt.patient_name)}</td><td>${this.escapeHtml(apt.appointment_time?.slice(0,5)) || 'N/A'}</td><td>${this.escapeHtml(apt.reason || 'N/A')}</td><td>${statusBadge}</td><td>${actionButtons}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
        `}
      </article>
      <footer class="action-buttons"><button class="btn-primary" id="refreshBtn">🔄 Refresh</button></footer>
    `;

    document.querySelectorAll('.complete-btn').forEach(btn => {
      btn.addEventListener('click', async () => await this.updateAppointmentStatus(btn.getAttribute('data-id'), 'completed'));
    });
    document.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', async () => { if (confirm('Cancel this appointment?')) await this.updateAppointmentStatus(btn.getAttribute('data-id'), 'cancelled'); });
    });
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadStaffDashboard());
  }

  async updateAppointmentStatus(appointmentId, newStatus) {
    const { error } = await supabase.from('Appointments').update({ status: newStatus }).eq('id', appointmentId);
    if (error) alert('Failed to update appointment status: ' + error.message);
    else this.loadStaffDashboard();
  }

  async logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
  }
}

const controller = new StaffDashboardController();
controller.loadStaffDashboard();
document.getElementById('logoutBtn').addEventListener('click', () => controller.logout());