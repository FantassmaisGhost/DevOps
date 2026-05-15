HealthFind SA: Community Clinic Directory
HealthFind SA is a web-based platform designed to help South African citizens locate, review, and manage appointments at local community clinics. The application provides a modern, responsive interface for accessing healthcare facility information and patient services.

🚀 Features
1. Clinic Discovery
Search & Filter: Search for clinics by name or filter them by facility type (e.g., General, Specialized).

Clinic Cards: View high-level information at a glance, including clinic type, contact details, and public/private sector status.

Live Status: Integrated logic to show "Open" or "Closed" status pills based on current operating hours.

2. Patient Services
Booking Management: Dedicated "My Bookings" section to track scheduled, completed, and cancelled appointments with status badges.

Patient Reviews: A star-based rating system where users can submit reviews and read feedback from other patients.

Detailed Insights: View full clinic profiles, including comprehensive operating hours, service descriptions, and contact information.

3. Clinic Management
Information Editing: Built-in form functionality to update clinic details, such as addresses, phone numbers, and services.

🛠 Technical Stack
Frontend: HTML5, CSS3 (using CSS variables for theming), and Vanilla JavaScript.

Backend as a Service: Supabase (v2) for database management and real-time data fetching.

Typography: Inter via Google Fonts.

Icons: Inline SVGs and Lucide-inspired iconography.

⚙️ Configuration
The application is configured to connect to a Supabase backend:

Project URL: https://ixikhufrylaugpdxokwu.supabase.co.

Database Tables:

clinics: Stores primary facility data.

clinic_reviews: Stores user ratings and comments.

📂 File Structure
The project is contained within a single HTML file for ease of deployment, organized as follows:

<style>: Contains the design system, responsive grid layouts, and animation keyframes (e.g., loading spinners and pulse effects).

<body>: Contains the structural components:

header: Navigation and branding.

main#content: Dynamic container for switching between Clinic and Booking views.

modal-backdrop: The interface for submitting reviews.

<script>: Contains the application logic, including Supabase client initialization, data rendering functions, and view-switching logic.
