// admin-dashboard.js
import { supabase } from './supabase.js';

export class AdminDashboardController {
  async loadAdminDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      localStorage.removeItem('userRole');
      window.location.href = '/pages/index.html';
      return;
    }
    localStorage.setItem('userRole', 'admin');
    const { data: admin } = await supabase.from('Admin').select('*').eq('Email', session.user.email).single();
    if (!admin) {
      localStorage.removeItem('userRole');
      window.location.href = '/pages/index.html';
      return;
    }
    document.getElementById('userEmail').textContent = session.user.email;
  }

  async logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
  }
}

const controller = new AdminDashboardController();
controller.loadAdminDashboard();
document.getElementById('logoutBtn').addEventListener('click', () => controller.logout());