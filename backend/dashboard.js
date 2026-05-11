// dashboard.js
import { supabase } from './supabase.js';

export class PatientDashboardController {
  async checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      localStorage.removeItem('userRole');
      window.location.href = '/pages/index.html';
      return;
    }
    localStorage.setItem('userRole', 'patient');
    const email = session.user.email;
    document.getElementById('userEmail').textContent = email;
    document.getElementById('welcomeMsg').textContent = `Welcome back, ${email.split('@')[0]}! 👋`;
  }

  async logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
  }
}

const controller = new PatientDashboardController();
controller.checkAuth();
document.getElementById('logoutBtn').addEventListener('click', () => controller.logout());