import { supabase } from "./supabase.js";

const appointmentsContainer = document.getElementById("appointmentsContainer");

function showMessage(message, className = "info-message") {
  if (!appointmentsContainer) return;
  appointmentsContainer.innerHTML = `<p class="${className}">${message}</p>`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeString) {
  if (!timeString) return "-";

  const [hours, minutes] = timeString.split(":");
  if (hours === undefined || minutes === undefined) return timeString;

  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(status) {
  const normalized = (status || "waiting").toLowerCase();
  const knownStatuses = ["scheduled", "completed", "cancelled", "waiting"];
  return knownStatuses.includes(normalized) ? normalized : "waiting";
}

function getClinicNameMap(facilities) {
  const map = new Map();

  facilities.forEach((facility) => {
    const clinicId = facility?.ClinicID;
    const clinicName = facility?.Name || "Unknown clinic";
    if (clinicId) {
      map.set(clinicId, clinicName);
    }
  });

  return map;
}

function createAppointmentCard(appointment, clinicName) {
  const article = document.createElement("article");
  article.className = "appointment-card";

  const status = normalizeStatus(appointment.status);
  const isLocked = status === "cancelled" || status === "completed";

  article.innerHTML = `
    <header class="appointment-header">
      <div>
        <h3 class="appointment-title">Appointment</h3>
        <p class="appointment-id">ID: ${appointment.id}</p>
      </div>
      <p class="status-pill ${status}">${status}</p>
    </header>

    <section class="details">
      <dl>
        <dt>Date</dt>
        <dd>${formatDate(appointment.appointment_date)}</dd>

        <dt>Time</dt>
        <dd>${formatTime(appointment.appointment_time)}</dd>

        <dt>Clinic</dt>
        <dd>${clinicName || "Unknown clinic"}</dd>

        <dt>Reason</dt>
        <dd>${appointment.reason || "-"}</dd>
      </dl>
    </section>

    <footer class="actions">
      <button
        class="btn-danger cancel-btn"
        type="button"
        data-id="${appointment.id}"
        ${isLocked ? "disabled" : ""}
      >
        ${status === "cancelled" ? "Cancelled" : status === "completed" ? "Unavailable" : "Cancel Appointment"}
      </button>
    </footer>
  `;

  return article;
}

async function getLoggedInUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Auth error:", error.message);
    return null;
  }

  return data?.user || null;
}

async function fetchAppointmentsForUser(userId) {
  const { data, error } = await supabase
    .from("Appointments")
    .select("*")
    .eq("PatientID", userId)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) {
    throw new Error(`Failed to load appointments: ${error.message}`);
  }

  return data || [];
}

async function fetchFacilities() {
  const { data, error } = await supabase
    .from("Facilities")
    .select("ClinicID, Name");

  if (error) {
    console.error("Facilities fetch error:", error.message);
    return [];
  }

  return data || [];
}

async function renderAppointments() {
  try {
    const user = await getLoggedInUser();

    if (!user) {
      showMessage("You must be logged in to view your appointments.", "error-message");
      return;
    }

    const [appointments, facilities] = await Promise.all([
      fetchAppointmentsForUser(user.id),
      fetchFacilities(),
    ]);

    if (!appointments.length) {
      showMessage("You do not have any appointments yet.", "info-message");
      return;
    }

    const clinicMap = getClinicNameMap(facilities);

    appointmentsContainer.innerHTML = "";

    appointments.forEach((appointment) => {
      const clinicName = clinicMap.get(appointment.ClinicID) || "Unknown clinic";
      const card = createAppointmentCard(appointment, clinicName);
      appointmentsContainer.appendChild(card);
    });
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Something went wrong while loading appointments.", "error-message");
  }
}

async function cancelAppointment(appointmentId, button) {
  const confirmed = window.confirm("Are you sure you want to cancel this appointment?");
  if (!confirmed) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Cancelling...";

  const { error } = await supabase
    .from("Appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);

  if (error) {
    console.error("Cancel error:", error.message);
    alert(`Failed to cancel appointment: ${error.message}`);
    button.disabled = false;
    button.textContent = originalText;
    return;
  }

  await renderAppointments();
}

appointmentsContainer?.addEventListener("click", async (event) => {
  const button = event.target.closest(".cancel-btn");
  if (!button) return;

  const appointmentId = button.dataset.id;
  if (!appointmentId) return;

  await cancelAppointment(appointmentId, button);
});

renderAppointments();