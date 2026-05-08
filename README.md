# 🏥 Community Clinic System - Patient Portal

## User Story Implementation

### 1. Patient Views Detailed Clinic Information

**As a patient, I want to view detailed clinic information so that I can make informed decisions about where to seek care.**

#### Acceptance Criteria
- ✅ Patient can search for clinics by name
- ✅ Patient can filter clinics by province
- ✅ Patient can view clinic details including:
  - Facility name, type, and sector
  - Province and district location
  - Operating hours
  - Contact information (phone, email, address)
  - Average patient rating
  - Existing patient reviews

#### Implementation Details

**Database Tables Used:**
- `Facilities` - Stores clinic information
- `Operating_Hours` - Stores clinic operating hours
- `clinic_reviews` - Stores patient ratings and reviews

**Key Functions:**
```javascript
// Load all clinics with search and filter
async function loadClinics()

// Display detailed clinic information
async function viewClinicDetail(clinicId)

// Filter clinics by search term and province
function filterClinics()User Flow:

Patient clicks "Find Clinics" tab

System displays all clinics with search bar and province filter

Patient searches by clinic name or selects province

Patient clicks on a clinic card

System displays full clinic details including:

Location information

Operating hours (if available)

Contact information

Patient ratings and reviews

Screenshots:

text
[Clinic List View]
┌─────────────────────────────────────┐
│ 🔍 Search by clinic name...         │
├─────────────────────────────────────┤
│ 🌍 All Provinces (10 clinics) ▼     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🏥 Aberdeen Hospital            │ │
│ │ 📍 Eastern Cape | 🏥 Hospital   │ │
│ │ 🏢 public                       │ │
│ │ [View Details →]                │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
[Clinic Detail View]

text
┌─────────────────────────────────────┐
│ ← Back to Clinics                   │
│                                     │
│ 🏥 Aberdeen Hospital                │
│                                     │
│ 📍 Location                         │
│ • Type: District Hospital          │
│ • Sector: public                    │
│ • Province: Eastern Cape            │
│                                     │
│ 🕒 Operating Hours                  │
│ • Monday: 08:00 - 16:00            │
│ • Tuesday: 08:00 - 16:00           │
│                                     │
│ 📞 Contact Information              │
│ • Phone: 049 843 0012              │
│ • Email: info@aberdeenhospital.co.za│
│                                     │
│ ⭐ Patient Reviews                  │
│ • Average: 4.5/5 (12 reviews)      │
│                                     │
│ [📅 Book Appointment] [⭐ Write Review]│
└─────────────────────────────────────┘
2. Patient Views Booking History
As a patient, I want to view my booking history so that I can track my past and upcoming appointments.

Acceptance Criteria
✅ Patient can view all their appointments

✅ Appointments can be filtered by status (All/Upcoming/Completed/Cancelled)

✅ Each appointment shows:

Clinic name

Appointment date and time

Current status

Queue position (if applicable)

Wait time information

✅ Upcoming appointments have action buttons (Reschedule/Cancel)

✅ Completed appointments have option to write a review

Implementation Details
Database Tables Used:

Appointments - Stores patient appointment records

Facilities - Joins to get clinic names

Key Functions:

javascript
// Load patient's booking history
async function loadBookings()

// Display filtered appointments
function displayBookings()

// Filter appointments by status
function setBookingFilter(filter)

// Cancel an appointment
async function cancelAppointment(appointmentId)
User Flow:

Patient clicks "My Bookings" tab

System displays all appointments (requires login)

Patient can filter by: All, Upcoming, Completed, Cancelled

Each appointment card shows:

Clinic name and status badge

Date and time

Queue position (if in queue)

Action buttons based on status

Appointment Status Display:

text
┌─────────────────────────────────────────────────────────────┐
│ 🏥 Soweto Community Clinic              [📅 Scheduled]     │
│                                                             │
│ 📅 2026-05-15                                              │
│ ⏰ 09:30 AM                                                │
│ 🎫 Queue Position: 3                                       │
│ 📍 Gauteng                                                 │
│                                                             │
│ [Reschedule] [Cancel]                                      │
└─────────────────────────────────────────────────────────────┘
Status Color Coding:

Status	Badge Color	Actions Available
Scheduled / Waiting	🔵 Blue	Reschedule, Cancel
Completed	🟢 Green	Write Review, View Clinic
Cancelled	🔴 Red	None
No Show	🔴 Red	None
3. Patient Submits Clinic Review and Rating
As a patient, I want to submit a review and rating for a clinic I've visited so that I can share my experience with other patients.

Acceptance Criteria
✅ Patient can rate clinic from 1-5 stars

✅ Patient can write a text review (optional)

✅ Patient can only review clinics where they have completed an appointment

✅ Reviews are displayed on clinic detail page

✅ Average rating is calculated and displayed

✅ Patient can edit their existing review

✅ Review includes timestamp

Implementation Details
Database Table:

sql
CREATE TABLE clinic_reviews (
    id UUID PRIMARY KEY,
    clinic_id TEXT REFERENCES Facilities(ClinicID),
    patient_id UUID REFERENCES Patients(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(clinic_id, patient_id)  -- One review per patient per clinic
);
Key Functions:

javascript
// Open review modal
function openReviewModal(clinicId, clinicName)

// Submit or update review
async function submitReview()

// Display reviews on clinic page
// (handled in viewClinicDetail)
Rating System UI:

text
┌─────────────────────────────────────┐
│ ⭐ Rate this Clinic                 │
│                                     │
│ Aberdeen Hospital                   │
│                                     │
│     ★ ★ ★ ☆ ☆                       │
│   (Click stars to rate)             │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Share your experience at this   │ │
│ │ clinic...                       │ │
│ └─────────────────────────────────┘ │
│                                     │
│         [Submit Review]             │
└─────────────────────────────────────┘
User Flow:

Patient views a clinic they've visited

Patient clicks "Write a Review" button

Modal opens with star rating selector

Patient clicks stars to select rating (1-5)

Patient optionally writes a comment

System validates patient has completed an appointment

Patient submits review

System saves to database

Clinic page refreshes showing new average rating

Patient can edit review later (Update instead of Insert)

Validation Rules:

✅ Rating is required (must select 1-5 stars)

✅ Patient must be logged in

✅ Patient must have completed at least one appointment at the clinic

✅ One review per patient per clinic (upsert)

Database Schema Overview
Key Tables Used
sql
-- Facilities table (from SA health dataset)
Facilities (
    ClinicID TEXT PRIMARY KEY,
    Name TEXT,
    Type TEXT,
    Sector TEXT,
    Province TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    ...
)

-- Appointments table
Appointments (
    id UUID PRIMARY KEY,
    PatientID UUID REFERENCES Patients(id),
    ClinicID TEXT REFERENCES Facilities(ClinicID),
    appointment_date DATE,
    appointment_time TIME,
    status TEXT,
    queue_position INTEGER,
    ...
)

-- Clinic Reviews table
clinic_reviews (
    id UUID PRIMARY KEY,
    clinic_id TEXT REFERENCES Facilities(ClinicID),
    patient_id UUID REFERENCES Patients(id),
    rating INTEGER,
    comment TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
Setup Instructions
Prerequisites
Supabase Account - Create a free account at supabase.com

VS Code with Live Server - For local development

South African Health Facility Dataset - For populating clinics

Installation Steps
Clone or create project folder

bash
mkdir clinic-system
cd clinic-system
Create index.html and paste the complete code

Setup Supabase Database

Create a new Supabase project

Run the schema SQL (provided in project brief)

Import Clinic Data

Source dataset from National Health facility register

Import into Facilities table

Configure Authentication

Enable Email/Password auth in Supabase

Create test patient accounts

Run the Application

bash
# Using VS Code Live Server
Right-click index.html → Open with Live Server
Testing the User Stories
Test Scenario 1: View Clinic Details
gherkin
Given I am a registered patient
When I open the clinic system
And I click on "Find Clinics"
Then I should see a list of all clinics
When I search for "Aberdeen"
Then I should see only Aberdeen Hospital
When I click on the clinic card
Then I should see detailed information including:
  - Location, operating hours, contact info
  - Patient ratings and reviews
Test Scenario 2: View Booking History
gherkin
Given I am a logged-in patient
And I have existing appointments
When I click on "My Bookings"
Then I should see all my appointments
When I click "Upcoming" filter
Then I should see only future appointments
When I click "Cancel" on an upcoming appointment
Then the appointment status changes to "Cancelled"
Test Scenario 3: Submit Clinic Review
gherkin
Given I have completed an appointment at a clinic
When I view that clinic's details
And I click "Write a Review"
Then a rating modal should appear
When I select 5 stars and write a comment
And I click "Submit Review"
Then my review should appear on the clinic page
And the average rating should update
Known Issues & Solutions
Issue	Solution
Contact information not showing	Add phone/email columns to Facilities table
User cannot submit review	Ensure user is logged in and has completed appointment
Clinics not loading	Check Facilities table exists and has data
Edit button not visible	Make sure user role is 'admin' in users table
Future Enhancements
Real-time queue position updates using Supabase Realtime

SMS/Email notifications for appointment reminders

Admin dashboard with analytics charts

PDF/CSV export for analytics reports

ML model for wait time prediction (bonus feature)

Technologies Used
Frontend: HTML5, CSS3, JavaScript (ES6+)

Backend: Supabase (PostgreSQL)

Authentication: Supabase Auth

Database: PostgreSQL (via Supabase)

Deployment: GitHub Pages / Netlify (recommended)

Contributors
COMS3009A Student Project

License
This project is for academic purposes as part of the COMS3009A curriculum.

text

This README is specifically tailored to the three user stories you've implemented. Would you like me to add anything else or adjust any section?


[Clinic List View]
┌─────────────────────────────────────┐
│ 🔍 Search by clinic name...         │
├─────────────────────────────────────┤
│ 🌍 All Provinces (10 clinics) ▼     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🏥 Aberdeen Hospital            │ │
│ │ 📍 Eastern Cape | 🏥 Hospital   │ │
│ │ 🏢 public                       │ │
│ │ [View Details →]                │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ← Back to Clinics                   │
│                                     │
│ 🏥 Aberdeen Hospital                │
│                                     │
│ 📍 Location                         │
│ • Type: District Hospital          │
│ • Sector: public                    │
│ • Province: Eastern Cape            │
│                                     │
│ 🕒 Operating Hours                  │
│ • Monday: 08:00 - 16:00            │
│ • Tuesday: 08:00 - 16:00           │
│                                     │
│ 📞 Contact Information              │
│ • Phone: 049 843 0012              │
│ • Email: info@aberdeenhospital.co.za│
│                                     │
│ ⭐ Patient Reviews                  │
│ • Average: 4.5/5 (12 reviews)      │
│                                     │
│ [📅 Book Appointment] [⭐ Write Review]│
└─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🏥 Soweto Community Clinic              [📅 Scheduled]     │
│                                                             │
│ 📅 2026-05-15                                              │
│ ⏰ 09:30 AM                                                │
│ 🎫 Queue Position: 3                                       │
│ 📍 Gauteng                                                 │
│                                                             │
│ [Reschedule] [Cancel]                                      │
└─────────────────────────────────────────────────────────────┘
