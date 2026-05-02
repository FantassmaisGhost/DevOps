import { supabase } from './supabase.js';

let isLogin = true;

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const actionBtn = document.getElementById('actionBtn');
const googleBtn = document.getElementById('googleBtn');
const toggleBtn = document.getElementById('toggleBtn');
const registerStaffBtn = document.getElementById('registerStaffBtn');
const formTitle = document.getElementById('formTitle');
const messageArticle = document.getElementById('message');

// Modal elements
const staffDialog = document.getElementById('staffModal');
const closeModal = document.getElementById('closeModal');
const submitStaffReg = document.getElementById('submitStaffReg');

function showMessage(text, type) {
    messageArticle.textContent = text;
    messageArticle.className = `message ${type}`;
    setTimeout(() => {
        messageArticle.style.display = 'none';
    }, 5000);
}

function setLoading(loading) {
    if (loading) {
        actionBtn.disabled = true;
        actionBtn.innerHTML = '<span class="spinner"></span>Processing...';
        googleBtn.disabled = true;
    } else {
        actionBtn.disabled = false;
        actionBtn.innerHTML = isLogin ? 'Login' : 'Sign Up';
        googleBtn.disabled = false;
    }
}

// Staff Registration
async function submitStaffRegistration() {
    const email = document.getElementById('regEmail').value.trim();
    const fullName = document.getElementById('regName').value.trim();
    const occupation = document.getElementById('regOccupation').value;
    const phone = document.getElementById('regPhone').value.trim();
    const clinicName = document.getElementById('regClinicName').value.trim();
    const regMessage = document.getElementById('regMessage');
    
    if (!email || !fullName || !clinicName) {
        regMessage.innerHTML = '<strong style="color: #c33;">Please fill all required fields (Email, Name, Clinic Name)</strong>';
        return;
    }
    
    if (!email.includes('@')) {
        regMessage.innerHTML = '<strong style="color: #c33;">Please enter a valid email address</strong>';
        return;
    }
    
    regMessage.innerHTML = '<strong style="color: #069;">Registering...</strong>';
    
    const { data: facility, error: lookupError } = await supabase
        .from('Facilities')
        .select('ClinicID')
        .ilike('Name', clinicName)
        .single();
    
    if (lookupError || !facility) {
        regMessage.innerHTML = '<strong style="color: #c33;">Clinic not found. Please check the clinic name and try again.</strong>';
        return;
    }
    
    const clinicId = facility.ClinicID;
    
    const { error } = await supabase
        .from('pending_staff')
        .insert([{
            email: email,
            full_name: fullName,
             occupation: occupation,
            clinicid: clinicId,
            status: 'pending'
        }]);
    
    if (error) {
        if (error.code === '23505') {
            regMessage.innerHTML = '<strong style="color: #c33;">This email is already registered as pending staff</strong>';
        } else {
            regMessage.innerHTML = `<strong style="color: #c33;">Error: ${error.message}</strong>`;
        }
    } else {
        regMessage.innerHTML = '<strong style="color: #3c3;">✅ Registration complete! Please login with Google to continue.</strong>';
        setTimeout(() => {
            staffDialog.close();
            document.getElementById('regEmail').value = '';
            document.getElementById('regName').value = '';
            document.getElementById('regPhone').value = '';
            document.getElementById('regClinicName').value = '';
            regMessage.innerHTML = '';
        }, 2000);
    }
}

// Modal controls
registerStaffBtn?.addEventListener('click', () => {
    staffDialog.showModal();
});

closeModal?.addEventListener('click', () => {
    staffDialog.close();
});

submitStaffReg?.addEventListener('click', submitStaffRegistration);

window.addEventListener('click', (e) => {
    if (e.target === staffDialog) {
        staffDialog.close();
    }
});

async function handleEmailAuth() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }

    setLoading(true);

    try {
        if (isLogin) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                showMessage(error.message, 'error');
                setLoading(false);
                return;
            }

            showMessage('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = '/pages/redirect.html';
            }, 1500);
        } else {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password
            });

            if (error) {
                showMessage(error.message, 'error');
                setLoading(false);
                return;
            }

            showMessage('Account created! Please login.', 'success');
            setTimeout(() => {
                toggleMode();
                setLoading(false);
            }, 2000);
        }
    } catch (err) {
        showMessage('An error occurred. Please try again.', 'error');
        setLoading(false);
    }
}

async function handleGoogleLogin() {
    const selectedRole = document.querySelector('input[name="role"]:checked').value;
    
    setLoading(true);
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/pages/redirect.html?role=' + selectedRole
            }
        });
        if (error) throw error;
    } catch (err) {
        showMessage(err.message, 'error');
        setLoading(false);
    }
}

function toggleMode() {
    isLogin = !isLogin;
    if (isLogin) {
        formTitle.textContent = 'Login';
        actionBtn.innerHTML = 'Login';
        toggleBtn.textContent = 'Create new account';
        registerStaffBtn.style.display = 'block';
    } else {
        formTitle.textContent = 'Sign Up';
        actionBtn.innerHTML = 'Sign Up';
        toggleBtn.textContent = 'Back to Login';
        registerStaffBtn.style.display = 'none';
    }
    messageArticle.style.display = 'none';
}

async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const storedRole = localStorage.getItem('userRole');
        if (storedRole) {
            window.location.href = '/pages/redirect.html?role=' + storedRole;
        } else {
            window.location.href = '/pages/redirect.html';
        }
    }
}

actionBtn.addEventListener('click', handleEmailAuth);
googleBtn.addEventListener('click', handleGoogleLogin);
toggleBtn.addEventListener('click', toggleMode);

emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleEmailAuth();
});
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleEmailAuth();
});

checkSession();