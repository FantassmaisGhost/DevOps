class PendingApprovalController {
  constructor() {
    this.checkInterval = null;
  }

  async checkAndRedirect() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '/pages/index.html';
    localStorage.setItem('userRole', 'pending');

    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) userEmailElement.textContent = session.user.email;

    const { data: pending } = await supabase.from('pending_staff').select('*').eq('email', session.user.email).single();
    if (pending) {
      const { data: clinic } = await supabase.from('Facilities').select('Name').eq('ClinicID', pending.clinicid).single();
      document.getElementById('clinicInfo').innerHTML = clinic ? `🏥 Requested Clinic: ${clinic.Name}` : `🏥 Clinic ID: ${pending.clinicid}`;
    }

    const { data: staff } = await supabase.from('Staff').select('*').eq('email', session.user.email).single();
    if (staff) {
      clearInterval(this.checkInterval);
      localStorage.setItem('userRole', 'staff');
      window.location.href = '/pages/staff-dashboard.html';
    } else {
      document.getElementById('spinner').style.display = 'none';
    }
  }

  logout() {
    clearInterval(this.checkInterval);
    localStorage.removeItem('userRole');
    supabase.auth.signOut();
    window.location.href = '/pages/index.html';
  }

  startPolling() {
    this.checkAndRedirect();
    this.checkInterval = setInterval(() => this.checkAndRedirect(), 5000);
  }
}