// redirect.js
import { supabase } from './supabase.js';

const urlParams = new URLSearchParams(window.location.search);
const selectedRole = urlParams.get('role');

async function handleRedirect() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    localStorage.removeItem('userRole');
    window.location.href = '/pages/index.html';
    return;
  }

  const email = session.user.email;
  const userId = session.user.id;
  const userName = session.user.user_metadata?.full_name || email.split('@')[0];

  // Use maybeSingle() to avoid 406 on empty results
  const [{ data: admin }, { data: staff }, { data: pending }] = await Promise.all([
    supabase.from('Admin').select('*').eq('Email', email).maybeSingle(),
    supabase.from('Staff').select('*').eq('email', email).maybeSingle(),
    supabase.from('pending_staff').select('*').eq('email', email).maybeSingle()
  ]);

  const actualRole = admin ? 'admin' : staff ? 'staff' : pending ? 'pending' : 'patient';

  // If no role was selected, use actual role
  if (!selectedRole) {
    localStorage.setItem('userRole', actualRole);
    const target = actualRole === 'admin' ? '/pages/admin-dashboard.html'
                 : actualRole === 'staff' ? '/pages/staff-dashboard.html'
                 : actualRole === 'pending' ? '/pages/pending-approval.html'
                 : '/pages/dashboard.html';
    window.location.href = target;
    return;
  }

  // Ensure patient record exists if needed
  async function ensurePatientRecord() {
    const { data: patient } = await supabase.from('Patients').select('*').eq('id', userId).maybeSingle();
    if (!patient) {
      await supabase.from('Patients').insert([{
        id: userId, email, role: 'patient',
        full_name: userName, created_at: new Date().toISOString()
      }]);
    }
  }

  // If selected role is staff but user is not yet in Staff (only pending)
  if (selectedRole === 'staff' && actualRole === 'pending') {
    localStorage.setItem('userRole', 'pending');
    window.location.href = '/pages/pending-approval.html';
    return;
  }

  // If selected role matches actual role
  if (selectedRole === actualRole) {
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

  // If selected role is patient but user is admin/staff/pending – still allow patient dashboard
  if (selectedRole === 'patient' && (actualRole === 'admin' || actualRole === 'staff' || actualRole === 'pending')) {
    localStorage.setItem('userRole', 'patient');
    window.location.href = '/pages/dashboard.html';
    return;
  }

  // Fallback: role mismatch – show error and redirect to login
  document.getElementById('spinner')?.remove();
  const errorMsg = document.getElementById('errorMsg');
  if (errorMsg) errorMsg.innerHTML = `❌ Access Denied: You are not authorized as "${selectedRole}". Redirecting...`;
  setTimeout(() => {
    localStorage.removeItem('userRole');
    window.location.href = '/pages/index.html';
  }, 3000);
}

handleRedirect();