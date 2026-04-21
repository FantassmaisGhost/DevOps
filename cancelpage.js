import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const appointmentId = params.get("id");

const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");
const clinicEl = document.getElementById("clinic");
const reasonEl = document.getElementById("reason");
const statusPill = document.getElementById("statusPill");
const cancelBtn = document.getElementById("cancelBtn");
const rescheduleBtn = document.getElementById("rescheduleBtn");

function disableActions() {
  if (cancelBtn) cancelBtn.disabled = true;
  if (rescheduleBtn) rescheduleBtn.disabled = true;
}

function showError(message) {
  const appointmentCard = document.querySelector(".appointment");
  if (!appointmentCard) return;

  appointmentCard.innerHTML = `<p class="error-message">${message}</p>`;
}

function applyStatus(status) {
  const normalizedStatus = (status || "unknown").toLowerCase();

  statusPill.textContent = normalizedStatus;
  statusPill.classList.remove("cancelled");

  if (normalizedStatus === "cancelled") {
    statusPill.classList.add("cancelled");
    if (cancelBtn) {
      cancelBtn.disabled = true;
      cancelBtn.textContent = "Cancelled";
    }
  }
}

async function loadAppointment() {
  if (!appointmentId) {
    showError("Invalid or missing appointment ID.");
    disableActions();
    return;
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("Appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();

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

    if (facilityError) {
      console.error("Failed to load clinic details:", facilityError.message);
    } else if (facility?.name) {
      clinicName = facility.name;
    }
  }

  dateEl.textContent = appointment.appointment_date || "-";
  timeEl.textContent = appointment.appointment_time || "-";
  clinicEl.textContent = clinicName;
  reasonEl.textContent = appointment.reason || "-";
  applyStatus(appointment.status);
}

async function cancelAppointment() {
  if (!appointmentId || !cancelBtn) return;

  const confirmCancel = window.confirm(
    "Are you sure you want to cancel this appointment?"
  );

  if (!confirmCancel) return;

  cancelBtn.disabled = true;
  cancelBtn.textContent = "Cancelling...";

  const { error } = await supabase
    .from("Appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);

  if (error) {
    console.error("Cancel error:", error.message);
    alert(`Failed to cancel appointment: ${error.message}`);
    cancelBtn.disabled = false;
    cancelBtn.textContent = "Cancel Appointment";
    return;
  }

  applyStatus("cancelled");
}

if (cancelBtn) {
  cancelBtn.addEventListener("click", cancelAppointment);
}

loadAppointment();
