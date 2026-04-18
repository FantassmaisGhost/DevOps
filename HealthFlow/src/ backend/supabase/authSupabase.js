import { supabase } from './supabaseClient';

export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return { user: data.user, success: true };
  } catch (error) {
    throw error;
  }
};

export const signUp = async (email, password, userData) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userData.fullName,
          role: 'patient'
        }
      }
    });
    if (error) throw error;
    return { user: data.user, success: true };
  } catch (error) {
    throw error;
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    throw error;
  }
};
