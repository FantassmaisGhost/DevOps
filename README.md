# 🏥 Clinic Queue Management System

A web-based appointment and queue management system for community clinics in South Africa. This system allows patients to check their queue position in real-time, and enables clinic staff to manage patient flow efficiently.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Contributors](#contributors)
- [License](#license)

## ✨ Features

### For Patients
- ✅ View real-time queue position
- ✅ See estimated wait time
- ✅ Receive turn notifications
- ✅ Request SMS reminders

### For Staff
- ✅ View and manage waiting queue
- ✅ Start/Complete consultations
- ✅ Cancel appointments
- ✅ Multi-clinic support with clinic selector
- ✅ Date picker to view past/future appointments

### For Admins
- ✅ Manage clinic operating hours
- ✅ Assign staff to clinics
- ✅ View analytics reports
- ✅ Export data to CSV/PDF

### Real-time Features
- 🔔 WebSocket real-time updates
- 📊 Average wait time analytics
- 📈 No-show rate tracking
- 📱 SMS notifications (Twilio integration)

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 | Frontend framework |
| Supabase | Backend & Database |
| Socket.IO | Real-time WebSocket updates |
| Node.js + Express | API server |
| PostgreSQL | Database |

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Supabase account

### Clone the repository
```bash
git clone https://github.com/FantassmaisGhost/DevOps.git
cd DevOps
git checkout Queue
