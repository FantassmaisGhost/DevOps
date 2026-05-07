//BEFORE YOU DO ANYTHING...

//Please change the file name to index.ts and add it to the edge functions in supabase.

//I just named it as sendEmailBrevo.ts for github distinguishing purposes.


//----------------------------------------------------------------------------------------------------

// this is the path so you know where to put this edge function:
// supabase/functions/send-reminders/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  // Check authorization
  const authHeader = req.headers.get('Authorization');
  const expectedAuth = `Bearer ${Deno.env.get('CRON_SECRET')}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    console.log("❌ Unauthorized attempt detected!");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  console.log("✅ Authorized request received");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    console.log(`📅 Checking for appointments on: ${tomorrowStr}`);

    // Get appointments for tomorrow without reminders sent
    const { data: appointments, error } = await supabase
      .from("Appointments")
      .select("*")
      .eq("appointment_date", tomorrowStr)
      .eq("reminder_sent", false);

    if (error) {
      console.error("❌ Error fetching appointments:", error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!appointments || appointments.length === 0) {
      console.log("📭 No appointments found for tomorrow");
      return new Response(JSON.stringify({ message: "No reminders to send", sent: 0 }), { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`📋 Found ${appointments.length} appointments for tomorrow`);
    let sentCount = 0;

    for (const appointment of appointments) {
      try {
        console.log(`📧 Processing appointment for: ${appointment.patient_email}`);
        
        // Format date nicely
        const appointmentDate = new Date(appointment.appointment_date);
        const formattedDate = appointmentDate.toLocaleDateString('en-ZA', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        // Send reminder email via Brevo
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #00e5a0;">Appointment Reminder ⏰</h2>
            <p>Dear <strong>${appointment.patient_name}</strong>,</p>
            <p>This is a reminder that you have an appointment <strong>tomorrow</strong>:</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>🏥 Facility:</strong> ${appointment.ClinicID}</p>
              <p><strong>📅 Date:</strong> ${formattedDate}</p>
              <p><strong>⏰ Time:</strong> ${appointment.appointment_time}</p>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>📋 Please remember to:</strong></p>
              <ul>
                <li>Arrive 10 minutes before your appointment</li>
                <li>Bring your ID document</li>
                <li>Bring any relevant medical records</li>
              </ul>
            </div>
            
            <hr>
            <p style="color: #666; font-size: 12px;">SA HealthMap - Your health, our priority</p>
          </div>
        `;

        console.log(`📤 Sending email to: ${appointment.patient_email}`);
        
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: { 
              email: "2672572@students.wits.ac.za", 
              name: "SA HealthMap" 
            },
            to: [{ email: appointment.patient_email }],
            subject: "Appointment Reminder - Tomorrow",
            htmlContent: emailHtml,
          }),
        });

        const responseText = await brevoResponse.text();
        console.log(`📬 Brevo response status: ${brevoResponse.status}`);
        console.log(`📬 Brevo response body: ${responseText}`);

        if (!brevoResponse.ok) {
          console.error(`❌ Brevo failed for ${appointment.patient_email}: ${responseText}`);
          continue;
        }

        console.log(`✅ Email sent to ${appointment.patient_email}`);

        // Create in-app notification
        const notificationMessage = `Reminder: You have an appointment at ${appointment.ClinicID} tomorrow at ${appointment.appointment_time}`;
        
        const { error: notifError } = await supabase
          .from("notifications")
          .insert([{
            user_id: appointment.PatientID,
            appointment_id: appointment.id,
            message: notificationMessage,
            type: 'reminder',
            is_read: false
          }]);

        if (notifError) {
          console.error(`❌ Failed to create notification: ${notifError.message}`);
        } else {
          console.log(`✅ In-app notification created`);
        }

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from("Appointments")
          .update({ reminder_sent: true })
          .eq("id", appointment.id);

        if (updateError) {
          console.error(`❌ Failed to update reminder_sent: ${updateError.message}`);
        } else {
          console.log(`✅ reminder_sent marked as true`);
        }

        sentCount++;
        
      } catch (err) {
        console.error(`❌ Failed for appointment ${appointment.id}:`, err.message);
      }
    }

    console.log(`🎉 Reminders sent: ${sentCount} out of ${appointments.length}`);
    
    return new Response(JSON.stringify({ success: true, sent: sentCount, total: appointments.length }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});