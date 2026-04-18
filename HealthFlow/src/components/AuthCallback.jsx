import { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleOAuthCallback, getUserRole } from '../backend/supabase/authSupabase';
import { ClipLoader } from 'react-spinners';
import AuthContext from '../context/AuthContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setRole, setLoading } = useContext(AuthContext);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setLoading(true);
        const { session } = await handleOAuthCallback();
        
        if (session?.user) {
          const role = await getUserRole(session.user.id);
          setRole(role);
          
          // Redirect based on role
          if (role === 'admin') {
            navigate('/admin');
          } else if (role === 'staff') {
            navigate('/staff');
          } else {
            navigate('/patient');
          }
        } else {
          navigate('/login');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [navigate, setRole, setLoading]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <ClipLoader color="#3B82F6" size={50} />
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
