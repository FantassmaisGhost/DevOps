// redirect.js
import { supabase } from '../backend/supabase.js';

export class RedirectController {
  constructor() {
    this.selectedRole = new URLSearchParams(window.location.search).get('role');
  }

  async handleRedirect() {
    // ========== DEBUG ALERTS ==========
    alert('1. Redirect page loaded');
    alert('2. URL: ' + window.location.href);
    alert('3. Selected role from URL: ' + this.selectedRole);
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    alert('4. Session exists? ' + (session ? 'YES' : 'NO'));
    if (session) {
      alert('5. User email: ' + session.user.email);
    }
    if (error) {
      alert('6. Error message: ' + error.message);
    }
    // ========== END DEBUG ==========
    
    if (!session) {
      alert('7. NO SESSION - Redirecting to login page');
      localStorage.removeItem('userRole');
      window.location.href = '/pages/index.html';
      return;
    }

    alert('8. SESSION FOUND! Continuing...');
    
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

    alert('9. Actual role: ' + actualRole);
    alert('10. Admin found: ' + (admin ? 'YES' : 'NO'));
    alert('11. Staff found: ' + (staff ? 'YES' : 'NO'));
    alert('12. Pending found: ' + (pending ? 'YES' : 'NO'));

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
      alert('13. No role selected, using actual role: ' + actualRole);
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
      alert('14. Creating pending record for staff...');
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
      alert('15. Valid role! Redirecting to: ' + targetUrl);
      localStorage.setItem('userRole', this.selectedRole);
      window.location.href = targetUrl;
    } else {
      alert('16. Role mismatch! Falling back to patient dashboard');
      console.warn('Role mismatch, falling back to patient dashboard');
      localStorage.setItem('userRole', 'patient');
      window.location.href = '/pages/dashboard.html';
    }
  }
}

// Run immediately
const controller = new RedirectController();
controller.handleRedirect();