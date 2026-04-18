# 🏥 Clinic Management System

[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-purple.svg)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-teal.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-green.svg)](https://supabase.com/)

A complete clinic management system with role-based authentication (Admin, Staff, Patient) using React and Supabase.

## 📋 Table of Contents
- [Features](#-features)
- [User Roles](#-user-roles)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [Authentication Flow](#-authentication-flow)
- [Test Credentials](#-test-credentials)
- [Tech Stack](#-tech-stack)
- [Deployment](#-deployment)
- [Screenshots](#-screenshots)

## ✨ Features

### 🔐 Authentication
- Email/Password sign up and login
- Google OAuth integration
- Password reset functionality
- "Remember Me" option
- Session management

### 👥 Role-Based Access Control
- **Admin**: Full system control
- **Staff**: Appointment & queue management
- **Patient**: Self-service appointment booking

### 🛡️ Security
- Protected routes with role verification
- Row Level Security (RLS) in Supabase
- Environment variable protection
- Secure session handling

## 🎭 User Roles

| Role | Dashboard | Permissions | Default Route |
|------|-----------|-------------|---------------|
| 👑 **Admin** | `/admin` | Full system access, user management, analytics | `/admin` |
| 👩‍⚕️ **Staff** | `/staff` | Manage appointments, queue, patient check-in | `/staff` |
| 👤 **Patient** | `/patient` | Book/cancel appointments, view queue status | `/patient` |

## 📁 Project Structure:

clinic-management-system/
│
├── 📄 README.md
├── 📄 package.json
├── 📄 index.html
├── 📄 .env
├── 📄 .gitignore
├── ⚙️ vite.config.js
├── 🎨 tailwind.config.js
├── 🔧 postcss.config.js
│
├── 📁 public/
│   └── 🖼️ vite.svg
│
└── 📁 src/
    │
    ├── 📄 main.jsx
    ├── 📄 App.jsx
    ├── 🎨 index.css
    │
    ├── 📁 components/
    │   ├── 📄 LoginForm.jsx
    │   ├── 📄 SignUpForm.jsx
    │   ├── 📄 CompleteProfile.jsx
    │   ├── 📄 ProtectedRoute.jsx
    │   ├── 📄 FormInput.jsx
    │   └── 📄 AuthCallback.jsx
    │
    ├── 📁 context/
    │   └── 📄 AuthContext.jsx
    │
    └── 📁 backend/
        └── 📁 supabase/
            ├── 📄 supabaseClient.js
            └── 📄 authSupabase.js


### Detailed File Descriptions

| File | Purpose |
|------|---------|
| `LoginForm.jsx` | Handles user login with email/password and Google OAuth |
| `SignUpForm.jsx` | New user registration with validation |
| `CompleteProfile.jsx` | Collects additional user info after first login |
| `ProtectedRoute.jsx | Restricts access based on authentication and roles |
| `AuthContext.jsx` | Manages global auth state (user, role, loading) |
| `authSupabase.js` | All Supabase auth operations (signIn, signUp, Google, etc.) |

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Supabase account (free tier works)

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/clinic-management-system.git
cd clinic-management-system

# 2. Install dependencies
npm install

# 3. Create .env file (see Environment Variables section)
# 4. Start development server
npm run dev

# 5. Open your browser
open http://localhost:5173
