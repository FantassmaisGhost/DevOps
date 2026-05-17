// redirect.js
import { supabase } from './supabase.js';

// Helper to show status on the page
function showStatus(message, isError = false) {
  const statusDiv = document.getElementById('redirect-status') || (() => {
    const div = document.createElement('div');
    div.id = 'redirect-status';
    div.style.cssText = 'position:fixed; bottom:10px; left:10px; right:10px; background:#111; color:#0f0; padding:8px; font-size:12px; z-index:9999; border:1px solid #0f0; border-radius:4px;';
    document.body.appendChild(div);
    return div;
  })();
  statusDiv.textContent = message;
  statusDiv.style.color = isError ? '#ff6b6b' : '#0f0';
  console.log(message);
}

export class RedirectController {
  constructor() {
    this.selectedRole = new URLSearchParams(window.location.search).get('role');
    this.processed = false;
    showStatus(`RedirectController initialized. Role: ${this.selectedRole || 'none'}`);
  }

  

  async processSession(session) {
    if (this.processed) return;
    this.processed = true;
    showStatus(`Session received: ${session?.user?.email || 'no email'}`);

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

    showStatus(`Actual role: ${actualRole}`);

    const ensurePatientRecord = async () => {
      const { data: patient } = await supabase
        .from('Patients')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!patient) {
        await supabase.from('Patients').insert([{
          id: userId, email, role: 'patient', full_name: userName, created_at: new Date().toISOString()
        }]);
      }
    };

    if (!this.selectedRole) {
      localStorage.setItem('userRole', actualRole);
      if (actualRole === 'admin') window.location.href = '/pages/admin-dashboard.html';
      else if (actualRole === 'staff') window.location.href = '/pages/staff-dashboard.html';
      else if (actualRole === 'pending') window.location.href = '/pages/pending-approval.html';
      else { await ensurePatientRecord(); window.location.href = '/pages/dashboard.html'; }
      return;
    }

    // Handle new Google staff login
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
    if (this.selectedRole === 'admin' && actualRole === 'admin') isValid = true, targetUrl = '/pages/admin-dashboard.html';
    else if (this.selectedRole === 'staff' && actualRole === 'staff') isValid = true, targetUrl = '/pages/staff-dashboard.html';
    else if (this.selectedRole === 'staff' && actualRole === 'pending') isValid = true, targetUrl = '/pages/pending-approval.html';
    else if (this.selectedRole === 'patient' && actualRole === 'patient') isValid = true, targetUrl = '/pages/dashboard.html', await ensurePatientRecord();
    else if (this.selectedRole === 'patient' && (actualRole === 'admin' || actualRole === 'staff' || actualRole === 'pending')) isValid = true, targetUrl = '/pages/dashboard.html';

    if (isValid) {
      localStorage.setItem('userRole', this.selectedRole);
      showStatus(`Redirecting to ${targetUrl}`);
      window.location.href = targetUrl;
    } else {
      showStatus(`Role mismatch, falling back to patient dashboard`, true);
      localStorage.setItem('userRole', 'patient');
      window.location.href = '/pages/dashboard.html';
    }
  }

  async handleRedirect() {
    showStatus('handleRedirect started');

    // 1. Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (!session) {
          localStorage.removeItem('userRole');
          window.location.href = '/pages/index.html';
          return;
        }
        await this.processSession(session);
      }
    });

    // 2. Fallback: try getSession after 2 seconds
    setTimeout(async () => {
      if (this.processed) return;
      const { data: { session } } = await supabase.auth.getSession();
      showStatus(`Fallback getSession: ${!!session}`);
      if (session) {
        await this.processSession(session);
      } else {
        // 3. Ultimate fallback: check URL hash for access token (some hosts drop it)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        if (accessToken) {
          showStatus(`Found access_token in hash, attempting setSession`);
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: params.get('refresh_token')
          });
          if (!error && data.session) {
            await this.processSession(data.session);
            return;
          }
        }
        showStatus('No session found, redirecting to login', true);
        window.location.href = '/pages/index.html';
      }
    }, 2000);
  }
}

const controller = new RedirectController();
controller.handleRedirect();