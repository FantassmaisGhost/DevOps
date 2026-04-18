import { supabase } from './supabaseClient';

// Sign Up with Email
export const signUp = async (email, password, userData) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userData.fullName,
          role: userData.role || 'patient',
          phone: userData.phone || ''
        }
      }
    });

    if (error) throw error;
    return { user: data.user, success: true };
  } catch (error) {
    console.error('Sign up error:', error.message);
    throw error;
  }
};

// Sign In with Email
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return { user: data.user, session: data.session, success: true };
  } catch (error) {
    console.error('Sign in error:', error.message);
    throw error;
  }
};

// Sign In with Google
export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) throw error;
    return { data, success: true };
  } catch (error) {
    console.error('Google sign in error:', error.message);
    throw error;
  }
};

// Handle OAuth Callback
export const handleOAuthCallback = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { session: data.session, success: true };
  } catch (error) {
    console.error('OAuth callback error:', error.message);
    throw error;
  }
};

// Get Current User
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Get user error:', error.message);
    return null;
  }
};

// Get User Role from Database
export const getUserRole = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.role || 'patient';
  } catch (error) {
    console.error('Get role error:', error.message);
    return 'patient';
  }
};

// Get Complete User Profile
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get profile error:', error.message);
    return null;
  }
};

// Update User Profile
export const updateUserProfile = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Update profile error:', error.message);
    throw error;
  }
};

// Complete Profile for New Users
export const completeProfile = async (userId, profileData) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: profileData.fullName,
        role: profileData.role,
        phone: profileData.phone,
        date_of_birth: profileData.dateOfBirth,
        address: profileData.address,
        emergency_contact: profileData.emergencyContact,
        updated_at: new Date()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Complete profile error:', error.message);
    throw error;
  }
};

// Sign Out
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error.message);
    throw error;
  }
};

// Reset Password
export const resetPassword = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Reset password error:', error.message);
    throw error;
  }
};

// Auth State Listener
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
};

// Get Session
export const getSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Get session error:', error.message);
    return null;
  }
};
