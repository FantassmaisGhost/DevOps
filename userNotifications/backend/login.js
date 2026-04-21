/*import supabase from "./supabase.js";

const form = document.getElementById("loginForm");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      alert("Please enter both email and password");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        console.error("Login error:", error.message);
        alert("Login failed: " + error.message);
        return;
      }

      // Login successful
      const user = data.user;
      console.log("Logged in user:", user.id);

      // Get user role from users table
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching role:", profileError);
        // Default to patient if role not found
        window.location.href = "booking.html";
        return;
      }

      // Redirect based on role
      if (profile.role === "patient") {
        window.location.href = "booking.html";
      } else if (profile.role === "staff") {
        window.location.href = "dashboardStaff.html";
      } else if (profile.role === "admin") {
        window.location.href = "dashboardAdmin.html";
      } else {
        window.location.href = "patient_dashboard.html";
      }
      
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("An unexpected error occurred");
    }
  });
}
*/

import supabase from "./supabase.js";

// Get DOM elements
const actionBtn = document.getElementById("actionBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const messageDiv = document.getElementById("message");
const toggleBtn = document.getElementById("toggleBtn");
const formTitle = document.getElementById("formTitle");
const registerStaffBtn = document.getElementById("registerStaffBtn");

// State
let isLoginMode = true;

// Show message helper
function showMessage(text, type = "error") {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = "block";
  
  setTimeout(() => {
    messageDiv.style.display = "none";
  }, 5000);
}

// Handle login
async function handleLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("Please enter both email and password", "error");
    return;
  }

  actionBtn.disabled = true;
  actionBtn.innerHTML = '<span class="spinner"></span> Logging in...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      showMessage("Login failed: " + error.message, "error");
      actionBtn.disabled = false;
      actionBtn.innerHTML = "Login";
      return;
    }

    // Login successful
    const user = data.user;
    console.log("Logged in user:", user.id);

    // Get user role from users table
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching role:", profileError);
      // Default redirect
      window.location.href = "map.html";
      return;
    }

    // Redirect based on role
    if (profile.role === "patient") {
      window.location.href = "map.html";
    } else if (profile.role === "staff") {
      window.location.href = "dashboardStaff.html";
    } else if (profile.role === "admin") {
      window.location.href = "dashboardAdmin.html";
    } else {
      window.location.href = "map.html";
    }
    
  } catch (error) {
    console.error("Unexpected error:", error);
    showMessage("An unexpected error occurred", "error");
    actionBtn.disabled = false;
    actionBtn.innerHTML = "Login";
  }
}

// Handle signup (registration)
async function handleSignup() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const selectedRole = document.querySelector('input[name="role"]:checked');

  if (!email || !password) {
    showMessage("Please enter both email and password", "error");
    return;
  }

  if (password.length < 6) {
    showMessage("Password must be at least 6 characters", "error");
    return;
  }

  actionBtn.disabled = true;
  actionBtn.innerHTML = '<span class="spinner"></span> Creating account...';

  try {
    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          role: selectedRole ? selectedRole.value : "patient"
        }
      }
    });

    if (error) {
      showMessage("Signup failed: " + error.message, "error");
      actionBtn.disabled = false;
      actionBtn.innerHTML = "Sign Up";
      return;
    }

    if (data.user) {
      // Create profile in users table
      const { error: insertError } = await supabase
        .from("users")
        .insert([{
          id: data.user.id,
          email: email,
          role: selectedRole ? selectedRole.value : "patient",
          created_at: new Date().toISOString()
        }]);

      if (insertError) {
        console.error("Error creating profile:", insertError);
      }

      showMessage("Account created successfully! Please check your email to confirm.", "success");
      
      // Switch back to login mode after 2 seconds
      setTimeout(() => {
        toggleMode();
      }, 2000);
    }
    
  } catch (error) {
    console.error("Unexpected error:", error);
    showMessage("An unexpected error occurred", "error");
  } finally {
    actionBtn.disabled = false;
    actionBtn.innerHTML = isLoginMode ? "Login" : "Sign Up";
  }
}

// Toggle between login and signup
function toggleMode() {
  isLoginMode = !isLoginMode;
  
  if (isLoginMode) {
    formTitle.textContent = "Login";
    actionBtn.innerHTML = "Login";
    toggleBtn.textContent = "Create new account";
    registerStaffBtn.style.display = "block";
    showMessage("", "");
  } else {
    formTitle.textContent = "Sign Up";
    actionBtn.innerHTML = "Sign Up";
    toggleBtn.textContent = "Back to Login";
    registerStaffBtn.style.display = "none";
    showMessage("", "");
  }
  
  // Clear form
  emailInput.value = "";
  passwordInput.value = "";
}

// Staff registration modal (if needed)
function openStaffModal() {
  alert("Staff registration requires admin approval. Please contact your clinic administrator.");
}

// Event listeners
actionBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (isLoginMode) {
    handleLogin();
  } else {
    handleSignup();
  }
});

toggleBtn.addEventListener("click", (e) => {
  e.preventDefault();
  toggleMode();
});

if (registerStaffBtn) {
  registerStaffBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openStaffModal();
  });
}

// Allow Enter key to submit
emailInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    actionBtn.click();
  }
});

passwordInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    actionBtn.click();
  }
});

console.log("Login.js loaded successfully");