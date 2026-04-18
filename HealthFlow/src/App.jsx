import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginForm from './components/LoginForm';
import SignUpForm from './components/SignUpForm';
import CompleteProfile from './components/CompleteProfile';
import AuthCallback from './components/AuthCallback';

// Dashboard Components (Placeholders - you can expand these)
const AdminDashboard = () => (
  <div className="min-h-screen bg-gray-100 p-8">
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Welcome Admin! You have full system access.</p>
        <div className="mt-4 p-4 bg-blue-50 rounded">
          <h2 className="font-semibold">Admin Capabilities:</h2>
          <ul className="list-disc list-inside mt-2 text-sm">
            <li>Manage all users (patients, staff, admins)</li>
            <li>View all appointments</li>
            <li>Generate reports</li>
            <li>Configure clinic settings</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

const StaffDashboard = () => (
  <div className="min-h-screen bg-gray-100 p-8">
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Staff Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Welcome Staff! Manage appointments and queue.</p>
        <div className="mt-4 p-4 bg-green-50 rounded">
          <h2 className="font-semibold">Staff Capabilities:</h2>
          <ul className="list-disc list-inside mt-2 text-sm">
            <li>Manage today's appointments</li>
            <li>Check-in patients</li>
            <li>Manage queue</li>
            <li>Book appointments for patients</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

const PatientDashboard = () => (
  <div className="min-h-screen bg-gray-100 p-8">
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Patient Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Welcome Patient! View and book appointments.</p>
        <div className="mt-4 p-4 bg-purple-50 rounded">
          <h2 className="font-semibold">Patient Capabilities:</h2>
          <ul className="list-disc list-inside mt-2 text-sm">
            <li>View upcoming appointments</li>
            <li>Book new appointments</li>
            <li>Check queue status</li>
            <li>View medical history</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignUpForm />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          {/* Protected Routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/staff" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <StaffDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/patient" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'patient']}>
              <PatientDashboard />
            </ProtectedRoute>
          } />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
