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

    // Check what type of user this actually is
    const { data: admin } = await supabase
        .from('Admin')
        .select('*')
        .eq('Email', email)
        .single();

    const { data: staff } = await supabase
        .from('Staff')
        .select('*')
        .eq('email', email)
        .single();

    const { data: pending } = await supabase
        .from('pending_staff')
        .select('*')
        .eq('email', email)
        .single();

    // Determine actual user type
    let actualRole = 'patient';
    if (admin) actualRole = 'admin';
    else if (staff) actualRole = 'staff';
    else if (pending) actualRole = 'pending';

    // Helper: create patient record if it doesn't exist
    async function ensurePatientRecord() {
        const { data: patient } = await supabase
            .from('Patients')
            .select('*')
            .eq('id', userId)
            .single();

        if (!patient) {
            const { error: insertError } = await supabase
                .from('Patients')
                .insert([{
                    id: userId,
                    email: email,
                    role: 'patient',
                    full_name: userName,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);

            if (insertError) {
                console.error('Failed to create patient record:', insertError);
            }
        }
    }

    // If no role was selected (direct access), use actual role
    if (!selectedRole) {
        if (actualRole === 'admin') {
            localStorage.setItem('userRole', 'admin');
            window.location.href = '/pages/admin-dashboard.html';
        } else if (actualRole === 'staff') {
            localStorage.setItem('userRole', 'staff');
            window.location.href = '/pages/staff-dashboard.html';
        } else if (actualRole === 'pending') {
            localStorage.setItem('userRole', 'pending');
            window.location.href = '/pages/pending-approval.html';
        } else {
            await ensurePatientRecord();
            localStorage.setItem('userRole', 'patient');
            window.location.href = '/pages/dashboard.html';
        }
        return;
    }

    // Handle new Google staff user who selected 'staff' but isn't registered yet
    // They may have skipped the staff modal and gone straight to Google login
    if (selectedRole === 'staff' && actualRole === 'patient') {
        const { error: pendingInsertError } = await supabase
            .from('pending_staff')
            .insert([{
                email: email,
                full_name: userName,
                status: 'pending'
            }]);

        if (!pendingInsertError) {
            localStorage.setItem('userRole', 'pending');
            window.location.href = '/pages/pending-approval.html';
            return;
        } else if (pendingInsertError.code === '23505') {
            // Already exists as pending (race condition / duplicate login)
            localStorage.setItem('userRole', 'pending');
            window.location.href = '/pages/pending-approval.html';
            return;
        } else {
            console.error('Failed to create pending_staff record:', pendingInsertError);
        }
    }

    // VALIDATE: Check if selected role matches actual role
    let isValid = false;
    let targetUrl = '';

    if (selectedRole === 'admin' && actualRole === 'admin') {
        isValid = true;
        targetUrl = '/pages/admin-dashboard.html';
        localStorage.setItem('userRole', 'admin');
    } 
    else if (selectedRole === 'staff' && actualRole === 'staff') {
        isValid = true;
        targetUrl = '/pages/staff-dashboard.html';
        localStorage.setItem('userRole', 'staff');
    }
    else if (selectedRole === 'staff' && actualRole === 'pending') {
        isValid = true;
        targetUrl = '/pages/pending-approval.html';
        localStorage.setItem('userRole', 'pending');
    }
    else if (selectedRole === 'patient' && actualRole === 'patient') {
        isValid = true;
        targetUrl = '/pages/dashboard.html';
        localStorage.setItem('userRole', 'patient');
        await ensurePatientRecord();
    }
    else if (selectedRole === 'patient' && (actualRole === 'admin' || actualRole === 'staff' || actualRole === 'pending')) {
        // Staff/Admin can also access patient dashboard
        isValid = true;
        targetUrl = '/pages/dashboard.html';
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
            errorMsg.innerHTML = `❌ Access Denied: You are not authorized as "${selectedRole}".<br>Redirecting to login page...`;
        }
        
        setTimeout(() => {
            localStorage.removeItem('userRole');
            window.location.href = '/pages/index.html';
        }, 3000);
    }
}

handleRedirect();