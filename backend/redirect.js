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
      window.location.href = '/pages/index.html';
      return;
    }

    const email = session.user.email;
    const userId = session.user.id;
    const userName = session.user.user_metadata?.full_name || email.split('@')[0];

    // Use maybeSingle() to avoid 406 errors when no record exists
    const [{ data: admin }, { data: staff }, { data: pending }] = await Promise.all([
      supabase.from('Admin').select('*').eq('Email', email).maybeSingle(),
      supabase.from('Staff').select('*').eq('email', email).maybeSingle(),
      supabase.from('pending_staff').select('*').eq('email', email).maybeSingle()
    ]);

    let actualRole = 'patient';
    if (admin) actualRole = 'admin';
    else if (staff) actualRole = 'staff';
    else if (pending) actualRole = 'pending';

    // Log AFTER actualRole is defined
    console.log('Session user email:', email);
    console.log('Admin record:', admin);
    console.log('Staff record:', staff);
    console.log('Pending record:', pending);
    console.log('Selected role:', this.selectedRole);
    console.log('Actual role:', actualRole);

    async function ensurePatientRecord() {
      const { data: patient } = await supabase.from('Patients').select('*').eq('id', userId).maybeSingle();
      if (!patient) {
        await supabase.from('Patients').insert([{
          id: userId, email, role: 'patient',
          full_name: userName, created_at: new Date().toISOString()
        }]);
      }
    }

    // No role selected → use actual role
    if (!this.selectedRole) {
      localStorage.setItem('userRole', actualRole);
      if (actualRole === 'admin') window.location.href = '/pages/admin-dashboard.html';
      else if (actualRole === 'staff') window.location.href = '/pages/staff-dashboard.html';
      else if (actualRole === 'pending') window.location.href = '/pages/pending-approval.html';
      else {
        await ensurePatientRecord();
        window.location.href = '/pages/dashboard.html';
      }
      return;
    }

    // Handle Google staff login (creates pending record)
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

    // Validate selected role against actual role
    let isValid = false;
    let targetUrl = '';

    if (this.selectedRole === 'admin' && actualRole === 'admin') {
      isValid = true;
      targetUrl = '/pages/admin-dashboard.html';
    } else if (this.selectedRole === 'staff' && actualRole === 'staff') {
      isValid = true;
      targetUrl = '/pages/staff-dashboard.html';
    } else if (this.selectedRole === 'staff' && actualRole === 'pending') {
      isValid = true;
      targetUrl = '/pages/pending-approval.html';
    } else if (this.selectedRole === 'patient' && actualRole === 'patient') {
      isValid = true;
      targetUrl = '/pages/dashboard.html';
      await ensurePatientRecord();
    } else if (this.selectedRole === 'patient' && (actualRole === 'admin' || actualRole === 'staff' || actualRole === 'pending')) {
      isValid = true;
      targetUrl = '/pages/dashboard.html';
    }

    if (isValid) {
      localStorage.setItem('userRole', this.selectedRole);
      window.location.href = targetUrl;
    } else {
      // Fallback: send to patient dashboard instead of looping
      console.warn('Role mismatch, falling back to patient dashboard');
      localStorage.setItem('userRole', 'patient');
      window.location.href = '/pages/dashboard.html';
    }
  }
}

// Run immediately
const controller = new RedirectController();
controller.handleRedirect();