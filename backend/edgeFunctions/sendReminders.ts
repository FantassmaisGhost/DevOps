//BEFORE YOU DO ANYTHING...

//Please change the file name to index.ts and add it to the edge functions in supabase.

//I just named it as sendReminders.ts for github distinguishing purposes.


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
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Get current time plus 1 hour window
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const oneHourLater = new Date(now);
    oneHourLater.setHours(oneHourLater.getHours() + 1);
    
    console.log(`Checking for reminders at ${now.toISOString()}`);
    
    // ===== 1. DAY-BEFORE REMINDERS (existing) =====
    const { data: dayBeforeAppointments, error: dayError } = await supabase
      .from("Appointments")
      .select("*")
      .eq("appointment_date", tomorrowStr)
      .eq("reminder_sent", false);
    
    if (dayError) {
      console.error("Error fetching day-before appointments:", dayError);
    } else {
      console.log(`Found ${dayBeforeAppointments?.length || 0} appointments for tomorrow`);
    }
    
    // ===== 2. 1-HOUR-BEFORE REMINDERS (new) =====
    // Get appointments TODAY that are within the next hour and haven't had hour reminder
    const { data: hourBeforeAppointments, error: hourError } = await supabase
      .from("Appointments")
      .select("*")
      .eq("appointment_date", now.toISOString().split('T')[0])
      .eq("hour_reminder_sent", false)
      .neq("status", "cancelled");
    
    if (hourError) {
      console.error("Error fetching hour-before appointments:", hourError);
    }
    
    // Filter appointments within next hour
    const upcomingAppointments = (hourBeforeAppointments || []).filter(apt => {
      if (!apt.appointment_time) return false;
      const [aptHour, aptMinute] = apt.appointment_time.split(':').map(Number);
      const aptDateTime = new Date(now);
      aptDateTime.setHours(aptHour, aptMinute, 0, 0);
      
      const timeUntil = aptDateTime - now;
      const minutesUntil = Math.floor(timeUntil / 60000);
      
      // Within next 60 minutes AND not in the past
      return minutesUntil <= 60 && minutesUntil > 0;
    });
    
    console.log(`Found ${upcomingAppointments.length} appointments in the next hour`);
    
    let daySentCount = 0;
    let hourSentCount = 0;
    
    // ===== SEND DAY-BEFORE REMINDERS =====
    for (const appointment of dayBeforeAppointments || []) {
      try {
        const appointmentDate = new Date(appointment.appointment_date);
        const formattedDate = appointmentDate.toLocaleDateString('en-ZA', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        
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
        
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
          body: JSON.stringify({
            sender: { email: "2672572@students.wits.ac.za", name: "SA HealthMap" },
            to: [{ email: appointment.patient_email }],
            subject: "Appointment Reminder - Tomorrow",
            htmlContent: emailHtml,
          })
        });
        
        if (brevoResponse.ok) {
          await supabase.from("Appointments").update({ reminder_sent: true }).eq("id", appointment.id);
          
          await supabase.from("notifications").insert([{
            user_id: appointment.PatientID,
            appointment_id: appointment.id,
            message: `Reminder: You have an appointment at ${appointment.ClinicID} tomorrow at ${appointment.appointment_time}`,
            type: 'reminder',
            is_read: false
          }]);
          
          daySentCount++;
          console.log(`Day-before reminder sent to ${appointment.patient_email}`);
        }
      } catch (err) {
        console.error(`Failed day-before reminder for ${appointment.id}:`, err);
      }
    }
    
    // ===== SEND 1-HOUR-BEFORE REMINDERS (NEW) =====
    for (const appointment of upcomingAppointments) {
      try {
        const appointmentDate = new Date(appointment.appointment_date);
        const formattedDate = appointmentDate.toLocaleDateString('en-ZA', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        
        const [aptHour, aptMinute] = appointment.appointment_time.split(':').map(Number);
        const timeUntil = (new Date().setHours(aptHour, aptMinute, 0, 0) - Date.now()) / 60000;
        const timeText = timeUntil <= 30 ? `${Math.round(timeUntil)} minutes` : `1 hour`;
        
        // Email reminder
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ff6b6b;">⚠️ Appointment Approaching!</h2>
            <p>Dear <strong>${appointment.patient_name}</strong>,</p>
            <p>Your appointment is in <strong>${timeText}</strong>!</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>🏥 Facility:</strong> ${appointment.ClinicID}</p>
              <p><strong>📅 Date:</strong> ${formattedDate}</p>
              <p><strong>⏰ Time:</strong> ${appointment.appointment_time}</p>
            </div>
            <div style="background: #ff6b6b20; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>🚗 Please don't be late!</strong></p>
              <p>We look forward to seeing you.</p>
            </div>
            <hr>
            <p style="color: #666; font-size: 12px;">SA HealthMap - Your health, our priority</p>
          </div>
        `;
        
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
          body: JSON.stringify({
            sender: { email: "2672572@students.wits.ac.za", name: "SA HealthMap" },
            to: [{ email: appointment.patient_email }],
            subject: "⚠️ Appointment Approaching!",
            htmlContent: emailHtml,
          })
        });
        
        if (brevoResponse.ok) {
          await supabase.from("Appointments").update({ hour_reminder_sent: true }).eq("id", appointment.id);
          
          await supabase.from("notifications").insert([{
            user_id: appointment.PatientID,
            appointment_id: appointment.id,
            message: `⚠️ Your appointment at ${appointment.ClinicID} is in ${timeText}! Please don't be late.`,
            type: 'urgent_reminder',
            is_read: false
          }]);
          
          hourSentCount++;
          console.log(`Hour-before reminder sent to ${appointment.patient_email}`);
        }
      } catch (err) {
        console.error(`Failed hour-before reminder for ${appointment.id}:`, err);
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      day_before_sent: daySentCount, 
      hour_before_sent: hourSentCount,
      total: (dayBeforeAppointments?.length || 0) + upcomingAppointments.length
    }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
