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


📊 Database Schema
Core Tables
Table	Purpose
Appointments	Stores all patient appointments and queue status
Facilities	Clinic information from SA health registry
Staff	Staff/Doctor information
Users	Authentication and user roles
Patients	Patient demographics
Status Values
waiting - Patient in queue

in_consultation - Currently being seen

complete - Consultation finished

cancelled - Appointment cancelled

scheduled - Future appointment

no_show - Patient didn't show up

📡 API Endpoints
Method	Endpoint	Description
GET	/api/health	Health check
GET	/api/reports/summary/:clinicId	Queue summary stats
GET	/api/reports/wait-times	Wait time analytics
POST	/api/send-reminder	Send SMS reminder


📝 License
This project is developed for academic purposes as part of the COMS3009A course.

🙏 Acknowledgments
South African National Department of Health for facility data

📸 Screenshots
Staff Dashboard
https://via.placeholder.com/800x400?text=Staff+Dashboard

Patient View
https://via.placeholder.com/800x400?text=Patient+Queue+View

Analytics Dashboard
https://via.placeholder.com/800x400?text=Analytics+Reports

🐛 Known Issues
Node modules cache files may trigger GitHub size warnings

Future date appointments are view-only (cannot start consultation)

🔮 Future Enhancements
Mobile app for patients

Email notifications

Integration with electronic health records

Machine learning for wait time prediction

Made with ❤️ for South African community clinics

text

