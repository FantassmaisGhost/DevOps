// login.js
import { supabase } from './supabase.js';

export class LoginController {
  constructor() {
    this.isLogin = true;
    this.emailInput = document.getElementById('email');
    this.passwordInput = document.getElementById('password');
    this.actionBtn = document.getElementById('actionBtn');
    this.googleBtn = document.getElementById('googleBtn');
    this.toggleBtn = document.getElementById('toggleBtn');
    this.registerStaffBtn = document.getElementById('registerStaffBtn');
    this.formTitle = document.getElementById('formTitle');
    this.messageArticle = document.getElementById('message');
    this.staffDialog = document.getElementById('staffModal');
    this.closeModal = document.getElementById('closeModal');
    this.submitStaffReg = document.getElementById('submitStaffReg');
    
    this.attachEventListeners();
    this.setupClinicSearch();
    this.setupPhoneInput();
    //this.checkSession();
  }

  showMessage(text, type) {
    this.messageArticle.textContent = text;
    this.messageArticle.className = `message ${type}`;
    this.messageArticle.style.display = 'block';
    setTimeout(() => {
      this.messageArticle.style.display = 'none';
    }, 5000);
  }

  setLoading(loading) {
    if (loading) {
      this.actionBtn.disabled = true;
      this.actionBtn.innerHTML = '<span class="spinner"></span>Processing...';
      this.googleBtn.disabled = true;
    } else {
      this.actionBtn.disabled = false;
      this.actionBtn.innerHTML = this.isLogin ? 'Login' : 'Sign Up';
      this.googleBtn.disabled = false;
    }
  }

  isValidPhoneNumber(phone) {
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    const mobileRegex = /^0[6-8][0-9]{8}$/;
    const landlineRegex = /^0[1-9][0-9]{7}$/;
    return mobileRegex.test(cleaned) || landlineRegex.test(cleaned);
  }

  formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('27')) cleaned = '0' + cleaned.substring(2);
    if (cleaned.length >= 10) {
      return cleaned.substring(0, 3) + ' ' + cleaned.substring(3, 6) + ' ' + cleaned.substring(6, 10);
    } else if (cleaned.length >= 6) {
      return cleaned.substring(0, 3) + ' ' + cleaned.substring(3, 6) + (cleaned.length > 6 ? ' ' + cleaned.substring(6) : '');
    } else if (cleaned.length >= 3) {
      return cleaned.substring(0, 3) + (cleaned.length > 3 ? ' ' + cleaned.substring(3) : '');
    }
    return cleaned;
  }

  setupClinicSearch() {
    const clinicInput = document.getElementById('regClinicName');
    const suggestionsSection = document.getElementById('clinicSuggestions');
    const clinicError = document.getElementById('clinicError');
    if (!clinicInput) return;
    let searchTimeout;
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
        const { data, error } = await supabase.from('Facilities').select('ClinicID, Name, Province').ilike('Name', `%${searchTerm}%`).limit(10);
        if (error) return;
        if (suggestionsSection) {
          if (data && data.length > 0) {
            suggestionsSection.innerHTML = data.map(c => `
              <section class="suggestion-item" data-id="${c.ClinicID}" data-name="${c.Name.replace(/'/g, "\\'")}">
                <strong>${this.escapeHtml(c.Name)}</strong>
                <small class="suggestion-clinic-id">ID: ${c.ClinicID}</small>
                ${c.Province ? `<br><small>${this.escapeHtml(c.Province)}</small>` : ''}
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
      setTimeout(() => { if (suggestionsSection) suggestionsSection.style.display = 'none'; }, 200);
    });
  }

  setupPhoneInput() {
    const phoneInput = document.getElementById('regPhone');
    const phoneError = document.getElementById('phoneError');
    if (!phoneInput) return;
    phoneInput.addEventListener('input', (e) => {
      const rawValue = e.target.value.replace(/\D/g, '');
      if (rawValue.length > 10) {
        phoneInput.value = this.formatPhoneNumber(rawValue.slice(0, 10));
      } else {
        phoneInput.value = this.formatPhoneNumber(rawValue);
      }
      if (rawValue.length === 10) {
        if (this.isValidPhoneNumber(phoneInput.value)) {
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

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  async submitStaffRegistration() {
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

    const cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length !== 10) {
      if (phoneError) {
        phoneError.textContent = 'Phone number must be 10 digits';
        phoneError.style.display = 'block';
      }
      return;
    }
    if (!this.isValidPhoneNumber(phone)) {
      if (phoneError) {
        phoneError.textContent = 'Please enter a valid South African phone number';
        phoneError.style.display = 'block';
      }
      return;
    }
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
    const { error } = await supabase.from('pending_staff').insert([{
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
        this.staffDialog.close();
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

  async handleEmailAuth() {
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;
    if (!email || !password) return this.showMessage('Please fill in all fields', 'error');
    if (password.length < 6) return this.showMessage('Password must be at least 6 characters', 'error');
    this.setLoading(true);
    try {
      if (this.isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.showMessage('Login successful! Redirecting...', 'success');
        setTimeout(() => window.location.href = '/pages/redirect.html', 1500);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        this.showMessage('Account created! Please login.', 'success');
        setTimeout(() => this.toggleMode(), 2000);
      }
    } catch (err) {
      this.showMessage(err.message, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async handleGoogleLogin() {
    const selectedRole = document.querySelector('input[name="role"]:checked').value;
    this.setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/pages/redirect.html?role=' + selectedRole }
      });
      if (error) throw error;
    } catch (err) {
      this.showMessage(err.message, 'error');
      this.setLoading(false);
    }
  }

  toggleMode() {
    this.isLogin = !this.isLogin;
    if (this.isLogin) {
      this.formTitle.textContent = 'Login';
      this.actionBtn.innerHTML = 'Login';
      this.toggleBtn.textContent = 'Create new account';
      this.registerStaffBtn.style.display = 'block';
    } else {
      this.formTitle.textContent = 'Sign Up';
      this.actionBtn.innerHTML = 'Sign Up';
      this.toggleBtn.textContent = 'Back to Login';
      this.registerStaffBtn.style.display = 'none';
    }
    this.messageArticle.style.display = 'none';
  }

  async checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const storedRole = localStorage.getItem('userRole');
      if (storedRole) window.location.href = '/pages/redirect.html?role=' + storedRole;
      else window.location.href = '/pages/redirect.html';
    }
  }

  attachEventListeners() {
    this.actionBtn.addEventListener('click', () => this.handleEmailAuth());
    this.googleBtn.addEventListener('click', () => this.handleGoogleLogin());
    this.toggleBtn.addEventListener('click', () => this.toggleMode());
    this.emailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.handleEmailAuth(); });
    this.passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.handleEmailAuth(); });
    this.registerStaffBtn?.addEventListener('click', () => {
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
      this.staffDialog.showModal();
    });
    this.closeModal?.addEventListener('click', () => this.staffDialog.close());
    this.submitStaffReg?.addEventListener('click', () => this.submitStaffRegistration());
    window.addEventListener('click', (e) => { if (e.target === this.staffDialog) this.staffDialog.close(); });
  }
}

// Auto-instantiate on DOM load
document.addEventListener('DOMContentLoaded', () => {
  new LoginController();
});