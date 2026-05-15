class StaffDashboardController {
  async loadStaffDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '/pages/index.html';
    localStorage.setItem('userRole', 'staff');

    const { data: staff, error } = await supabase.from('Staff').select('*').eq('email', session.user.email).single();
    if (error || !staff) return window.location.href = '/pages/dashboard.html';

    this.currentStaff = staff;
    const { data: appointments } = await supabase.from('Appointments').select('*').eq('StaffID', staff.id).order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true });
    this.appointments = appointments || [];

    const today = new Date().toISOString().split('T')[0];
    const todaysAppointments = this.appointments.filter(a => a.appointment_date === today);
    const waiting = todaysAppointments.filter(a => a.status === 'waiting');
    const completed = todaysAppointments.filter(a => a.status === 'completed');

    // Render dashboard HTML (omitted for brevity, but includes stats, profile, appointments table)
    this.renderDashboard(staff, todaysAppointments, waiting.length, completed.length);
    this.attachEventHandlers();
  }

  async updateAppointmentStatus(appointmentId, newStatus) {
    const { error } = await supabase.from('Appointments').update({ status: newStatus }).eq('id', appointmentId);
    if (!error) this.loadStaffDashboard();
  }

  async logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
  }
}