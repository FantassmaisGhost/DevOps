import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const appointmentId = params.get("id");

const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");
const clinicEl = document.getElementById("clinic");
const reasonEl = document.getElementById("reason");
const statusPill = document.getElementById("statusPill");
const cancelBtn = document.getElementById("cancelBtn");

let currentAppointment = null;

async function loadAppointment() {
  if (!appointmentId) {
    showError("Invalid or missing appointment ID.");
    disableActions();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "/pages/dashboard.html";
    return;
  }

  const { data: appointment, error } = await supabase
    .from("Appointments")
    .select("id, patient_email, appointment_date, appointment_time, reason, status, ClinicID, Facilities(Name)")
    .eq("id", appointmentId)
    .eq("patient_email", session.user.email)
    .maybeSingle();

  if (error) {
    showError(`Failed to load appointment: ${error.message}`);
    disableActions();
    return;
  }

  if (!appointment) {
    showError("Appointment not found for this account.");
    disableActions();
    return;
  }

  currentAppointment = appointment;

  dateEl.textContent = appointment.appointment_date || "-";
  timeEl.textContent = appointment.appointment_time || "-";
  reasonEl.textContent = appointment.reason || "-";
  clinicEl.textContent = appointment.Facilities?.Name || appointment.ClinicID || "Unknown clinic";
  setStatus(appointment.status || "unknown");

  const normalizedStatus = String(appointment.status || "").toLowerCase();
  if (normalizedStatus === "cancelled" || normalizedStatus === "completed") {
    cancelBtn.disabled = true;
    cancelBtn.textContent = normalizedStatus === "cancelled" ? "Already Cancelled" : "Cannot Cancel Completed Appointment";
  }
}

async function cancelAppointment() {
  if (!appointmentId || !currentAppointment) {
    showError("Appointment details are not available.");
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
    .eq("id", appointmentId)
    .eq("patient_email", currentAppointment.patient_email);

  if (error) {
    cancelBtn.disabled = false;
    cancelBtn.textContent = "Cancel Appointment";
    showError(`Failed to cancel appointment: ${error.message}`);
    return;
  }

  currentAppointment.status = "cancelled";
  setStatus("cancelled");
  cancelBtn.textContent = "Appointment Cancelled";
  cancelBtn.disabled = true;

  const appointmentCard = document.querySelector(".appointment");
  if (appointmentCard && !appointmentCard.querySelector(".success-message")) {
    const message = document.createElement("p");
    message.className = "success-message";
    message.textContent = "Appointment cancelled successfully.";
    appointmentCard.appendChild(message);
  }
}

function setStatus(status) {
  statusPill.textContent = status;
  statusPill.className = "status-pill " + String(status).toLowerCase();
}

function disableActions() {
  if (cancelBtn) {
    cancelBtn.disabled = true;
  }
}

function showError(message) {
  const appointmentCard = document.querySelector(".appointment");
  if (!appointmentCard) {
    return;
  }

  const existing = appointmentCard.querySelector(".error-message");
  if (existing) {
    existing.textContent = message;
    return;
  }

  const error = document.createElement("p");
  error.className = "error-message";
  error.textContent = message;
  appointmentCard.prepend(error);
}

if (cancelBtn) {
  cancelBtn.addEventListener("click", cancelAppointment);
}

loadAppointment();