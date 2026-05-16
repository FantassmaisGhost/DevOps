// redirect.js
import { supabase } from '../backend/supabase.js';

export class RedirectController {
  constructor() {
    this.selectedRole = new URLSearchParams(window.location.search).get('role');
  }

  async handleRedirect() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      localStorage.removeItem('userRole');
      window.location.href = '../pages/index.html';
      return;
    }

    const email = session.user.email;
    const userId = session.user.id;
    const userName = session.user.user_metadata?.full_name || email.split('@')[0];

    const { data: admin } = await supabase.from('Admin').select('*').eq('Email', email).single();
    const { data: staff } = await supabase.from('Staff').select('*').eq('email', email).single();
    const { data: pending } = await supabase.from('pending_staff').select('*').eq('email', email).single();

    let actualRole = 'patient';
    if (admin) actualRole = 'admin';
    else if (staff) actualRole = 'staff';
    else if (pending) actualRole = 'pending';

    async function ensurePatientRecord() {
      const { data: patient } = await supabase.from('Patients').select('*').eq('id', userId).single();
      if (!patient) {
        await supabase.from('Patients').insert([{
          id: userId, email: email, role: 'patient',
          full_name: userName, created_at: new Date().toISOString()
        }]);
      }
    }

    if (!this.selectedRole) {
      if (actualRole === 'admin') {
        localStorage.setItem('userRole', 'admin');
        window.location.href = '../pages/admin-dashboard.html';
      } else if (actualRole === 'staff') {
        localStorage.setItem('userRole', 'staff');
        window.location.href = '../pages/staff-dashboard.html';
      } else if (actualRole === 'pending') {
        localStorage.setItem('userRole', 'pending');
        window.location.href = '../pages/pending-approval.html';
      } else {
        await ensurePatientRecord();
        localStorage.setItem('userRole', 'patient');
        window.location.href = '../pages/dashboard.html';
      }
      return;
    }

    // Handle new Google staff user who selected 'staff' but isn't registered yet
    if (this.selectedRole === 'staff' && actualRole === 'patient') {
      const { error: pendingInsertError } = await supabase.from('pending_staff').insert([{
        email: email, full_name: userName, status: 'pending'
      }]);
      if (!pendingInsertError || pendingInsertError.code === '23505') {
        localStorage.setItem('userRole', 'pending');
        window.location.href = '../pages/pending-approval.html';
        return;
      }
    }

    let isValid = false;
    let targetUrl = '';
    if (this.selectedRole === 'admin' && actualRole === 'admin') {
      isValid = true;
      targetUrl = '../pages/admin-dashboard.html';
      localStorage.setItem('userRole', 'admin');
    } else if (this.selectedRole === 'staff' && actualRole === 'staff') {
      isValid = true;
      targetUrl = '../pages/staff-dashboard.html';
      localStorage.setItem('userRole', 'staff');
    } else if (this.selectedRole === 'staff' && actualRole === 'pending') {
      isValid = true;
      targetUrl = '../pages/pending-approval.html';
      localStorage.setItem('userRole', 'pending');
    } else if (this.selectedRole === 'patient' && actualRole === 'patient') {
      isValid = true;
      targetUrl = '../pages/dashboard.html';
      localStorage.setItem('userRole', 'patient');
      await ensurePatientRecord();
    } else if (this.selectedRole === 'patient' && (actualRole === 'admin' || actualRole === 'staff' || actualRole === 'pending')) {
      isValid = true;
      targetUrl = '../pages/dashboard.html';
      localStorage.setItem('userRole', 'patient');
    }

    if (isValid) {
      window.location.href = targetUrl;
    } else {
      const spinner = document.getElementById('spinner');
      const message = document.getElementById('message');
      const errorMsg = document.getElementById('errorMsg');
      if (spinner) spinner.style.display = 'none';
      if (message) message.style.display = 'none';
      if (errorMsg) {
        errorMsg.innerHTML = `❌ Access Denied: You are not authorized as "${this.selectedRole}".<br>Redirecting to login page...`;
      }
      setTimeout(() => {
        localStorage.removeItem('userRole');
        window.location.href = '../pages/index.html';
      }, 3000);
    }
  }
}

// Run immediately
const controller = new RedirectController();
controller.handleRedirect();