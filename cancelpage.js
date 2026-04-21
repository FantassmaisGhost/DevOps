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

function setText(el, value) {
  if (!el) return;
  el.textContent = value || "-";
}

function applyStatus(status) {
  if (!statusPill) return;

  const normalizedStatus = (status || "waiting").toLowerCase();
  const knownStatuses = ["scheduled", "completed", "cancelled", "waiting"];
  const finalStatus = knownStatuses.includes(normalizedStatus) ? normalizedStatus : "waiting";

  statusPill.textContent = finalStatus;
  statusPill.classList.remove("scheduled", "completed", "cancelled", "waiting");
  statusPill.classList.add(finalStatus);

  if (finalStatus === "cancelled" || finalStatus === "completed") {
    if (cancelBtn) {
      cancelBtn.disabled = true;
      cancelBtn.textContent = finalStatus === "cancelled" ? "Cancelled" : "Unavailable";
    }
  }
}

function getClinicId(appointment) {
  return appointment?.ClinicID || appointment?.clinicid || appointment?.clinicId || null;
}

async function fetchClinicName(clinicId) {
  if (!clinicId) return "Unknown clinic";

  let { data, error } = await supabase
    .from("Facilities")
    .select("name, Name")
    .eq("ClinicID", clinicId)
    .maybeSingle();

  if (error) {
    ({ data, error } = await supabase
      .from("Facilities")
      .select("name, Name")
      .eq("clinicid", clinicId)
      .maybeSingle());
  }

  if (error) {
    console.error("Failed to load clinic details:", error.message);
    return "Unknown clinic";
  }

  return data?.name || data?.Name || "Unknown clinic";
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

  const clinicId = getClinicId(appointment);
  const clinicName = await fetchClinicName(clinicId);

  setText(dateEl, appointment.appointment_date);
  setText(timeEl, appointment.appointment_time);
  setText(clinicEl, clinicName);
  setText(reasonEl, appointment.reason);
  applyStatus(appointment.status);
}

async function cancelAppointment() {
  if (!appointmentId || !cancelBtn) return;

  const confirmCancel = window.confirm("Are you sure you want to cancel this appointment?");
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

if (rescheduleBtn) {
  rescheduleBtn.addEventListener("click", () => {
    alert("Reschedule flow is not connected yet.");
  });
}

loadAppointment();
