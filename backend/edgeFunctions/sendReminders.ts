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
            <hr><p style="color: #666; font-size: 12px;">SA HealthMap</p>
          </div>
        `;
        
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
          body: JSON.stringify({
            sender: { email: "2672572@students.wits.ac.za", name: "SA HealthMap" },
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
              <hr><p style="color: #666; font-size: 12px;">SA HealthMap</p>
            </div>
          `;
          
          const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
            body: JSON.stringify({
              sender: { email: "2672572@students.wits.ac.za", name: "SA HealthMap" },
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




//15 May 2026:
/*
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
    // Get current time in South Africa time (UTC+2)
    const now = new Date();
    const saTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
    const todayStr = saTime.toISOString().split('T')[0];
    
    // Get tomorrow's date
    const tomorrow = new Date(saTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Current time in minutes since midnight (SA time)
    const currentHour = saTime.getHours();
    const currentMinute = saTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    console.log(`=== REMINDER CHECK ===`);
    console.log(`SA Time: ${saTime.toLocaleString()}`);
    console.log(`Current time in minutes: ${currentTimeMinutes}`);
    console.log(`Today: ${todayStr}, Tomorrow: ${tomorrowStr}`);
    
    let daySentCount = 0;
    let hourSentCount = 0;
    
    // ============================================================
    // 1. DAY-BEFORE REMINDERS
    // ============================================================
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
          console.log(`✅ Day-before reminder sent to ${appointment.patient_email}`);
        } else {
          console.error(`❌ Brevo failed for day-before: ${appointment.patient_email}`);
        }
      } catch (err) {
        console.error(`Failed day-before reminder for ${appointment.id}:`, err);
      }
    }
    
    // ============================================================
    // 2. 1-HOUR-BEFORE REMINDERS
    // ============================================================
    const { data: hourBeforeAppointments, error: hourError } = await supabase
      .from("Appointments")
      .select("*")
      .eq("appointment_date", todayStr)
      .eq("hour_reminder_sent", false)
      .neq("status", "cancelled");
    
    if (hourError) {
      console.error("Error fetching hour-before appointments:", hourError);
    } else {
      console.log(`Found ${hourBeforeAppointments?.length || 0} appointments for today to check`);
    }
    
    for (const appointment of hourBeforeAppointments || []) {
      if (!appointment.appointment_time) {
        console.log(`⏭️ No time set for appointment ${appointment.id}`);
        continue;
      }
      
      // Parse appointment time
      const [aptHour, aptMinute] = appointment.appointment_time.split(':').map(Number);
      const appointmentTimeMinutes = aptHour * 60 + aptMinute;
      
      // Calculate minutes until appointment
      let minutesUntil = appointmentTimeMinutes - currentTimeMinutes;
      
      console.log(`Appointment at ${appointment.appointment_time}: ${minutesUntil} minutes from now`);
      
      // Send reminder if appointment is within the next 60 minutes AND in the future
      if (minutesUntil > 0 && minutesUntil <= 60) {
        try {
          const appointmentDate = new Date(appointment.appointment_date);
          const formattedDate = appointmentDate.toLocaleDateString('en-ZA', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          });
          
          const timeUntil = minutesUntil <= 30 ? `${minutesUntil} minutes` : '1 hour';
          
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ff6b6b;">⚠️ Appointment Approaching!</h2>
              <p>Dear <strong>${appointment.patient_name}</strong>,</p>
              <p>Your appointment is in <strong>${timeUntil}</strong>!</p>
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
            await supabase
              .from("Appointments")
              .update({ hour_reminder_sent: true })
              .eq("id", appointment.id);
            
            await supabase
              .from("notifications")
              .insert([{
                user_id: appointment.PatientID,
                appointment_id: appointment.id,
                message: `⚠️ Your appointment at ${appointment.ClinicID} is in ${timeUntil}! Please don't be late.`,
                type: 'urgent_reminder',
                is_read: false
              }]);
            
            hourSentCount++;
            console.log(`✅ Hour-before reminder sent to ${appointment.patient_email} (${minutesUntil} min before)`);
          } else {
            console.error(`❌ Brevo failed for hour-before: ${appointment.patient_email}`);
          }
        } catch (err) {
          console.error(`Failed hour-before reminder for ${appointment.id}:`, err);
        }
      } else if (minutesUntil > 0) {
        console.log(`⏭️ Appointment at ${appointment.appointment_time} is in ${minutesUntil} minutes (outside 60-min window)`);
      } else {
        console.log(`⏭️ Appointment at ${appointment.appointment_time} already passed (${-minutesUntil} minutes ago)`);
      }
    }
    
    console.log(`=== SUMMARY ===`);
    console.log(`Day-before reminders sent: ${daySentCount}`);
    console.log(`Hour-before reminders sent: ${hourSentCount}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      day_before_sent: daySentCount, 
      hour_before_sent: hourSentCount,
      timestamp: saTime.toISOString()
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
*/



//14 May 2026:
/*
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
<<<<<<< HEAD
=======
*/



/*
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
*/
>>>>>>> 70ac7c2b43f72ce55f1c156575c1aed07efa1ec6
