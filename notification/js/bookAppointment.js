/*
import supabase from "./supabase.js";
import { createNotification } from "./createNotification.js";
import { sendEmail } from "./sendEmail.js";

const form = document.getElementById("appointmentForm");

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  const time = document.getElementById("time").value;
  const reason = document.getElementById("reason").value;

  const { data: { user } } = await supabase.auth.getUser();

  // insert appointment
  const { data, error } = await supabase
    .from("appointments")
    .insert([
      {
        patient_id: user.id,
        appointment_time: time,
        reason: reason,
        status: "booked"
      }
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    return;
  }

  const message = `
Your appointment is confirmed.

Time: ${time}
Reason: ${reason}
`;

  // create notification
  await createNotification(user.id, data.id, message);

  // send email
  await sendEmail(user.email, message);

  alert("Appointment booked!");

});
*/

/*
import supabase from "./supabase.js";
import { createNotification } from "./createNotification.js";
import { sendEmail } from "./sendEmail.js";

const form = document.getElementById("appointmentForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const time = document.getElementById("time").value;
  const reason = document.getElementById("reason").value;

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("appointments")
    .insert([
      {
        patient_id: user.id,
        appointment_time: time,
        reason: reason,
        status: "booked"
      }
    ])
    .select()
    .single();

  if (error) return console.error(error);

  const message = `
Hello,

Your appointment is confirmed.

Time: ${time}
Reason: ${reason}
`;

  await createNotification(user.id, data.id, message);
  await sendEmail(user.email, message);

});
*/

/*
this is what was working before i noticed that they changed the appointments table

import supabase from "./supabase.js";
import { createNotification } from "./createNotification.js";
import { sendEmail } from "./sendEmail.js";

const form = document.getElementById("appointmentForm");
const loading = document.getElementById("loading");
const toast = document.getElementById("toast");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  loading.style.display = "block";

  const time = document.getElementById("time").value;
  const reason = document.getElementById("reason").value;

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("appointments")
    .insert([
      {
        patient_id: user.id,
        appointment_time: time,
        reason: reason,
        status: "booked"
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
Hello,

Your appointment is confirmed.

Time: ${time}
Reason: ${reason}
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
*/

//-----------------------------------------------------------------------------------------------------------------------------
//After Appointment table was changed (change being that id type went from uuid to int4)

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

  const [date, timeOnly] = datetime.split("T");

  const { data: { user } } = await supabase.auth.getUser();

  // get full name
  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const fullName = profile.full_name;

  const { data, error } = await supabase
    .from("appointments")
    .insert([
      {
        PatientID: user.id,
        patient_name: fullName,
        patient_email: user.email,
        appointment_time: timeOnly,
        appointment_date: date,
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

Your appointment has been booked.

Date: ${date}
Time: ${timeOnly}

Reason: ${reason}
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