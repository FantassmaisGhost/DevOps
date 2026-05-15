class PatientDashboardController {
  async checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '/pages/index.html';
    localStorage.setItem('userRole', 'patient');
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('welcomeMsg').textContent = `Welcome back, ${session.user.email.split('@')[0]}! 👋`;
  }

  async logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
  }
}