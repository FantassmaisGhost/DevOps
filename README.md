🏥 HealthFind SA
South African Community Clinic Directory
HealthFind SA is a comprehensive, web-based directory designed to improve healthcare accessibility. It provides citizens with a modern interface to locate community clinics, check live facility statuses, and manage patient bookings.

💎 Core Features
Vision: To bridge the gap between community health centers and the patients who need them through real-time data and transparent feedback.

🔍 Smart Discovery – Search across 3,000+ facilities by name, city, or province.

📡 Live Verification – Integration with Google Places to provide live "Open/Closed" indicators and verified operating hours.

📅 Patient Portal – Centralized management for appointment lifecycles (Scheduled, Completed, or Cancelled).

⭐ Transparency – A star-based review system allowing patients to share experiences and rate facility performance.

📝 Data Integrity – Administrative tools to update clinic contact information and service offerings on the fly.

🛠 Tech Stack
Layer	Technology	Implementation
Frontend	HTML5 / CSS3	Modern "Bento-grid" inspired responsive UI
Database	Supabase v2	PostgreSQL backend for real-time data synchronization
Maps & Places	Google API	Geo-location, contact verification, and live hours
Typography	Inter	High-legibility sans-serif font family
📂 System Architecture
The application is architected as a single-page application (SPA) to ensure zero-latency transitions between views:

Search Hero: A high-impact search interface with debounced input and category filters.

Clinic Grid: A responsive card-based layout using CSS Grid for multi-device compatibility.

Detail Bento: A segmented information display that breaks down facility data into logical tiles (Hours, Contact, Reviews).

Booking Engine: A specialized state-management system to handle appointment statuses.

🚀 Getting Started
1. Requirements
A modern web browser (Chrome, Firefox, Safari, or Edge).

An active internet connection for Supabase/Google API connectivity.

2. Configuration
Open the HTML file and ensure your API keys are correctly set in the <script> section:

JavaScript
const MY_SUPABASE_URL = 'YOUR_SUPABASE_URL';
const MY_SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
const GOOGLE_API_KEY = 'YOUR_GOOGLE_MAPS_KEY';
3. Usage
Simply launch the .html file. Navigate between Find Clinics and My Bookings using the sticky header navigation bar.

🎨 Design System
The UI adheres to a strict "Clean Medical" design language:

Primary Action: Blue 600 (#2563eb)

Surface: Grey 50 (#f9fafb)

Success State: Green 600 (#16a34a)

Error State: Red 600 (#dc2626)

Borders: Subtle Grey 200 (#e5e7eb)

Created for the Community Health Advancement Project.
