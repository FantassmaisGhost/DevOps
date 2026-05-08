import { supabase } from './supabase.js';

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        localStorage.removeItem('userRole');
        window.location.href = '/pages/index.html';
        return;
    }
    
    // Restore role
    localStorage.setItem('userRole', 'patient');
    
    const email = session.user.email;
    document.getElementById('userEmail').textContent = email;
    document.getElementById('welcomeMsg').textContent = `Welcome back, ${email.split('@')[0]}! 👋`;
}

async function logout() {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);
checkAuth();