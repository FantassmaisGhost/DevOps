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
    
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
        userEmailElement.textContent = session.user.email;
    }
    
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
        
        const clinicInfoElement = document.getElementById('clinicInfo');
        if (clinicInfoElement) {
            if (clinic) {
                clinicInfoElement.innerHTML = `🏥 Requested Clinic: ${clinic.Name}`;
            } else {
                clinicInfoElement.innerHTML = `🏥 Clinic ID: ${pending.clinicid}`;
            }
        }
    }
    
    // Check if user is now approved staff (using Staff table)
    const { data: staff } = await supabase
        .from('Staff')
        .select('*')
        .eq('email', session.user.email)
        .single();
    
    if (staff) {
        clearInterval(checkInterval);
        localStorage.setItem('userRole', 'staff');
        window.location.href = '/pages/staff-dashboard.html';
    } else {
        const spinnerElement = document.getElementById('spinner');
        if (spinnerElement) {
            spinnerElement.style.display = 'none';
        }
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
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}