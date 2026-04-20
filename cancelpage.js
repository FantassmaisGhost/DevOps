import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const appointmentId = Number(params.get("id"));

const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");
const clinicEl = document.getElementById("clinic");
const reasonEl = document.getElementById("reason");
const statusPill = document.getElementById("statusPill");
const cancelBtn = document.getElementById("cancelBtn");

async function loadAppointment() {
  if (!Number.isInteger(appointmentId)) {
    showError("Invalid or missing appointment ID.");
    disableActions();
    return;
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("Appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();

  console.log("Appointment:", appointment, appointmentError);

  if (appointmentError) {
    showError(`Failed to load appointment: ${appointmentError.message}`);
    disableActions();
    return;
  }

  if (!appointment) {
    showError("Appointment not found.");
    disableActions();
    return;
  }

  let clinicName = "Unknown clinic";

  if (appointment.clinicid) {
    const { data: facility, error: facilityError } = await supabase
      .from("Facilities")
      .select("name")
      .eq("clinicid", appointment.clinicid)
      .maybeSingle();

    console.log("Facility:", facility, facilityError);

    if (facilityError) {
      console.error("Failed to load clinic details:", facilityError.message);
    } else {
      clinicName = facility?.name || "Unknown clinic";
    }
  }

  dateEl.textContent = appointment.appointment_date || "-";
  timeEl.textContent = appointment.appointment_time || "-";
  reasonEl.textContent = appointment.reason || "-";
  clinicEl.textContent = clinicName;
  statusPill.textContent = appointment.status || "unknown";
}

async function cancelAppointment() {
  if (!Number.isInteger(appointmentId)) {
    showError("Invalid appointment ID.");
    return;
  }

  if (!confirm("Are you sure you want to cancel this appointment?")) {
    return;
  }

  cancelBtn.disabled = true;
  cancelBtn.textContent = "Cancelling...";

  const { error } = await supabase
    .from("Appointments")
    .delete()
    .eq("id", appointmentId);

  if (error) {
    console.error("Cancel failed:", error.message);
    cancelBtn.disabled = false;
    cancelBtn.textContent = "Cancel Appointment";
    showError(`Failed to cancel appointment: ${error.message}`);
    return;
  }

  statusPill.textContent = "cancelled";
  cancelBtn.textContent = "Appointment Cancelled";
  cancelBtn.disabled = true;

  const appointmentCard = document.querySelector(".appointment");
  if (appointmentCard) {
    const message = document.createElement("p");
    message.className = "success-message";
    message.textContent = "Appointment cancelled successfully.";
    appointmentCard.appendChild(message);
  }
}

function disableActions() {
  if (cancelBtn) {
    cancelBtn.disabled = true;
  }
}

function showError(msg) {
  const appointmentCard = document.querySelector(".appointment");
  if (!appointmentCard) {
    return;
  }

  appointmentCard.innerHTML = `<p class="error-message">${msg}</p>`;
}

if (cancelBtn) {
  cancelBtn.addEventListener("click", cancelAppointment);
}

loadAppointment();