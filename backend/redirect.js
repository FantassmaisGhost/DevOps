// redirect.js
import { supabase } from './supabase.js';

export class RedirectController {
  constructor() {
    this.selectedRole = new URLSearchParams(window.location.search).get('role');
    this.processed = false; // prevent double redirect
  }

  async processSession(session) {
    // ── TEMPORARY DEBUG ALERT ──────────────────────────────────
    alert('Session received: ' + JSON.stringify({
      email: session?.user?.email,
      id: session?.user?.id,
      expires_at: session?.expires_at
    }, null, 2));
    // ──────────────────────────────────────────────────────────

    if (this.processed) return;
    this.processed = true;

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

    console.log('Session user email:', email);
    console.log('Selected role:', this.selectedRole);
    console.log('Actual role:', actualRole);

    const ensurePatientRecord = async () => {
      const { data: patient } = await supabase
        .from('Patients')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!patient) {
        await supabase.from('Patients').insert([{
          id: userId,
          email,
          role: 'patient',
          full_name: userName,
          created_at: new Date().toISOString()
        }]);
      }
    };

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

    // Handle Google staff login (creates pending record if not found)
    if (this.selectedRole === 'staff' && actualRole === 'patient') {
      const { error: pendingInsertError } = await supabase.from('pending_staff').insert([{
        email,
        full_name: userName,
        status: 'pending'
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
    } else if (
      this.selectedRole === 'patient' &&
      (actualRole === 'admin' || actualRole === 'staff' || actualRole === 'pending')
    ) {
      isValid = true;
      targetUrl = '/pages/dashboard.html';
    }

    if (isValid) {
      localStorage.setItem('userRole', this.selectedRole);
      window.location.href = targetUrl;
    } else {
      console.warn('Role mismatch, falling back to patient dashboard');
      localStorage.setItem('userRole', 'patient');
      window.location.href = '/pages/dashboard.html';
    }
  }

  async handleRedirect() {
    // 1. Listen for auth state changes (normal OAuth flow)
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !this.processed) {
        await this.processSession(session);
      }
    });

    // 2. Fallback: try to get session after 2 seconds in case onAuthStateChange never fires
    setTimeout(async () => {
      if (this.processed) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await this.processSession(session);
      } else {
        console.warn('No session found after fallback, redirecting to login');
        window.location.href = '/pages/index.html';
      }
    }, 2000);
  }
}

// Run immediately
const controller = new RedirectController();
controller.handleRedirect();