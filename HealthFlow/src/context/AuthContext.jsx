import React, { createContext, useState, useEffect } from 'react';
import { 
  getCurrentUser, 
  getUserRole, 
  getUserProfile, 
  onAuthStateChange,
  getSession 
} from '../backend/supabase/authSupabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Initialize auth state
    const initAuth = async () => {
      try {
        setLoading(true);
        
        // Get current session
        const currentSession = await getSession();
        setSession(currentSession);
        
        if (currentSession?.user) {
          const currentUser = currentSession.user;
          setUser(currentUser);
          
          // Get user role and profile from database
          const userRole = await getUserRole(currentUser.id);
          const userProfile = await getUserProfile(currentUser.id);
          
          setRole(userRole);
          setProfile(userProfile);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = onAuthStateChange(async (event, newSession) => {
      console.log('Auth event:', event);
      setSession(newSession);
      
      if (event === 'SIGNED_IN' && newSession?.user) {
        setUser(newSession.user);
        const userRole = await getUserRole(newSession.user.id);
        const userProfile = await getUserProfile(newSession.user.id);
        setRole(userRole);
        setProfile(userProfile);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole(null);
        setProfile(null);
        setSession(null);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    role,
    profile,
    session,
    loading,
    setRole,
    setProfile,
    isAdmin: role === 'admin',
    isStaff: role === 'staff',
    isPatient: role === 'patient',
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
