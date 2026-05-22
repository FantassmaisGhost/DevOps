# HealthFlow
[![codecov](https://codecov.io/gh/FantassmaisGhost/DevOps/branch/main/graph/badge.svg)](https://codecov.io/gh/FantassmaisGhost/DevOps)

> A POPIA-compliant public health clinic management system for South Africa. HealthFlow connects patients, clinical staff, receptionists, and administrators on a single platform — covering appointment booking, queue management, facility discovery, and patient profile management.

---
## ADMIN CREDENTIALS TO USE FOR MARKING (Login with Google)
- Gmail account : n64520746@gmail.com
- Gmail account password : AdminTest123

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Running Locally](#running-locally)
- [CI/CD & Deployment](#cicd--deployment)
- [User Roles](#user-roles)
- [Pages Reference](#pages-reference)
- [Backend Reference](#backend-reference)
- [Edge Functions](#edge-functions)
- [Database Schema](#database-schema)
- [File Placement Instructions](#file-placement-instructions)

---

## Overview

HealthFlow is a web-based clinic management system built for South African public health facilities. It provides role-based dashboards for patients, staff, receptionists, and administrators, with real-time queue management, appointment booking, email notifications, and a searchable facility directory backed by Google Places.

**Live URL:** https://healthflow-b8hsefc2asehbagm.southafricanorth-01.azurewebsites.net/

---

## Features

### Patient
- Register and log in via email/password or OAuth
- Search and filter public health facilities by name and province
- View live facility details (contact info, hours, Google Maps) via Google Places API
- Book appointments with available staff at a chosen clinic
- View appointment history with status tracking (scheduled, completed, cancelled)
- Submit patient reviews for facilities (rate limited: 1 per day, 3 per week; offensive content filtered)
- Manage a POPIA-compliant medical profile including next of kin, clinical data, and medical aid
- SA ID number validation using the Luhn algorithm with automatic DOB and gender extraction
- Receive in-app and email notifications about appointments

### Receptionist
- View and manage the live queue for their assigned clinic
- Add walk-in patients to the queue
- Update patient queue status (waiting, called, in consultation, completed)
- Manage appointment schedules and cancellations
- View all appointments for the clinic filtered by date and status

### Staff (Doctors / Clinical Staff)
- View their personal appointment schedule
- Mark unavailability periods to block bookings
- Write and view clinical patient notes per appointment
- Update appointment statuses

### Admin
- Manage all facilities and their details
- Approve or reject pending staff and receptionist registration requests
- Manage operating hours per facility
- View system-wide analytics

### System
- Real-time queue management with priority levels (urgent, high, normal)
- Automated email reminders via Brevo (Sendinblue) through Supabase Edge Functions
- Automated appointment reminder scheduling
- Daily analytics aggregation per clinic
- Notification system (in-app + email + channel-based)
- Full CI/CD pipeline with GitHub Actions to Azure App Service
- Test coverage reporting via Codecov (50% minimum threshold enforced)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML, CSS, JavaScript (no framework) |
| Styling | Tailwind CSS (patient profile), custom CSS (shared.css, styles.css) |
| Backend | Node.js (v18+), plain HTTP server (server.js) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + OAuth) |
| Email | Brevo (Sendinblue) via Supabase Edge Functions |
| Maps | Google Places API (New) |
| Hosting | Azure App Service (South Africa North region) |
| CI/CD | GitHub Actions |
| Testing | Jest + jsdom, Babel |
| Coverage | Codecov |

---

## Project Structure

```
DevOps/
├── backend/                    # All JavaScript controllers and services
│   ├── supabase.js             # Supabase client (shared)
│   ├── AuthService.js          # Authentication (login, OAuth, signup, signout)
│   ├── BookingController.js    # Appointment booking flow (staff, slots, calendar)
│   ├── LoginController.js      # Login page logic
│   ├── RedirectController.js   # Role-based post-login redirect
│   ├── PatientDashboardController.js
│   ├── AdminDashboardController.js
│   ├── StaffDashboradController.js
│   ├── AdminFacilitiesController.js
│   ├── AdminHoursController.js
│   ├── DirectoryController.js  # Facility directory
│   ├── TableAdminController.js
│   ├── PendingApprovalController.js
│   ├── NotificationServices.js # Email + in-app notifications
│   ├── notificationService.js
│   ├── clinic_app.js           # Clinic finder + reviews
│   ├── booking.js
│   ├── dashboard.js
│   ├── admin-dashboard.js
│   ├── receptionist-dashboard.js
│   ├── receptionist-appointments.js
│   ├── staff-dashboard.js
│   ├── staff-unavailability.js
│   ├── queue.js                # Live queue management (QueueStore)
│   ├── adminq.js               # Admin queue view
│   ├── pending-approval.js
│   ├── tableAdmin.js
│   ├── login.js
│   ├── redirect.js
│   ├── nav.js
│   ├── utils.js / Util.js
│   ├── Admin.js
│   ├── SeeFacilities.js
│   ├── display.js
│   ├── facilities.js
│   ├── directory.js
│   └── edgeFunctions/
│       ├── sendEmailBrevo.ts   # Brevo email edge function
│       └── sendReminders.ts    # Appointment reminder scheduler
│
├── pages/                      # All HTML pages
├── styles/                     # Global and component CSS files
├── __tests__/                  # Jest test suites
├── .github/workflows/          # CI/CD GitHub Actions
│   ├── ci.yml                  # Run tests on every push/PR
│   ├── main_meddev.yml         # Deploy to Azure on push to main
│   └── release.yml             # Versioned releases via npm version tags
├── server.js                   # Custom Node.js HTTP file server
├── supabase.js                 # Root-level Supabase client
├── package.json
├── babel.config.js
├── iisnode.yml                 # Azure IIS Node configuration
└── web.config                  # Azure web server configuration
```

---

## Running Locally

**Prerequisites**
- [Node.js](https://nodejs.org) version 18 or higher

**Steps**

1. Clone the repo
   ```
   git clone <repo-url>
   cd DevOps
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the server
   ```
   npm start
   ```
   Then open your browser at `http://localhost:<Port number written on terminal>`.

4. Run the tests
   ```
   npm test
   ```
   This runs all tests and generates a coverage report in the `coverage/` folder.

**Things to know**
- Supabase credentials are already in the source files — no `.env` setup needed.
- The Google Places integration requires a live internet connection.
- Pages like the dashboard, receptionist, and admin views require you to be logged in — you will be redirected otherwise.

---

## CI/CD & Deployment

HealthFlow uses three GitHub Actions workflows:

### ci.yml — Continuous Integration
Runs on every push to any branch and on pull requests to `main`. Executes the full Jest test suite on Node 20 and Node 22 in parallel. Coverage is uploaded to Codecov and saved as a downloadable artifact for 14 days. A minimum of 50% coverage across lines, functions, branches, and statements is enforced.

### main_meddev.yml — Continuous Deployment
Runs on untagged pushes to `main`. Builds the app, runs tests (deployment blocked if tests fail), and deploys to Azure App Service in the South Africa North region.

### release.yml — Versioned Releases
Triggered by a version tag (`v*.*.*`). Run one of these commands locally to create a release:

```bash
npm run release:patch   # 1.0.0 to 1.0.1
npm run release:minor   # 1.0.0 to 1.1.0
npm run release:major   # 1.0.0 to 2.0.0
```

This will:
1. Run the full test suite (release blocked if tests fail)
2. Build a production artifact
3. Create a GitHub Release with an auto-generated changelog
4. Attach a downloadable `.zip` to the release
5. Deploy to Azure App Service

**Deployment target:** `https://healthflow-b8hsefc2asehbagm.southafricanorth-01.azurewebsites.net/`

---

## User Roles

| Role | Entry Point | Access |
|------|-------------|--------|
| `patient` | `dashboard.html` | Booking, appointments, profile, clinic finder |
| `receptionist` | `receptionist-dashboard.html` | Queue management, appointment management |
| `staff` | `staff-dashboard.html` | Appointments, patient notes, unavailability |
| `admin` | `admin-dashboard.html` | Facilities, staff approvals, operating hours |

After login, users are automatically redirected to their role-specific dashboard via `RedirectController`.

---

## Pages Reference

| Page | Description |
|------|-------------|
| `index.html` | Login / entry point |
| `redirect.html` | Post-login role-based redirect |
| `dashboard.html` | Patient dashboard |
| `appointment_dash.html` | Patient appointment history |
| `booking.html` | Appointment booking flow |
| `map.html` | Clinic map and booking entry |
| `clinic_app.html` | Clinic finder and reviews |
| `patient_profile.html` | POPIA-compliant patient medical profile |
| `notifications.html` | Patient notifications |
| `receptionist-dashboard.html` | Receptionist home |
| `receptionist-appointments.html` | Receptionist appointment management |
| `staff-dashboard.html` | Staff appointment and notes view |
| `staff-unavailability.html` | Staff unavailability management |
| `admin-dashboard.html` | Admin home |
| `admin.html` | Admin facility and staff management |
| `pending-approval.html` | Staff/receptionist approval queue |
| `SeeFacilities.html` | Admin facility browser |
| `Changetime.html` | Admin operating hours editor |
| `directory.html` | Public facility directory |
| `display.html` | Facility detail display |

---

## Backend Reference

| File | Responsibility |
|------|----------------|
| `AuthService.js` | Login, OAuth, signup, signout |
| `BookingController.js` | Full booking flow: staff selection, calendar, slot availability |
| `NotificationServices.js` | Email via Brevo edge function + in-app DB notifications |
| `queue.js (QueueStore)` | Real-time queue state, priority ordering, status updates |
| `clinic_app.js` | Clinic search, Google Places integration, review submission |
| `RedirectController.js` | Reads user role and redirects post-login |
| `AdminHoursController.js` | CRUD for facility operating hours |
| `PendingApprovalController.js` | Approve/reject pending staff and receptionists |
| `staff-dashboard.js` | Staff appointments, patient notes, unavailability clash detection |
| `utils.js` | Shared utility functions (HTML escaping, formatting) |

---

## Edge Functions

Two Supabase Edge Functions handle email delivery. They live in `backend/edgeFunctions/` but must be deployed to Supabase manually:

**1. sendEmailBrevo.ts**

Rename to `index.ts` and deploy to:
```
supabase/functions/send-email-brevo/index.ts
```
Handles transactional emails (booking confirmations, cancellations) via the Brevo API.

**2. sendReminders.ts**

Rename to `index.ts` and deploy to:
```
supabase/functions/send-reminders/index.ts
```
Scheduled function that sends appointment reminder emails to patients.

> These are named `sendEmailBrevo.ts` and `sendReminders.ts` in the repo for GitHub distinguishing purposes 🙏🏽

---

## Database Schema

HealthFlow uses [Supabase](https://supabase.com) (PostgreSQL) as its backend database, hosted in the South Africa region. The schema is organised into five logical groups below.

---

### Users & Identity

These tables manage authentication, roles, and identity across the system.

#### `Patients`
Core patient identity table linked to `auth.users`.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key → `auth.users` |
| `role` | `user_role` | Required |
| `full_name` | `text` | Nullable |
| `contact` | `text` | Nullable |
| `email` | `text` | Nullable |
| `created_at` | `timestamptz` | Nullable |
| `updated_at` | `timestamptz` | Nullable |

#### `users`
General user table covering all roles (admin, staff, receptionist, patient).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `email` | `text` | Unique |
| `full_name` | `text` | Nullable |
| `role` | `text` | Nullable |
| `contact` | `text` | Nullable |
| `address` | `text` | Nullable |
| `alternate_contact` | `text` | Nullable |
| `allergies` | `text` | Nullable |
| `gender` | `text` | Nullable |
| `occupation` | `text` | Nullable |
| `created_at` | `timestamptz` | Nullable |
| `updated_at` | `timestamptz` | Nullable |

#### `profiles`
Lightweight role/email lookup table.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `email` | `text` | Nullable |
| `role` | `text` | Nullable |
| `created_at` | `timestamp` | Nullable |

#### `Admin`
Admin user records.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | Primary Key |
| `Full_name` | `text` | Nullable |
| `Email` | `text` | Nullable |
| `Contact` | `text` | Nullable |

#### `Staff`
Clinical and administrative staff linked to facilities.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | Primary Key |
| `full_name` | `text` | Nullable |
| `email` | `text` | Nullable |
| `Occupation` | `text` | Nullable |
| `contact` | `text` | Nullable |
| `ClinicID` | `text` | → `Facilities` |
| `status` | `text` | Nullable |
| `dept` | `text` | Nullable |
| `Room` | `text` | Nullable |

#### `Receptionist`
Receptionist accounts linked to a specific clinic.

| Column | Type | Constraints |
|--------|------|-------------|
| `receptionist_id` | `text` | Primary Key |
| `clinicid` | `text` | → `Facilities` |
| `clinicname` | `text` | Nullable |
| `email` | `text` | Nullable |
| `contacts` | `text` | Nullable |
| `full_name` | `text` | Nullable |
| `created_at` | `timestamptz` | |

---

### Facilities

#### `Facilities`
Directory of all public health facilities in South Africa.

| Column | Type | Constraints |
|--------|------|-------------|
| `ClinicID` | `text` | Primary Key |
| `Name` | `text` | Nullable |
| `Type` | `text` | Nullable |
| `Subtype` | `text` | Nullable |
| `Sector` | `text` | Nullable |
| `Province` | `text` | Nullable |
| `phone` | `text` | Nullable |
| `email` | `text` | Nullable |
| `address` | `text` | Nullable |
| `suburb` | `text` | Nullable |
| `city` | `text` | Nullable |
| `website` | `text` | Nullable |
| `updated_at` | `timestamp` | Nullable |

#### `Operating_Hours`
Per-facility operating hours by day of week.

| Column | Type | Constraints |
|--------|------|-------------|
| `operatingid` | `int4` | Primary Key |
| `clinicid` | `varchar` | → `Facilities` |
| `day` | `varchar` | Nullable |
| `opentime` | `time` | Nullable |
| `closingtime` | `time` | Nullable |
| `isopen` | `bool` | Nullable |

#### `clinic_reviews`
Patient-submitted ratings and reviews for facilities. Limited to 1 per day and 3 per week per user. Offensive content is filtered before submission.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `clinic_id` | `text` | → `Facilities` |
| `patient_id` | `uuid` | → `auth.users` |
| `rating` | `int4` | 1–5 required |
| `comment` | `text` | Nullable |
| `created_at` | `timestamptz` | Nullable |

---

### Appointments & Queue

#### `Appointments`
Full appointment lifecycle including scheduling, queue position, and consultation timestamps.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `PatientID` | `uuid` | → `Patients` |
| `ClinicID` | `text` | → `Facilities` |
| `StaffID` | `text` | → `Staff` |
| `patient_name` | `text` | Required |
| `patient_email` | `text` | Nullable |
| `appointment_date` | `date` | Nullable |
| `appointment_time` | `time` | Required |
| `reason` | `text` | Nullable |
| `status` | `text` | Nullable |
| `notes` | `text` | Nullable |
| `is_walk_in` | `bool` | Nullable |
| `no_show` | `bool` | Nullable |
| `queue_position` | `int4` | Nullable |
| `estimated_wait_seconds` | `int4` | Nullable |
| `actual_wait_seconds` | `int4` | Nullable |
| `arrived_at` | `timestamp` | Nullable |
| `called_at` | `timestamp` | Nullable |
| `consultation_started_at` | `timestamp` | Nullable |
| `consultation_ended_at` | `timestamp` | Nullable |
| `cancelled_at` | `timestamp` | Nullable |
| `no_show_at` | `timestamp` | Nullable |
| `reminder_sent` | `bool` | Nullable |
| `hour_reminder_sent` | `bool` | Nullable |

#### `Queue`
Simple queue state table for the QMS.

| Column | Type | Constraints |
|--------|------|-------------|
| `Patientid` | `uuid` | Primary Key |
| `Department` | `varchar` | Nullable |
| `Room` | `varchar` | Nullable |
| `Status` | `varchar` | Nullable |
| `created_at` | `timestamptz` | Required |

#### `clinic_queue`
Live queue entries per clinic with priority and wait time estimates.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `int8` | Primary Key |
| `ClinicID` | `text` | → `Facilities` |
| `patient_id` | `uuid` | → `Patients` |
| `appointment_id` | `uuid` | → `Appointments` |
| `patient_name` | `text` | Required |
| `status` | `text` | Nullable |
| `position` | `int4` | Nullable |
| `priority` | `text` | `urgent` / `high` / `normal` |
| `dept` | `text` | Nullable |
| `estimated_wait_minutes` | `int4` | Nullable |
| `called_at` | `timestamp` | Nullable |
| `completed_at` | `timestamp` | Nullable |
| `created_at` | `timestamptz` | Nullable |
| `updated_at` | `timestamptz` | Nullable |

#### `queue_positions`
Tracks current and historical queue positions per appointment.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `appointment_id` | `uuid` | → `Appointments` |
| `clinic_id` | `text` | → `Facilities` |
| `patient_id` | `uuid` | → `Patients` |
| `position` | `int4` | Required |
| `status` | `varchar` | Required |
| `estimated_wait_seconds` | `int4` | Nullable |
| `is_current` | `bool` | Nullable |
| `entered_queue_at` | `timestamp` | Nullable |
| `status_changed_at` | `timestamp` | Nullable |
| `last_updated` | `timestamp` | Nullable |
| `updated_by` | `text` | Nullable |

#### `queue_history`
Audit log of every queue status change.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `appointment_id` | `uuid` | → `Appointments` |
| `clinic_id` | `text` | → `Facilities` |
| `patient_id` | `uuid` | → `Patients` |
| `old_status` | `varchar` | Nullable |
| `new_status` | `varchar` | Nullable |
| `position_at_change` | `int4` | Nullable |
| `time_in_previous_status` | `int4` | Nullable |
| `changed_at` | `timestamp` | Nullable |
| `changed_by` | `text` | Nullable |

---

### Patient Medical Data

#### `patient_profiles`
Extended POPIA-compliant medical profile for each patient. One profile per user (`user_id` unique). SA ID numbers are validated using the Luhn algorithm. Updated automatically via a database trigger.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `user_id` | `uuid` | Unique → `auth.users` |
| `patient_id` | `uuid` | → `Patients` |
| `full_name` | `text` | Nullable |
| `date_of_birth` | `date` | Nullable |
| `gender` | `text` | Nullable |
| `id_number` | `text` | Nullable |
| `phone` | `text` | Nullable |
| `email` | `text` | Nullable |
| `address` | `text` | Nullable |
| `province` | `text` | Nullable |
| `occupation` | `text` | Nullable |
| `blood_type` | `text` | Nullable |
| `allergies` | `text` | Nullable |
| `medical_conditions` | `text` | Nullable |
| `current_medications` | `text` | Nullable |
| `next_of_kin_name` | `text` | Nullable |
| `next_of_kin_relationship` | `text` | Nullable |
| `next_of_kin_phone` | `text` | Nullable |
| `next_of_kin_email` | `text` | Nullable |
| `medical_aid_name` | `text` | Nullable |
| `medical_aid_number` | `text` | Nullable |
| `avatar_color` | `text` | Default `#2563eb` |
| `popia_consent` | `bool` | Nullable |
| `created_at` | `timestamptz` | Nullable |
| `updated_at` | `timestamptz` | Auto-updated via trigger |

#### `patient_notes`
Clinical notes written by staff during or after appointments.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `patient_id` | `uuid` | → `Patients` |
| `appointment_id` | `uuid` | → `Appointments` |
| `staff_id` | `text` | → `Staff` |
| `note` | `text` | Required |
| `created_at` | `timestamptz` | Nullable |

---

### Analytics & Notifications

#### `analytics_daily`
Aggregated daily statistics per clinic for reporting and dashboards.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `clinic_id` | `text` | → `Facilities` |
| `date` | `date` | Required |
| `hour_of_day` | `int4` | Nullable |
| `total_appointments` | `int4` | Nullable |
| `scheduled_appointments` | `int4` | Nullable |
| `walk_in_appointments` | `int4` | Nullable |
| `no_shows` | `int4` | Nullable |
| `cancellations` | `int4` | Nullable |
| `avg_wait_time_seconds` | `int4` | Nullable |
| `median_wait_time_seconds` | `int4` | Nullable |
| `max_wait_time_seconds` | `int4` | Nullable |
| `avg_consultation_time_seconds` | `int4` | Nullable |
| `total_patients_served` | `int4` | Nullable |
| `max_queue_length` | `int4` | Nullable |
| `avg_queue_length` | `numeric` | Nullable |
| `created_at` | `timestamp` | Nullable |
| `updated_at` | `timestamp` | Nullable |

#### `notifications`
In-app and channel notifications tied to appointments and users.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `user_id` | `uuid` | → `auth.users` |
| `appointment_id` | `uuid` | → `Appointments` |
| `message` | `text` | Required |
| `type` | `varchar` | Nullable |
| `channel` | `varchar` | Nullable |
| `is_read` | `bool` | Nullable |
| `sent_at` | `timestamp` | Nullable |
| `delivered_at` | `timestamp` | Nullable |
| `read_at` | `timestamp` | Nullable |
| `created_at` | `timestamptz` | Nullable |

---

### Pending Approvals

#### `pending_staff`
Staff registration requests awaiting admin approval.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `int4` | Primary Key |
| `email` | `text` | Unique |
| `full_name` | `text` | Nullable |
| `clinicid` | `text` | → `Facilities` |
| `occupation` | `text` | Nullable |
| `phone_number` | `text` | Nullable |
| `status` | `text` | Nullable |
| `created_at` | `timestamp` | Nullable |

#### `pending_receptionists`
Receptionist registration requests awaiting admin approval.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `int4` | Primary Key |
| `email` | `text` | Unique |
| `full_name` | `text` | Required |
| `clinicname` | `text` | Required |
| `clinicid` | `text` | → `Facilities` |
| `occupation` | `text` | Nullable |
| `phone_number` | `text` | Nullable |
| `status` | `text` | Nullable |
| `created_at` | `timestamp` | Nullable |

#### `staff_unavail`
Staff unavailability periods used to block appointment slots.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `int8` | Primary Key (Identity) |
| `Staff_id` | `text` | → `Staff` |
| `Date` | `date` | Nullable |
| `Start` | `time` | Nullable |
| `End` | `time` | Nullable |

---

> All tables are hosted on Supabase (PostgreSQL) in the South Africa region. Medical data in `patient_profiles` and `patient_notes` is processed in accordance with the **Protection of Personal Information Act (POPIA)**.

---

## File Placement Instructions

**1. sendEmailBrevo.ts**

Please change the file name to **index.ts** and add it to the edge functions in supabase.

This is the path so you know where to put this edge function:
`supabase/functions/send-email-brevo/index.ts`

---

**2. sendReminders.ts**

Please change the file name to **index.ts** and add it to the edge functions in supabase.

This is the path so you know where to put this edge function:
`supabase/functions/send-reminders/index.ts`

> i just named them as sendEmailBrevo.ts and sendReminders.ts for GitHub distinguishing purposes 🙏🏽

## Edge Function Secrets

The required API keys and secrets have been documented separately for security purposes.

### Where to find the keys

Please refer to the **`supabase-secret-keys.txt`** file in the documentation folder for the following credentials:

| Secret Name | Used By |
|-------------|---------|
| `BREVO_API_KEY` | `send-email-brevo` and `send-reminders` edge functions |
| `CRON_SECRET` | `send-reminders` edge function (authentication for cron-job.org) |

### How to add the secrets

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Select the function (`send-email-brevo` or `send-reminders`)
3. Click the **Secrets** tab
4. Click **Add Secret**
5. Enter the name and value (copy from `supabase-secret-keys.txt`)
6. Click **Save**

### ⚠️ Important

- The `supabase-secret-keys.txt` file is **not committed to GitHub** for security reasons
- Contact the project maintainer if you need access to the keys file
- Never share these keys publicly or commit them to version control


<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/1e13ab1a-dce8-4751-8212-8e20fad03d42" />
