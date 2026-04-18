import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../backend/supabase/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const setAuthLoading = (isLoading) => {
    setLoading(isLoading);
  };

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // Get user role from database
          const { data } = await supabase
            .from('users')
            .select('role, full_name, phone')
            .eq('id', session.user.id)
            .single();
          
          if (data) {
            setRole(data.role);
            setProfile(data);
          }
        }
      } catch (error) {
        console.error('Auth error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        
        const { data } = await supabase
          .from('users')
          .select('role, full_name, phone')
          .eq('id', session.user.id)
          .single();
        
        if (data) {
          setRole(data.role);
          setProfile(data);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    role,
    profile,
    loading,
    setRole,
    setProfile,
    setAuthLoading,
    isAdmin: role === 'admin',
    isStaff: role === 'staff',
    isPatient: role === 'patient',
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export default AuthContext;
