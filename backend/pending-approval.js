import { supabase } from './supabase.js';

let checkInterval;

async function checkAndRedirect() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        localStorage.removeItem('userRole');
        window.location.href = '/pages/index.html';
        return;
    }
    
    // Restore role
    localStorage.setItem('userRole', 'pending');
    
    document.getElementById('userEmail').textContent = session.user.email;
    
    // Get pending staff record
    const { data: pending } = await supabase
        .from('pending_staff')
        .select('*')
        .eq('email', session.user.email)
        .single();
    
    if (pending) {
        // Get clinic name
        const { data: clinic } = await supabase
            .from('Facilities')
            .select('Name')
            .eq('ClinicID', pending.clinicid)
            .single();
        
        if (clinic) {
            document.getElementById('clinicInfo').innerHTML = `🏥 Requested Clinic: ${clinic.Name}`;
        } else {
            document.getElementById('clinicInfo').innerHTML = `🏥 Clinic ID: ${pending.clinicid}`;
        }
    }
    
    // Check if user is now approved staff
    const { data: staff } = await supabase
        .from('staffs')
        .select('*')
        .eq('email', session.user.email)
        .single();
    
    if (staff) {
        clearInterval(checkInterval);
        localStorage.setItem('userRole', 'staff');
        window.location.href = '/pages/staff-dashboard.html';
    } else {
        document.getElementById('spinner').style.display = 'none';
    }
}

async function logout() {
    clearInterval(checkInterval);
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
}

// Start checking
checkAndRedirect();
checkInterval = setInterval(checkAndRedirect, 5000);

// Add logout button listener
document.getElementById('logoutBtn')?.addEventListener('click', logout);