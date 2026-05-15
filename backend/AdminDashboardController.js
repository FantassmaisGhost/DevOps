class AdminDashboardController {
  async loadAdminDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '/pages/index.html';
    localStorage.setItem('userRole', 'admin');
    const { data: admin } = await supabase.from('Admin').select('*').eq('Email', session.user.email).single();
    if (!admin) return window.location.href = '/pages/index.html';
    document.getElementById('userEmail').textContent = session.user.email;
  }

  async logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
  }
}