# HealthFind SA — Community Clinic Directory

A single-page web application for finding and reviewing public health facilities across South Africa. Built with plain HTML, CSS, and JavaScript — no build tools or frameworks required.

---

## Overview

HealthFind SA allows patients and community members to search for clinics and hospitals by name or province, view live contact details and opening hours pulled from Google Places, read and submit patient reviews, and check their appointment history.

---

## Features

### Find Clinics
- Search across all registered public health facilities in South Africa
- Filter by province using a dropdown
- Results update in real time as you type
- Each card shows the facility type, province, district, and sector

### Clinic Detail Page
- Full facility information (type, subtype, sector, province, district)
- **Live contact details** fetched from Google Places — phone number, street address, website, and a direct Google Maps link
- **Live opening hours** from Google Places with a live Open Now / Closed indicator, and today's hours highlighted
- Falls back to Supabase database data if Google Places returns no result

### Reviews
- Combined patient reviews (stored in Supabase) and Google reviews in one tabbed section
- Displays Google's overall rating and review count
- Displays average patient rating across all submitted reviews
- Patients can submit a star rating (1–5) and written comment

### My Bookings
- View your full appointment history (requires login)
- Filter by All, Upcoming, Completed, or Cancelled
- Shows clinic name, date, time, province, and status badge

### Admin Mode
- Admin users see an "Edit Details" button on each clinic detail page
- Editable fields: phone, email, address, suburb, city, postal code, facility type
- Changes are saved directly to the Supabase `Facilities` table

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Auth | Supabase Auth |
| Live clinic data | Google Places API (New) |
| Font | Inter via Google Fonts |

---

## Database Tables

| Table | Purpose |
|---|---|
| `Facilities` | All clinic and hospital records |
| `Operating_Hours` | Fallback opening hours per clinic |
| `clinic_reviews` | Patient star ratings and comments |
| `Appointments` | Patient booking history |
| `users` | User profiles including `role` field for admin access |

---

## Configuration

All configuration lives at the top of the `<script>` block in `community-clinic-system.html`:

```js
const MY_SUPABASE_URL = 'your-supabase-project-url';
const MY_SUPABASE_KEY = 'your-supabase-anon-key';
const GOOGLE_API_KEY  = 'your-google-places-api-key';
```

### Getting a Google Places API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select a project
3. Navigate to **APIs & Services → Library** and enable **Places API (New)**
4. Go to **APIs & Services → Credentials → Create Credentials → API Key**
5. Restrict the key to your website domain for security

> The app uses the **Places API (New)** endpoints (`/v1/places:searchText` and `/v1/places/{id}`), not the legacy Places API.

### Setting Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Create the tables listed above with the appropriate columns
3. Enable Row Level Security (RLS) policies as needed
4. Copy your project URL and anon key into the config

---

## Running the App

No build step is needed. Simply open `community-clinic-system.html` in a browser, or serve it with any static file server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve .
```

Then open `http://localhost:8000/community-clinic-system.html`.

---

## Admin Access

To grant admin access to a user, set their `role` column to `'admin'` in the `users` table in Supabase. Admin users will see an **Edit Details** button on every clinic detail page.

---

## Google Places Data

Contact details and opening hours are fetched live from Google Places when a user opens a clinic's detail page. Results are cached in memory for the duration of the browser session to avoid redundant API calls.

If Google Places cannot find a match for a given clinic name and province, the app falls back to whatever contact data exists in the Supabase `Facilities` table, and falls back to the `Operating_Hours` table for hours.

---

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript to be enabled. Not compatible with Internet Explorer.

---

## Project Structure

```
community-clinic-system.html   # Entire application (single file)
README.md                      # This file
```

---

## License

This project is intended for community and public health use in South Africa. Please ensure compliance with POPIA (Protection of Personal Information Act) when collecting and storing patient review data.
