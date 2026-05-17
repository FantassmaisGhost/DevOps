// redirect.js
import { supabase } from '../backend/supabase.js';

class RedirectController {
  constructor() {
    this.selectedRole = new URLSearchParams(window.location.search).get('role');
  }

  async handleRedirect(session) {
    if (!session) {
      localStorage.removeItem('userRole');
      window.location.href = '/pages/index.html';
      return;
    }

    const email = session.user.email;
    const userId = session.user.id;
    const userName = session.user.user_metadata?.full_name || email.split('@')[0];

    const [{ data: admin }, { data: staff }, { data: pending }] = await Promise.all([
      supabase.from('Admin').select('*').eq('Email', email).maybeSingle(),
      supabase.from('Staff').select('*').eq('email', email).maybeSingle(),
      supabase.from('pending_staff').select('*').eq('email', email).maybeSingle()
    ]);

    let actualRole = 'patient';
    if (admin) actualRole = 'admin';
    else if (staff) actualRole = 'staff';
    else if (pending) actualRole = 'pending';

    async function ensurePatientRecord() {
      const { data: patient } = await supabase.from('Patients').select('*').eq('id', userId).maybeSingle();
      if (!patient) {
        await supabase.from('Patients').insert([{
          id: userId, email, role: 'patient',
          full_name: userName, created_at: new Date().toISOString()
        }]);
      }
    }

    if (!this.selectedRole) {
      localStorage.setItem('userRole', actualRole);
      if (actualRole === 'admin') window.location.href = '/pages/admin-dashboard.html';
      else if (actualRole === 'staff') window.location.href = '/pages/staff-dashboard.html';
      else if (actualRole === 'pending') window.location.href = '/pages/pending-approval.html';
      else { await ensurePatientRecord(); window.location.href = '/pages/dashboard.html'; }
      return;
    }

    if (this.selectedRole === 'staff' && actualRole === 'patient') {
      const { error: pendingInsertError } = await supabase.from('pending_staff').insert([{
        email, full_name: userName, status: 'pending'
      }]);
      if (!pendingInsertError || pendingInsertError.code === '23505') {
        localStorage.setItem('userRole', 'pending');
        window.location.href = '/pages/pending-approval.html';
        return;
      }
    }

    let isValid = false;
    let targetUrl = '';

    if (this.selectedRole === 'admin' && actualRole === 'admin') { isValid = true; targetUrl = '/pages/admin-dashboard.html'; }
    else if (this.selectedRole === 'staff' && actualRole === 'staff') { isValid = true; targetUrl = '/pages/staff-dashboard.html'; }
    else if (this.selectedRole === 'staff' && actualRole === 'pending') { isValid = true; targetUrl = '/pages/pending-approval.html'; }
    else if (this.selectedRole === 'patient' && actualRole === 'patient') { isValid = true; targetUrl = '/pages/dashboard.html'; await ensurePatientRecord(); }
    else if (this.selectedRole === 'patient' && ['admin','staff','pending'].includes(actualRole)) { isValid = true; targetUrl = '/pages/dashboard.html'; }

    if (isValid) {
      localStorage.setItem('userRole', this.selectedRole);
      window.location.href = targetUrl;
    } else {
      localStorage.setItem('userRole', 'patient');
      window.location.href = '/pages/dashboard.html';
    }
  }
}

const controller = new RedirectController();

// First try: handle if session already exists (email/password login)
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  controller.handleRedirect(session);
} else {
  // Second try: wait for Supabase to parse the OAuth hash and fire SIGNED_IN
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      subscription.unsubscribe();
      controller.handleRedirect(session);
    }
  });

  // Timeout fallback — if nothing fires after 5s, give up
  setTimeout(() => {
    subscription.unsubscribe();
    localStorage.removeItem('userRole');
    window.location.href = '/pages/index.html';
  }, 5000);
}