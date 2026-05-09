class RedirectController {
  constructor() {
    this.selectedRole = new URLSearchParams(window.location.search).get('role');
  }

  async handleRedirect() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '/pages/index.html';

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

    if (!this.selectedRole) {
      if (actualRole === 'admin') localStorage.setItem('userRole', 'admin'), window.location.href = '/pages/admin-dashboard.html';
      else if (actualRole === 'staff') localStorage.setItem('userRole', 'staff'), window.location.href = '/pages/staff-dashboard.html';
      else if (actualRole === 'pending') localStorage.setItem('userRole', 'pending'), window.location.href = '/pages/pending-approval.html';
      else { await this.ensurePatientRecord(); localStorage.setItem('userRole', 'patient'); window.location.href = '/pages/dashboard.html'; }
      return;
    }

    // Role validation logic from redirect.js
    let isValid = false, targetUrl = '';
    if (this.selectedRole === 'admin' && actualRole === 'admin') isValid = true, targetUrl = '/pages/admin-dashboard.html';
    else if (this.selectedRole === 'staff' && actualRole === 'staff') isValid = true, targetUrl = '/pages/staff-dashboard.html';
    else if (this.selectedRole === 'staff' && actualRole === 'pending') isValid = true, targetUrl = '/pages/pending-approval.html';
    else if (this.selectedRole === 'patient' && actualRole === 'patient') isValid = true, targetUrl = '/pages/dashboard.html', await this.ensurePatientRecord();
    else if (this.selectedRole === 'patient' && ['admin','staff','pending'].includes(actualRole)) isValid = true, targetUrl = '/pages/dashboard.html';

    if (isValid) {
      localStorage.setItem('userRole', this.selectedRole);
      window.location.href = targetUrl;
    } else {
      document.getElementById('errorMsg').innerHTML = `❌ Access Denied: You are not authorized as "${this.selectedRole}".`;
      setTimeout(() => window.location.href = '/pages/index.html', 3000);
    }
  }

  async ensurePatientRecord() {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.user.id;
    const { data: patient } = await supabase.from('Patients').select('*').eq('id', userId).single();
    if (!patient) {
      await supabase.from('Patients').insert([{
        id: userId, email: session.user.email, role: 'patient',
        full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
        created_at: new Date().toISOString()
      }]);
    }
  }
}