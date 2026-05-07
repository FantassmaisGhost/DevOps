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

// ========== PHONE VALIDATION FUNCTIONS ==========
function isValidPhoneNumber(phone) {
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    const mobileRegex = /^0[6-8][0-9]{8}$/;
    const landlineRegex = /^0[1-9][0-9]{7}$/;
    return mobileRegex.test(cleaned) || landlineRegex.test(cleaned);
}

function formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('27')) {
        cleaned = '0' + cleaned.substring(2);
    }
    if (cleaned.length >= 10) {
        return cleaned.substring(0, 3) + ' ' + cleaned.substring(3, 6) + ' ' + cleaned.substring(6, 10);
    } else if (cleaned.length >= 6) {
        return cleaned.substring(0, 3) + ' ' + cleaned.substring(3, 6) + (cleaned.length > 6 ? ' ' + cleaned.substring(6) : '');
    } else if (cleaned.length >= 3) {
        return cleaned.substring(0, 3) + (cleaned.length > 3 ? ' ' + cleaned.substring(3) : '');
    }
    return cleaned;
}

// ========== CLINIC SEARCH / AUTOCOMPLETE ==========
let searchTimeout;

function setupClinicSearch() {
    const clinicInput = document.getElementById('regClinicName');
    const suggestionsSection = document.getElementById('clinicSuggestions');
    const clinicError = document.getElementById('clinicError');
    
    if (!clinicInput) return;
    
    clinicInput.addEventListener('input', async (e) => {
        clearTimeout(searchTimeout);
        const searchTerm = e.target.value.trim();
        
        clinicInput.removeAttribute('data-selected-id');
        if (clinicError) clinicError.style.display = 'none';
        
        if (searchTerm.length < 2) {
            if (suggestionsSection) suggestionsSection.style.display = 'none';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            const { data, error } = await supabase
                .from('Facilities')
                .select('ClinicID, Name, Province')
                .ilike('Name', `%${searchTerm}%`)
                .limit(10);
            
            if (error) {
                console.error('Error searching clinics:', error);
                return;
            }
            
            if (suggestionsSection) {
                if (data && data.length > 0) {
                    suggestionsSection.innerHTML = data.map(c => `
                        <section class="suggestion-item" data-id="${c.ClinicID}" data-name="${c.Name.replace(/'/g, "\\'")}">
                            <strong>${escapeHtml(c.Name)}</strong>
                            <small class="suggestion-clinic-id">ID: ${c.ClinicID}</small>
                            ${c.Province ? `<br><small>${escapeHtml(c.Province)}</small>` : ''}
                        </section>
                    `).join('');
                    suggestionsSection.style.display = 'block';
                    
                    document.querySelectorAll('.suggestion-item').forEach(el => {
                        el.addEventListener('click', (event) => {
                            event.stopPropagation();  
                            event.preventDefault();   
                            const clinicId = el.getAttribute('data-id');
                            const clinicName = el.getAttribute('data-name');
                            clinicInput.value = clinicName;
                            clinicInput.setAttribute('data-selected-id', clinicId);
                            if (clinicError) clinicError.style.display = 'none';
                            if (suggestionsSection) suggestionsSection.style.display = 'none';
                        });
                    });
                } else {
                    suggestionsSection.innerHTML = '<section style="padding: 10px; color: #999;">No clinics found</section>';
                    suggestionsSection.style.display = 'block';
                }
            }
        }, 300);
    });
    
    clinicInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (suggestionsSection) suggestionsSection.style.display = 'none';
        }, 200);
    });
}

function setupPhoneInput() {
    const phoneInput = document.getElementById('regPhone');
    const phoneError = document.getElementById('phoneError');
    
    if (!phoneInput) return;
    
    phoneInput.addEventListener('input', (e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        
        if (rawValue.length > 10) {
            phoneInput.value = formatPhoneNumber(rawValue.slice(0, 10));
        } else {
            phoneInput.value = formatPhoneNumber(rawValue);
        }
        
        if (rawValue.length === 10) {
            if (isValidPhoneNumber(phoneInput.value)) {
                if (phoneError) phoneError.style.display = 'none';
                phoneInput.style.borderColor = '#00e5a0';
            } else {
                if (phoneError) {
                    phoneError.textContent = 'Please enter a valid South African phone number';
                    phoneError.style.display = 'block';
                }
                phoneInput.style.borderColor = '#c33';
            }
        } else if (rawValue.length > 0) {
            if (phoneError) {
                phoneError.textContent = 'Phone number must be 10 digits';
                phoneError.style.display = 'block';
            }
            phoneInput.style.borderColor = '#c33';
        } else {
            if (phoneError) phoneError.style.display = 'none';
            phoneInput.style.borderColor = '';
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== STAFF REGISTRATION ==========
async function submitStaffRegistration() {
    const email = document.getElementById('regEmail').value.trim();
    const fullName = document.getElementById('regName').value.trim();
    const occupation = document.getElementById('regOccupation').value;
    const phone = document.getElementById('regPhone').value.trim();
    const clinicInput = document.getElementById('regClinicName');
    const clinicName = clinicInput.value.trim();
    const selectedClinicId = clinicInput.getAttribute('data-selected-id');
    const regMessage = document.getElementById('regMessage');
    const phoneError = document.getElementById('phoneError');
    const clinicError = document.getElementById('clinicError');
    
    // Phone validation
    const cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length !== 10) {
        if (phoneError) {
            phoneError.textContent = 'Phone number must be 10 digits';
            phoneError.style.display = 'block';
        }
        return;
    }
    
    if (!isValidPhoneNumber(phone)) {
        if (phoneError) {
            phoneError.textContent = 'Please enter a valid South African phone number';
            phoneError.style.display = 'block';
        }
        return;
    }
    
    // Clinic validation
    if (!clinicName || !selectedClinicId) {
        if (clinicError) clinicError.style.display = 'block';
        return;
    }
    
    if (!email || !fullName) {
        regMessage.innerHTML = '<strong style="color: #c33;">Please fill all required fields (Email, Name)</strong>';
        return;
    }
    
    if (!email.includes('@')) {
        regMessage.innerHTML = '<strong style="color: #c33;">Please enter a valid email address</strong>';
        return;
    }
    
    regMessage.innerHTML = '<strong style="color: #069;">Registering...</strong>';
    
    const clinicId = selectedClinicId;
    
    const { error } = await supabase
        .from('pending_staff')
        .insert([{
            email: email,
            full_name: fullName,
            occupation: occupation,
            phone_number: cleanedPhone,
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
            clinicInput.value = '';
            clinicInput.removeAttribute('data-selected-id');
            regMessage.innerHTML = '';
            if (phoneError) phoneError.style.display = 'none';
            if (clinicError) clinicError.style.display = 'none';
        }, 2000);
    }
}

// Modal controls
registerStaffBtn?.addEventListener('click', () => {
    document.getElementById('regEmail').value = '';
    document.getElementById('regName').value = '';
    document.getElementById('regPhone').value = '';
    const clinicInput = document.getElementById('regClinicName');
    if (clinicInput) {
        clinicInput.value = '';
        clinicInput.removeAttribute('data-selected-id');
    }
    const phoneError = document.getElementById('phoneError');
    const clinicError = document.getElementById('clinicError');
    if (phoneError) phoneError.style.display = 'none';
    if (clinicError) clinicError.style.display = 'none';
    const regMessage = document.getElementById('regMessage');
    if (regMessage) regMessage.innerHTML = '';
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

setupClinicSearch();
setupPhoneInput();
checkSession();