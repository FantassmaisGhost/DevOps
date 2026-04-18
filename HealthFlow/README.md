# Clinic Management System

## Role-Based Authentication System

### Features:
- Login/Signup with Email/Password
- Google OAuth Authentication
- Role-based access (Admin, Staff, Patient)
- Protected routes for different roles

### Test Credentials:
- **Admin:** admin@clinic.com / Admin123!
- **Staff:** staff@clinic.com / Staff123!
- **Patient:** patient@clinic.com / Patient123!

### Setup Instructions:

1. Clone the repository
2. Run `npm install`
3. Create `.env` file with your Supabase credentials
4. Run `npm run dev`
5. Open http://localhost:5173

### Project Structure:
src/
├── components/
│ ├── LoginForm.jsx
│ ├── SignUpForm.jsx
│ ├── CompleteProfile.jsx
│ ├── ProtectedRoute.jsx
│ ├── FormInput.jsx
│ └── AuthCallback.jsx
├── context/
│ └── AuthContext.jsx
└── backend/
└── supabase/
├── supabaseClient.js
└── authSupabase.js


### Role-Based Access:
- **Admin:** Full system access (/admin)
- **Staff:** Manage appointments and queue (/staff)
- **Patient:** View and book appointments (/patient)

### Technologies:
- React 18
- Vite
- Tailwind CSS
- Supabase (Auth & Database)
- React Router DOM
