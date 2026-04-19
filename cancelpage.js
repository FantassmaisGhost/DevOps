import supabase from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const appointmentId = params.get("id");

const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");
const clinicEl = document.getElementById("clinic");
const reasonEl = document.getElementById("reason");
const statusPill = document.getElementById("statusPill");

async function loadAppointment() {
  if (!id) {
    showError("No appointment ID.");
    return;
  }

  //Get appointment
  const { data: appointment, error: err1 } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

console.log("appointment:", appointment);
console.log("err1:", err1);

  if (err1 || !appointment) {
    console.error(err1);
    showError("Failed to load appointment.");
    return;
  }

  //Get clinic name using ClinicID
  const { data: facility, error: err2 } = await supabase
    .from("Facilities")
    .select("Name")
    .eq("id", appointment.ClinicID)
    .maybeSingle();

  if (err2) {
    console.error(err2);
  }

  // 3️⃣ Populate UI
  dateEl.textContent = appointment.date || "-";
  timeEl.textContent = appointment.time || "-";
  reasonEl.textContent = appointment.reason || "-";
  clinicEl.textContent = facility.Name || "Unknown clinic";
  statusPill.textContent = appointment.status || "unknown";
}

// function showError(msg) {
//   document.querySelector(".appointment").innerHTML =
//     `<p class="error-message">${msg}</p>`;
// }

loadAppointment();