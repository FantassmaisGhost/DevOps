import supabase from "./supabase.js";
import { createNotification } from "./createNotification.js";
import { sendEmail } from "./sendEmail.js";

const form = document.getElementById("appointmentForm");
const loading = document.getElementById("loading");
const toast = document.getElementById("toast");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  loading.style.display = "block";

  const datetime = document.getElementById("time").value;
  const reason = document.getElementById("reason").value;

  const date = datetime.split("T")[0];
  const timeOnly = datetime.split("T")[1];

  const { data: { user } } = await supabase.auth.getUser();

  // Get full name
  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const fullName = profile.full_name;

  const { data, error } = await supabase
    .from("Appointments") // ✅ IMPORTANT
    .insert([
      {
        "PatientID": user.id,
        patient_name: fullName,
        patient_email: user.email,
        appointment_date: date,
        appointment_time: timeOnly,
        reason: reason,
        status: "waiting"
      }
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    loading.style.display = "none";
    return;
  }

  const message = `
Hello ${fullName},

Your appointment is confirmed.

📅 Date: ${date}
⏰ Time: ${timeOnly}

Reason: ${reason}

Please arrive 10 minutes early.
`;

  await createNotification(user.id, data.id, message);
  await sendEmail(user.email, message);

  loading.style.display = "none";

  toast.innerText = "Appointment booked!";
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
});
