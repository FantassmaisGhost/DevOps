import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const appointmentId = Number(params.get("id"));

const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");
const clinicEl = document.getElementById("clinic");
const reasonEl = document.getElementById("reason");
const statusPill = document.getElementById("statusPill");
const cancelBtn = document.getElementById("cancelBtn");

let currentAppointment = null;

async function loadAppointment() {
  if (!Number.isInteger(appointmentId)) {
    showError("Invalid or missing appointment ID.");
    disableActions();
    return;
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    showError("Please log in to view this appointment.");
    disableActions();
    return;
  }

  const patientEmail = session.user.email;

  const { data: appointment, error: appointmentError } = await supabase
    .from("Appointments")
    .select("id, appointment_date, appointment_time, reason, status, ClinicID, clinicid, patient_email")
    .eq("id", appointmentId)
    .eq("patient_email", patientEmail)
    .maybeSingle();

  if (appointmentError) {
    showError(`Failed to load appointment: ${appointmentError.message}`);
    disableActions();
    return;
  }

  if (!appointment) {
    showError("Appointment not found for your account.");
    disableActions();
    return;
  }

  currentAppointment = appointment;

  const clinicId = appointment.ClinicID ?? appointment.clinicid ?? null;
  const clinicName = await loadClinicName(clinicId);

  dateEl.textContent = formatDate(appointment.appointment_date);
  timeEl.textContent = formatTime(appointment.appointment_time);
  reasonEl.textContent = appointment.reason || "-";
  clinicEl.textContent = clinicName;
  statusPill.textContent = appointment.status || "unknown";
  statusPill.className = `status-pill ${normalizeStatus(appointment.status)}`;

  if (normalizeStatus(appointment.status) === "cancelled") {
    cancelBtn.textContent = "Appointment Cancelled";
    cancelBtn.disabled = true;
  }
}

async function loadClinicName(clinicId) {
  if (!clinicId) {
    return "Unknown clinic";
  }

  const { data: facility, error } = await supabase
    .from("Facilities")
    .select("Name, name, ClinicID, clinicid")
    .or(`ClinicID.eq.${clinicId},clinicid.eq.${clinicId}`)
    .maybeSingle();

  if (error) {
    console.error("Failed to load clinic details:", error.message);
    return "Unknown clinic";
  }

  return facility?.Name || facility?.name || "Unknown clinic";
}

async function cancelAppointment() {
  if (!currentAppointment) {
    showError("Appointment details are not loaded yet.");
    return;
  }

  if (!confirm("Are you sure you want to cancel this appointment?")) {
    return;
  }

  cancelBtn.disabled = true;
  cancelBtn.textContent = "Cancelling...";

  const { error } = await supabase
    .from("Appointments")
    .update({ status: "cancelled" })
    .eq("id", currentAppointment.id)
    .eq("patient_email", currentAppointment.patient_email);

  if (error) {
    console.error("Cancel failed:", error.message);
    cancelBtn.disabled = false;
    cancelBtn.textContent = "Cancel Appointment";
    showError(`Failed to cancel appointment: ${error.message}`);
    return;
  }

  statusPill.textContent = "cancelled";
  statusPill.className = "status-pill cancelled";
  cancelBtn.textContent = "Appointment Cancelled";
  cancelBtn.disabled = true;
  showSuccess("Appointment cancelled successfully.");
}

function disableActions() {
  if (cancelBtn) {
    cancelBtn.disabled = true;
  }
}

function showError(msg) {
  renderMessage(msg, "error-message");
}

function showSuccess(msg) {
  renderMessage(msg, "success-message");
}

function renderMessage(msg, className) {
  const appointmentCard = document.querySelector(".appointment");
  if (!appointmentCard) {
    return;
  }

  let messageEl = appointmentCard.querySelector(".page-message");
  if (!messageEl) {
    messageEl = document.createElement("p");
    messageEl.className = `page-message ${className}`;
    appointmentCard.appendChild(messageEl);
  } else {
    messageEl.className = `page-message ${className}`;
  }

  messageEl.textContent = msg;
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase() || "unknown";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-ZA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(value) {
  if (!value) {
    return "-";
  }

  if (/^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

if (cancelBtn) {
  cancelBtn.addEventListener("click", cancelAppointment);
}

loadAppointment();