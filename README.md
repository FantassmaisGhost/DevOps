# HealthFlow
[![codecov](https://codecov.io/gh/FantassmaisGhost/DevOps/branch/main/graph/badge.svg)](https://codecov.io/gh/FantassmaisGhost/DevOps)

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
- Pages like the dashboard, receptionist, and admin views require you to be logged in — you'll be redirected otherwise.

---

**File Placement Instructions**

1) **sendEmailBrevo.ts**
   Please change the file name to **index.ts** and add it to the edge functions in supabase.
   
   This is the path so you know where to put this edge function:
   `supabase/functions/send-email-brevo/index.ts`

----------------------------------------------------------------------------------------------------------------------------------------

2) **sendReminders.ts**
   Please change the file name to **index.ts** and add it to the edge functions in supabase.
   
   This is the path so you know where to put this edge function:
   `supabase/functions/send-reminders/index.ts`

> i just named them as sendEmailBrevo.ts and sendReminders.ts for GitHub distinguishing purposes 🙏🏽

---
---

## Database Schema

HealthFlow uses [Supabase](https://supabase.com) (PostgreSQL) as its backend database. The schema is organised into five logical groups below.

---

### 👤 Users & Identity

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

### 🏥 Facilities

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
Patient-submitted ratings and reviews for facilities. Limited to 1 per day and 3 per week per user.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `clinic_id` | `text` | → `Facilities` |
| `patient_id` | `uuid` | → `auth.users` |
| `rating` | `int4` | 1–5 required |
| `comment` | `text` | Nullable |
| `created_at` | `timestamptz` | Nullable |

---

### 📅 Appointments & Queue

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
| `priority` | `text` | Nullable |
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

### 🩺 Patient Medical Data

#### `patient_profiles`
Extended POPIA-compliant medical profile for each patient. One profile per user (`user_id` unique).

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

### 📊 Analytics & Notifications

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

### ⏳ Pending Approvals

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
Staff unavailability periods for scheduling.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `int8` | Primary Key (Identity) |
| `Staff_id` | `text` | → `Staff` |
| `Date` | `date` | Nullable |
| `Start` | `time` | Nullable |
| `End` | `time` | Nullable |

---

> All tables are hosted on Supabase (PostgreSQL) with Row Level Security (RLS) enabled. Medical data in `patient_profiles` and `patient_notes` is processed in accordance with POPIA.
