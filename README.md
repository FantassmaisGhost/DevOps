HealthFlow Patient Dashboard
A comprehensive, HIPAA-ready patient health dashboard that allows patients to manage their medical profiles, including personal information, medical records, and next of kin details. Built with HTML, Tailwind CSS, and localStorage (with Supabase-ready schema).

📋 Table of Contents
Features

Database Schema

Installation & Setup

Usage Guide

Security Features

Technology Stack

Customization

Browser Support

License

✨ Features
Patient Dashboard
Avatar Display: Dynamic avatar with initials generated from patient's full name

Patient Summary Card: Quick view of key information (gender, occupation, blood type, next of kin)

Medical Snapshot: At-a-glance view of allergies, conditions, and current medications

Responsive Design: Works seamlessly on desktop, tablet, and mobile devices

Comprehensive Patient Form
Captures all essential patient information:

Personal Details: Full name, date of birth, gender, ID number, phone, email, address

Occupation: Professional information

Medical Records:

Blood type

Allergies

Medical conditions

Current medications

Next of Kin Details:

Full name

Relationship

Phone number

Email (optional)

Data Management
Persistent Storage: Uses localStorage for data persistence (demo mode)

Form Validation: Required field validation with user feedback

Demo Data Loader: Quick population of example data for testing

Real-time Updates: Dashboard updates immediately upon saving

🗄️ Database Schema
The dashboard is designed to work with Supabase and the following table structure:

sql
CREATE TABLE patient_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  id_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  occupation TEXT,
  blood_type TEXT,
  allergies TEXT,
  medical_conditions TEXT,
  current_medications TEXT,
  next_of_kin_name TEXT,
  next_of_kin_relationship TEXT,
  next_of_kin_phone TEXT,
  next_of_kin_email TEXT,
  avatar_color TEXT DEFAULT '#2563eb',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Row Level Security Policies
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
  ON patient_profiles FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own profile" 
  ON patient_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own profile" 
  ON patient_profiles FOR UPDATE USING (auth.uid() = user_id);
🚀 Installation & Setup
Option 1: Direct Browser Usage (Demo Mode)
Download the patient_dashboard.html file

Open it in any modern web browser

The dashboard works immediately with localStorage (no backend required)

Option 2: Supabase Integration (Production)
Create a Supabase project at supabase.com

Run the SQL schema above in your Supabase SQL editor

Update the Supabase configuration in the HTML file:

javascript
// Replace these lines in the script section:
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'your-anon-key';
Enable Authentication in Supabase (email/password or social logins)

Modify the save/load functions to use Supabase client instead of localStorage

Option 3: Local Server
For development with live reload:

bash
# Using Python
python -m http.server 8000

# Using Node.js (http-server)
npx http-server -p 8000
Then navigate to http://localhost:8000

📖 Usage Guide
First Time User
Open the dashboard

Complete all required fields in the patient form:

Full name, gender, phone, email

Occupation

Next of kin details (name, relationship, phone)

Click "Save Profile"

The dashboard sidebar will update with your information

Editing Existing Profile
Modify any fields in the form

Click "Save Profile" again

All information will be updated and persisted

Clearing the Form
Click "Clear / New" to reset the form

Note: This does NOT delete saved data until you save again

🔒 Security Features
Implemented Security Measures
Client-side validation: Prevents incomplete/incorrect data submission

Input sanitization: Basic XSS prevention

Required fields enforcement: Ensures critical data is captured

Supabase RLS Ready
When integrated with Supabase:

Row Level Security: Users can only access their own data

Authentication Required: Protected by Supabase Auth

Encrypted Data Transmission: HTTPS and Supabase encryption

Audit Logging: Automatic created_at and updated_at timestamps

🛠 Technology Stack
Frontend
HTML5: Semantic markup structure

Tailwind CSS: Utility-first styling (via CDN)

JavaScript (ES6+): Dynamic functionality and data management

Font Awesome 6: Icon library for visual enhancements

Backend/Storage Options
localStorage: Default demo storage

Supabase (optional): Production-ready backend with PostgreSQL

Row Level Security: Database-level access control

APIs & Libraries
Supabase JS SDK (v2): For backend integration

Google Fonts: Inter font family

Tailwind CDN: Rapid styling

🎨 Customization
Changing Color Scheme
Modify the Tailwind configuration or add custom CSS:

css
/* Change primary color from blue to custom */
.bg-blue-600 { background-color: #your-color; }
Adding New Form Fields
Add input HTML to the form section

Update getProfileFromForm() function

Update loadProfileToForm() function

Update localStorage/Supabase schema accordingly

Modifying Avatar Display
Adjust the avatar container in the HTML:

html
<div id="avatarContainer" class="...">
  <span id="avatarInitials">JD</span>
</div>
🌐 Browser Support
Browser	Version	Support
Chrome	90+	✅ Full
Firefox	88+	✅ Full
Safari	14+	✅ Full
Edge	90+	✅ Full
Opera	76+	✅ Full
Mobile Browsers	Latest	✅ Responsive
📁 File Structure
text
medflow-patient-dashboard/
│
├── patient_dashboard.html    # Main application file
├── README.md                  # Documentation
└── assets/                    # (Optional) Additional resources
    ├── css/
    └── js/
🔧 Troubleshooting
Common Issues
Q: Data disappears after browser restart?

A: localStorage persists until manually cleared. Check if you're in incognito/private mode.

Q: Form won't save?

A: Ensure all required fields are filled (name, gender, phone, email, occupation, next of kin details).

Q: Avatar shows wrong initials?

A: The avatar uses the first letter of first and last name. Update your full name field.

Q: How to migrate from localStorage to Supabase?

A: Replace the saveProfileToStorage() and loadStorageProfile() functions with Supabase insert/select queries using the provided RLS policies.

🚦 Demo Credentials
No authentication required for the localStorage demo. For Supabase integration, you'll need to implement your preferred auth method (email/password, OAuth, etc.).

📝 Future Enhancements
Medical document upload (prescriptions, lab results)

Appointment scheduling integration

Medication reminder system

Family sharing access

Export medical records (PDF)

Telemedicine link integration

Multi-language support

Dark mode toggle

📄 License
MIT License - Free for personal and commercial use.

