import { supabase } from './supabase.js';

const userEmailEl = document.getElementById('userEmail');
const clinicNameEl = document.getElementById('clinicName');
const logoutBtn = document.getElementById('logoutBtn');

async function loadReceptionistDashboard() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/pages/index.html';
    return;
  }

  const email = session.user.email;

  userEmailEl.textContent = email;

  const { data: receptionist, error } = await supabase
    .from('Receptionist')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error || !receptionist) {
    localStorage.removeItem('userRole');
    window.location.href = '/pages/index.html';
    return;
  }

  localStorage.setItem('userRole', 'receptionist');
  localStorage.setItem('clinicid', receptionist.clinicid);
  localStorage.setItem('clinicname', receptionist.clinicname);

  clinicNameEl.textContent = `Working at ${receptionist.clinicname || 'your clinic'}`;
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  localStorage.clear();
  window.location.href = '/pages/index.html';
});

loadReceptionistDashboard();