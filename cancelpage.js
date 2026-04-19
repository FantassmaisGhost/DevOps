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
  console.log("Appointment clinicid:", appointment?.clinicid);

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
      .select("*")
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

  if ((appointment.status || "").toLowerCase() === "cancelled" && cancelBtn) {
    cancelBtn.disabled = true;
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

loadAppointment();
