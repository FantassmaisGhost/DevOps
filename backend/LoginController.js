class LoginController {
  constructor() {
    this.isLogin = true;
    this.emailInput = document.getElementById('email');
    this.passwordInput = document.getElementById('password');
  }

  async handleEmailAuth() {
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;
    if (!email || !password) return this.showMessage('Please fill in all fields', 'error');
    if (password.length < 6) return this.showMessage('Password must be at least 6 characters', 'error');

    this.setLoading(true);
    try {
      if (this.isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.showMessage('Login successful! Redirecting...', 'success');
        setTimeout(() => window.location.href = '/pages/redirect.html', 1500);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
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
    const formTitle = document.getElementById('formTitle');
    const actionBtn = document.getElementById('actionBtn');
    const toggleBtn = document.getElementById('toggleBtn');
    const registerStaffBtn = document.getElementById('registerStaffBtn');
    if (this.isLogin) {
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
  }

  async checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const storedRole = localStorage.getItem('userRole');
      window.location.href = storedRole ? `/pages/redirect.html?role=${storedRole}` : '/pages/redirect.html';
    }
  }

  async submitStaffRegistration() {
    const email = document.getElementById('regEmail').value.trim();
    const fullName = document.getElementById('regName').value.trim();
    const occupation = document.getElementById('regOccupation').value;
    const phone = document.getElementById('regPhone').value.trim();
    const clinicInput = document.getElementById('regClinicName');
    const selectedClinicId = clinicInput.getAttribute('data-selected-id');

    if (!email || !fullName) return;
    const cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length !== 10 || !this.isValidPhoneNumber(phone)) return;
    if (!selectedClinicId) return;

    const { error } = await supabase.from('pending_staff').insert([{
      email, full_name: fullName, occupation, phone_number: cleanedPhone,
      clinicid: selectedClinicId, status: 'pending'
    }]);
    if (!error) {
      document.getElementById('regMessage').innerHTML = '<strong style="color: #3c3;">✅ Registration complete!</strong>';
      setTimeout(() => document.getElementById('staffModal').close(), 2000);
    }
  }

  setupClinicSearch() { /* … as in login.js: attaches input event to search Facilities table and show suggestions */ }
  setupPhoneInput() { /* … formats and validates SA phone numbers */ }
  isValidPhoneNumber(phone) { /* regex test */ }
  formatPhoneNumber(phone) { /* groups digits */ }
}