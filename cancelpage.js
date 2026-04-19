import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const appointmentId = 1;//params.get("id");

const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");
const clinicEl = document.getElementById("clinic");
const reasonEl = document.getElementById("reason");
const statusPill = document.getElementById("statusPill");
const cancelBtn = document.getElementById("cancelBtn");

async function loadAppointment() {
  if (!appointmentId) {
    console.log("No appointment ID.");
    return;
  }

  //Get appointment
  const { data: appointment, error: err1 } = await supabase
    .from("Appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (err1 || !appointment) {
    console.error(err1);
    console.log("Failed to load appointment.");
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
      clinicName = facility?.name || clinicName;
    }
  }

  // 3️⃣ Populate UI
  dateEl.textContent = appointment.date || "-";
  timeEl.textContent = appointment.time || "-";
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
