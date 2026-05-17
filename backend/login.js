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
    this.registerReceptionistBtn = document.getElementById('registerReceptionistBtn');

    this.formTitle = document.getElementById('formTitle');
    this.messageArticle = document.getElementById('message');

    this.staffDialog = document.getElementById('staffModal');
    this.closeModal = document.getElementById('closeModal');
    this.submitStaffReg = document.getElementById('submitStaffReg');

    this.attachEventListeners();
    this.setupClinicSearch();
    this.setupPhoneInput();
    this.checkSession();
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
    this.actionBtn.disabled = loading;
    this.googleBtn.disabled = loading;

    if (loading) {
      this.actionBtn.innerHTML = '<span class="spinner"></span>Processing...';
    } else {
      this.actionBtn.innerHTML = this.isLogin ? 'Login' : 'Sign Up';
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

    if (cleaned.startsWith('27')) {
      cleaned = '0' + cleaned.substring(2);
    }

    if (cleaned.length >= 10) {
      return cleaned.substring(0, 3) + ' ' + cleaned.substring(3, 6) + ' ' + cleaned.substring(6, 10);
    }

    if (cleaned.length >= 6) {
      return cleaned.substring(0, 3) + ' ' + cleaned.substring(3, 6) + (cleaned.length > 6 ? ' ' + cleaned.substring(6) : '');
    }

    if (cleaned.length >= 3) {
      return cleaned.substring(0, 3) + (cleaned.length > 3 ? ' ' + cleaned.substring(3) : '');
    }

    return cleaned;
  }

setupClinicSearch() {
  const clinicInput = document.getElementById('regClinicName');
  const suggestionsSection = document.getElementById('clinicSuggestions');
  const clinicError = document.getElementById('clinicError');

  if (!clinicInput || !suggestionsSection) return;

  let searchTimeout;

  clinicInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);

    const searchTerm = e.target.value.trim();

    clinicInput.removeAttribute('data-selected-id');
    clinicInput.removeAttribute('data-selected-name');

    if (clinicError) clinicError.style.display = 'none';

    if (searchTerm.length < 2) {
      suggestionsSection.style.display = 'none';
      suggestionsSection.innerHTML = '';
      return;
    }

    searchTimeout = setTimeout(async () => {
      const { data, error } = await supabase
        .from('Facilities')
        .select('ClinicID, Name, Province')
        .ilike('Name', `%${searchTerm}%`)
        .limit(10);

      if (error) {
        console.error('Clinic search error:', error);
        return;
      }

      if (!data || data.length === 0) {
        suggestionsSection.innerHTML = `
          <section style="padding:10px;color:#999;">
            No clinics found
          </section>
        `;
        suggestionsSection.style.display = 'block';
        return;
      }

      suggestionsSection.innerHTML = '';

      data.forEach((clinic) => {
        const item = document.createElement('section');
        item.className = 'suggestion-item';

        item.innerHTML = `
          <strong>${this.escapeHtml(clinic.Name)}</strong>
          <small class="suggestion-clinic-id">ID: ${this.escapeHtml(clinic.ClinicID)}</small>
          ${clinic.Province ? `<br><small>${this.escapeHtml(clinic.Province)}</small>` : ''}
        `;

        item.addEventListener('mousedown', (event) => {
          event.preventDefault();

          clinicInput.value = clinic.Name;
          clinicInput.setAttribute('data-selected-id', clinic.ClinicID);
          clinicInput.setAttribute('data-selected-name', clinic.Name);

          suggestionsSection.style.display = 'none';
          suggestionsSection.innerHTML = '';

          if (clinicError) clinicError.style.display = 'none';

          console.log('Selected clinic:', {
            clinicId: clinic.ClinicID,
            clinicName: clinic.Name
          });
        });

        suggestionsSection.appendChild(item);
      });

      suggestionsSection.style.display = 'block';
    }, 300);
  });

  clinicInput.addEventListener('blur', () => {
    setTimeout(() => {
      suggestionsSection.style.display = 'none';
    }, 250);
  });
}

  setupPhoneInput() {
    const phoneInput = document.getElementById('regPhone');
    const phoneError = document.getElementById('phoneError');

    if (!phoneInput) return;

    phoneInput.addEventListener('input', (e) => {
      const rawValue = e.target.value.replace(/\D/g, '');

      phoneInput.value = this.formatPhoneNumber(rawValue.slice(0, 10));

      if (rawValue.length === 10 && this.isValidPhoneNumber(phoneInput.value)) {
        phoneError.style.display = 'none';
        phoneInput.style.borderColor = '#00e5a0';
      } else if (rawValue.length > 0) {
        phoneError.textContent = rawValue.length === 10
          ? 'Please enter a valid South African phone number'
          : 'Phone number must be 10 digits';

        phoneError.style.display = 'block';
        phoneInput.style.borderColor = '#c33';
      } else {
        phoneError.style.display = 'none';
        phoneInput.style.borderColor = '';
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, (m) => {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

openRegistrationModal(type) {
  this.staffDialog.setAttribute('data-register-type', type);

  document.getElementById('regEmail').value = '';
  document.getElementById('regName').value = '';
  document.getElementById('regPhone').value = '';

  const clinicInput = document.getElementById('regClinicName');
  clinicInput.value = '';
  clinicInput.removeAttribute('data-selected-id');
  clinicInput.removeAttribute('data-selected-name');

  document.getElementById('regMessage').innerHTML = '';

  const modalTitle = document.querySelector('.modal-title');
  const modalBody = document.querySelector('.modal-body');
  const occupationSelect = document.getElementById('regOccupation');

  if (type === 'staff') {
    modalTitle.textContent = 'Staff Registration';

    modalBody.textContent =
      'Register as staff. You will be able to log in once an admin approves your account.';

    occupationSelect.innerHTML = `
      <option value="Doctor">Doctor</option>
      <option value="Nurse">Nurse</option>
      <option value="Pharmacist">Pharmacist</option>
      <option value="Administrator">Administrator</option>
    `;

    occupationSelect.disabled = false;
  } else {
    modalTitle.textContent = 'Receptionist Registration';

    modalBody.textContent =
      'Register as a receptionist. You will be able to log in with Google after registration.';

    occupationSelect.innerHTML = `
      <option value="Receptionist">Receptionist</option>
    `;

    occupationSelect.value = 'Receptionist';
    occupationSelect.disabled = true;
  }

  this.staffDialog.showModal();
}

  async submitStaffRegistration() {
    const registerType = this.staffDialog.getAttribute('data-register-type');

    const email = document.getElementById('regEmail').value.trim();
    const fullName = document.getElementById('regName').value.trim();
    const occupation = document.getElementById('regOccupation').value;
    const phone = document.getElementById('regPhone').value.trim();

    const clinicInput = document.getElementById('regClinicName');
    const clinicName = clinicInput.value.trim();
    const clinicId = clinicInput.getAttribute('data-selected-id');

    const regMessage = document.getElementById('regMessage');
    const cleanedPhone = phone.replace(/\D/g, '');

    if (!email || !fullName) {
      regMessage.innerHTML = '<strong style="color:#c33;">Please fill in email and full name</strong>';
      return;
    }

    if (!email.includes('@')) {
      regMessage.innerHTML = '<strong style="color:#c33;">Please enter a valid email address</strong>';
      return;
    }

    if (cleanedPhone.length !== 10 || !this.isValidPhoneNumber(phone)) {
      regMessage.innerHTML = '<strong style="color:#c33;">Please enter a valid South African phone number</strong>';
      return;
    }

    if (!clinicName || !clinicId) {
      regMessage.innerHTML = '<strong style="color:#c33;">Please select a clinic from the list</strong>';
      return;
    }

    regMessage.innerHTML = '<strong style="color:#069;">Registering...</strong>';

    if (registerType === 'receptionist') {

      const { error } = await supabase.from('Receptionist').insert([{
        receptionist_id: crypto.randomUUID(),
        clinicid: clinicId,
        clinicname: clinicName,
        email: email,
        contacts: cleanedPhone
      }]);

      if (error) {
        regMessage.innerHTML = `<strong style="color:#c33;">Error: ${error.message}</strong>`;
      } else {

        regMessage.innerHTML = `
          <strong style="color:#3c3;">
            ✅ Receptionist registered successfully!
          </strong>
        `;

        setTimeout(() => {

          this.staffDialog.close();

          document.getElementById('regEmail').value = '';
          document.getElementById('regName').value = '';
          document.getElementById('regPhone').value = '';
          document.getElementById('regClinicName').value = '';

          document
            .getElementById('regClinicName')
            .removeAttribute('data-selected-id');

          regMessage.innerHTML = '';

        }, 1500);
      }

      return;
    }

    const { error } = await supabase.from('pending_staff').insert([{
      email: email,
      full_name: fullName,
      occupation: occupation,
      phone_number: cleanedPhone,
      clinicid: clinicId,
      status: 'pending'
    }]);

    if (error) {
      regMessage.innerHTML = `<strong style="color:#c33;">Error: ${error.message}</strong>`;
    } else {
      regMessage.innerHTML = '<strong style="color:#3c3;">✅ Staff registration complete! Please login with Google after approval.</strong>';
    }
  }

  async handleEmailAuth() {
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;

    if (!email || !password) return this.showMessage('Please fill in all fields', 'error');

    this.setLoading(true);

    try {
      if (this.isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        window.location.href = '/pages/redirect.html';
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        this.showMessage('Account created. Please login.', 'success');
        this.toggleMode();
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
        options: {
          redirectTo: `${window.location.origin}/pages/redirect.html?role=${selectedRole}`
        }
      });

      if (error) throw error;
    } catch (err) {
      this.showMessage(err.message, 'error');
      this.setLoading(false);
    }
  }

  toggleMode() {
    this.isLogin = !this.isLogin;

    this.formTitle.textContent = this.isLogin ? 'Login' : 'Sign Up';
    this.actionBtn.innerHTML = this.isLogin ? 'Login' : 'Sign Up';
    this.toggleBtn.textContent = this.isLogin ? 'Create new account' : 'Back to Login';

    this.registerStaffBtn.style.display = this.isLogin ? 'block' : 'none';
    this.registerReceptionistBtn.style.display = this.isLogin ? 'block' : 'none';

    this.messageArticle.style.display = 'none';
  }

  async checkSession() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      window.location.href = '/pages/redirect.html';
    }
  }

  attachEventListeners() {
    this.actionBtn.addEventListener('click', () => this.handleEmailAuth());
    this.googleBtn.addEventListener('click', () => this.handleGoogleLogin());
    this.toggleBtn.addEventListener('click', () => this.toggleMode());

    this.registerStaffBtn?.addEventListener('click', () => {
      //alert("staff registration button clicked");
      this.openRegistrationModal('staff');
    });

    this.registerReceptionistBtn?.addEventListener('click', () => {
      //alert("receptionist registration button clicked");
      this.openRegistrationModal('receptionist');
    });

    this.closeModal?.addEventListener('click', () => {
      this.staffDialog.close();
    });

    this.submitStaffReg?.addEventListener('click', (e) => {
      e.preventDefault();
      this.submitStaffRegistration();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new LoginController();
});