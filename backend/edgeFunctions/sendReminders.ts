//BEFORE YOU DO ANYTHING...

//Please change the file name to index.ts and add it to the edge functions in supabase.

//I just named it as sendReminders.ts for github distinguishing purposes.


//----------------------------------------------------------------------------------------------------

// this is the path so you know where to put this edge function:
// supabase/functions/send-reminders/index.ts

//15 May 2026 (latest)
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

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
    const saTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
    const todayStr = saTime.toISOString().split('T')[0];
    
    const tomorrow = new Date(saTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const currentTimeMinutes = saTime.getHours() * 60 + saTime.getMinutes();
    
    console.log(`SA Time: ${saTime.toLocaleString()}`);
    
    let daySentCount = 0;
    let hourSentCount = 0;
    
    // Helper function to get clinic name
    async function getClinicName(clinicId) {
      const { data, error } = await supabase
        .from("Facilities")
        .select("Name")
        .eq("ClinicID", clinicId)
        .single();
      return data?.Name || clinicId;
    }
    
    // ===== DAY-BEFORE REMINDERS =====
    const { data: dayBeforeAppointments } = await supabase
      .from("Appointments")
      .select("*")
      .eq("appointment_date", tomorrowStr)
      .eq("reminder_sent", false);
    
    for (const apt of dayBeforeAppointments || []) {
      try {
        const clinicName = await getClinicName(apt.ClinicID);
        const formattedDate = new Date(apt.appointment_date).toLocaleDateString('en-ZA', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2 style="color: #00e5a0;">Appointment Reminder ⏰</h2>
            <p>Dear <strong>${apt.patient_name}</strong>,</p>
            <p>Your appointment at <strong>${clinicName}</strong> is <strong>tomorrow</strong>:</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
              <p><strong>🏥 Facility:</strong> ${clinicName}</p>
              <p><strong>📅 Date:</strong> ${formattedDate}</p>
              <p><strong>⏰ Time:</strong> ${apt.appointment_time}</p>
            </div>
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px;">
              <p><strong>📋 Please remember to:</strong></p>
              <ul><li>Arrive 10 minutes early</li><li>Bring your ID</li><li>Bring medical records</li></ul>
            </div>
            <hr><p style="color: #666; font-size: 12px;">Health Flow</p>
          </div>
        `;
        
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
          body: JSON.stringify({
            sender: { email: "2672572@students.wits.ac.za", name: "Health Flow" },
            to: [{ email: apt.patient_email }],
            subject: "Appointment Reminder - Tomorrow",
            htmlContent: emailHtml,
          })
        });
        
        if (response.ok) {
          await supabase.from("Appointments").update({ reminder_sent: true }).eq("id", apt.id);
          await supabase.from("notifications").insert([{
            user_id: apt.PatientID, appointment_id: apt.id,
            message: `Reminder: Appointment at ${clinicName} tomorrow at ${apt.appointment_time}`,
            type: 'reminder', is_read: false
          }]);
          daySentCount++;
        }
      } catch (err) { console.error(err); }
    }
    
    // ===== HOUR-BEFORE REMINDERS =====
    const { data: hourBeforeAppointments } = await supabase
      .from("Appointments")
      .select("*")
      .eq("appointment_date", todayStr)
      .eq("hour_reminder_sent", false)
      .neq("status", "cancelled");
    
    for (const apt of hourBeforeAppointments || []) {
      if (!apt.appointment_time) continue;
      
      const [aptHour, aptMinute] = apt.appointment_time.split(':').map(Number);
      const minutesUntil = (aptHour * 60 + aptMinute) - currentTimeMinutes;
      
      if (minutesUntil > 0 && minutesUntil <= 60) {
        try {
          const clinicName = await getClinicName(apt.ClinicID);
          const formattedDate = new Date(apt.appointment_date).toLocaleDateString('en-ZA', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          });
          const timeUntil = minutesUntil <= 30 ? `${minutesUntil} minutes` : '1 hour';
          
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2 style="color: #ff6b6b;">⚠️ Appointment Approaching!</h2>
              <p>Dear <strong>${apt.patient_name}</strong>,</p>
              <p>Your appointment at <strong>${clinicName}</strong> is in <strong>${timeUntil}</strong>!</p>
              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                <p><strong>🏥 Facility:</strong> ${clinicName}</p>
                <p><strong>📅 Date:</strong> ${formattedDate}</p>
                <p><strong>⏰ Time:</strong> ${apt.appointment_time}</p>
              </div>
              <div style="background: #ff6b6b20; padding: 15px; border-radius: 8px;">
                <p><strong>🚗 Please don't be late!</strong></p>
              </div>
              <hr><p style="color: #666; font-size: 12px;">Health Flow</p>
            </div>
          `;
          
          const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
            body: JSON.stringify({
              sender: { email: "2672572@students.wits.ac.za", name: "Health Flow" },
              to: [{ email: apt.patient_email }],
              subject: "⚠️ Appointment Approaching!",
              htmlContent: emailHtml,
            })
          });
          
          if (response.ok) {
            await supabase.from("Appointments").update({ hour_reminder_sent: true }).eq("id", apt.id);
            await supabase.from("notifications").insert([{
              user_id: apt.PatientID, appointment_id: apt.id,
              message: `⚠️ Your appointment at ${clinicName} is in ${timeUntil}!`,
              type: 'urgent_reminder', is_read: false
            }]);
            hourSentCount++;
          }
        } catch (err) { console.error(err); }
      }
    }
    
    return new Response(JSON.stringify({ success: true, day_before_sent: daySentCount, hour_before_sent: hourSentCount }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
