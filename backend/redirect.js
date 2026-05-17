import { supabase } from './supabase.js';

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

    const { data: admin } = await supabase
      .from('Admin')
      .select('*')
      .eq('Email', email)
      .maybeSingle();

    const { data: staff } = await supabase
      .from('Staff')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    const { data: pending } = await supabase
      .from('pending_staff')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    const { data: receptionist } = await supabase
      .from('Receptionist')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    // ADD THIS - PENDING RECEPTIONIST CHECK
    const { data: pendingRec } = await supabase
      .from('pending_receptionists')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    let actualRole = 'patient';

    if (admin) actualRole = 'admin';
    else if (receptionist) actualRole = 'receptionist';
    else if (pendingRec) actualRole = 'pending_receptionist';  // ADD THIS
    else if (staff) actualRole = 'staff';
    else if (pending) actualRole = 'pending';

    // Log AFTER actualRole is defined
    console.log('Session user email:', email);
    console.log('Admin record:', admin);
    console.log('Staff record:', staff);
    console.log('Pending record:', pending);
    console.log('Pending Receptionist record:', pendingRec);
    console.log('Selected role:', this.selectedRole);
    console.log('Actual role:', actualRole);

    async function ensurePatientRecord() {
      const { data: patient } = await supabase
        .from('Patients')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!patient) {
        await supabase.from('Patients').insert([{
          id: userId,
          email: email,
          role: 'patient',
          full_name: userName,
          created_at: new Date().toISOString()
        }]);
      }
    }

    // No role selected → use actual role
    if (!this.selectedRole) {
      if (actualRole === 'admin') {
        localStorage.setItem('userRole', 'admin');
        window.location.href = '/pages/admin-dashboard.html';
        return;
      }

      if (actualRole === 'receptionist') {
        localStorage.setItem('userRole', 'receptionist');
        localStorage.setItem('clinicid', receptionist.clinicid);
        localStorage.setItem('clinicname', receptionist.clinicname);
        window.location.href = '/pages/receptionist-dashboard.html';
        return;
      }

      if (actualRole === 'staff') {
        localStorage.setItem('userRole', 'staff');
        window.location.href = '/pages/staff-dashboard.html';
        return;
      }

      if (actualRole === 'pending') {
        localStorage.setItem('userRole', 'pending');
        window.location.href = '/pages/pending-approval.html';
        return;
      }

      // ADD THIS - PENDING RECEPTIONIST
      if (actualRole === 'pending_receptionist') {
        localStorage.setItem('userRole', 'pending');
        window.location.href = '/pages/pending-approval.html';
        return;
      }

      await ensurePatientRecord();
      localStorage.setItem('userRole', 'patient');
      window.location.href = '/pages/dashboard.html';
      return;
    }

    if (this.selectedRole === 'admin' && actualRole === 'admin') {
      localStorage.setItem('userRole', 'admin');
      window.location.href = '/pages/admin-dashboard.html';
      return;
    }

    if (this.selectedRole === 'receptionist' && actualRole === 'receptionist') {
      localStorage.setItem('userRole', 'receptionist');
      localStorage.setItem('clinicid', receptionist.clinicid);
      localStorage.setItem('clinicname', receptionist.clinicname);
      window.location.href = '/pages/receptionist-dashboard.html';
      return;
    }

    // ADD THIS - RECEPTIONIST PENDING
    if (this.selectedRole === 'receptionist' && actualRole === 'pending_receptionist') {
      localStorage.setItem('userRole', 'pending');
      window.location.href = '/pages/pending-approval.html';
      return;
    }

    if (this.selectedRole === 'staff' && actualRole === 'staff') {
      localStorage.setItem('userRole', 'staff');
      window.location.href = '/pages/staff-dashboard.html';
      return;
    }

    if (this.selectedRole === 'staff' && actualRole === 'pending') {
      localStorage.setItem('userRole', 'pending');
      window.location.href = '/pages/pending-approval.html';
      return;
    }

    if (this.selectedRole === 'patient') {
      await ensurePatientRecord();
      localStorage.setItem('userRole', 'patient');
      window.location.href = '/pages/dashboard.html';
      return;
    }

    const spinner = document.getElementById('spinner');
    const message = document.getElementById('message');
    const errorMsg = document.getElementById('errorMsg');

    if (spinner) spinner.style.display = 'none';
    if (message) message.style.display = 'none';

    if (errorMsg) {
      errorMsg.innerHTML = `❌ Access Denied: You are not registered as "${this.selectedRole}".`;
    }

    setTimeout(() => {
      localStorage.removeItem('userRole');
      window.location.href = '/pages/index.html';
    }, 3000);
  }
}

const controller = new RedirectController();
controller.handleRedirect();