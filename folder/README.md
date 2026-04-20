# 🏥 Health-Flow | Clinic Appointment & Queue System

A comprehensive clinic management system with patient queue management, user authentication, and role-based dashboards.

## 📋 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Installation & Setup](#installation--setup)
- [Database Setup](#database-setup)
- [File Structure](#file-structure)
- [User Roles](#user-roles)
- [Pages & Functionality](#pages--functionality)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## 🎯 Overview

Health-Flow is a modern clinic queue management system that streamlines patient flow, reduces wait times, and provides real-time queue visibility. The system supports multiple user roles (patients, staff, admins) with tailored dashboards and functionality.

## ✨ Features

### Core Features
- 🔐 **Secure Authentication** - Email/Password + Google OAuth
- 📋 **Patient Queue Management** - Real-time queue status updates
- 👤 **User Profiles** - Complete patient information management
- 📊 **Real-time Analytics** - Live queue statistics and charts
- 🔄 **Role-based Access** - Different views for patients, staff, and admins
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

### Patient Features
- View personal profile information
- Edit profile details
- See queue position (coming soon)

### Staff Features
- View active patient queue
- Update patient status (waiting → in-progress → completed)
- Add new patients to queue
- View real-time queue analytics
- Edit patient profiles

### Admin Features
- Full system access
- User management
- Queue analytics dashboard
- System configuration (coming soon)

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Backend | Supabase (PostgreSQL + Auth) |
| Authentication | Supabase Auth (Email/Password + Google) |
| Database | PostgreSQL (via Supabase) |
| Charts | Chart.js |
| Icons | SVG inline |
| Deployment | Any static hosting (Vercel, Netlify, GitHub Pages) |

## 🏗 System Architecture


## 🔧 Installation & Setup

### Prerequisites
- A web browser (Chrome, Firefox, Safari, Edge)
- Supabase account (free tier works)
- Basic knowledge of HTML/CSS/JavaScript

### Step 1: Clone or Create Files

Create the following file structure:
health-flow/
├── index.html # Login page
├── onboarding.html # Profile completion page
├── patient.html # Patient dashboard
├── staff.html # Staff queue management
├── admin.html # Admin dashboard
├── auth-callback.html # OAuth callback handler
├── app.js # Shared utilities
└── README.md # This file


### Step 2: Supabase Setup

1. **Create a Supabase account** at [https://supabase.com](https://supabase.com)
2. **Create a new project**
3. **Get your credentials**:
   - Go to Project Settings → API
   - Copy `Project URL` and `anon public key`

4. **Update the credentials** in all HTML files and `app.js`:
   ```javascript
   const SUPABASE_URL = "your-project-url";
   const SUPABASE_KEY = "your-anon-key";
// Key functions:
- supabaseClient           // Supabase instance
- getCurrentUserRow()      // Fetch current user data
- needsOnboarding()        // Check if profile is complete
- routeUser()              // Redirect based on role
- protectPage(role)        // Role-based access control
- logout()                 // Sign out function
- pageForRole(role)        // Get dashboard URL
