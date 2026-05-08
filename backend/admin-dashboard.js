import { supabase } from './supabase.js';

async function loadAdminDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        localStorage.removeItem('userRole');
        window.location.href = '/pages/index.html';
        return;
    }

    // Restore role
    localStorage.setItem('userRole', 'admin');

    const { data: admin } = await supabase
        .from('Admin')
        .select('*')
        .eq('Email', session.user.email)
        .single();

    if (!admin) {
        localStorage.removeItem('userRole');
        window.location.href = '/pages/index.html';
        return;
    }

    document.getElementById('userEmail').textContent = session.user.email;
}

async function logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);
loadAdminDashboard();