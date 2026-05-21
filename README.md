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
