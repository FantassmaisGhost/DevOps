import { supabase } from './supabase.js';

const userEmailEl = document.getElementById('userEmail');
const clinicNameEl = document.getElementById('clinicName');
const appointmentsBody = document.getElementById('appointmentsBody');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');

let allAppointments = [];
let receptionistClinicId = null;
let receptionistClinicName = null;

async function getCurrentReceptionist() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/pages/index.html';
    return null;
  }

  const email = session.user.email;
  userEmailEl.textContent = email;

  const { data: receptionist, error } = await supabase
    .from('Receptionist')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error || !receptionist) {
    alert('You are not registered as a receptionist.');
    window.location.href = '/pages/index.html';
    return null;
  }

  receptionistClinicId = receptionist.clinicid;
  receptionistClinicName = receptionist.clinicname;

  localStorage.setItem('clinicid', receptionistClinicId);
  localStorage.setItem('clinicname', receptionistClinicName);

  clinicNameEl.textContent = `Showing appointments for ${receptionistClinicName}`;

  return receptionist;
}

function formatDate(dateValue) {
  if (!dateValue) return '—';

  return new Date(dateValue).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatTime(timeValue) {
  if (!timeValue) return '—';

  return timeValue.slice(0, 5);
}

function statusClass(status) {
  const cleanStatus = String(status || '').toLowerCase();

  if (cleanStatus === 'checked_in') return 'pill-approved';
  if (cleanStatus === 'cancelled') return 'pill-cancelled';
  if (cleanStatus === 'completed') return 'pill-completed';
  if (cleanStatus === 'waiting') return 'pill-waiting';

  return 'pill-scheduled';
}

function renderAppointments(appointments) {
  if (!appointments || appointments.length === 0) {
    appointmentsBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          No appointments found for this clinic.
        </td>
      </tr>
    `;
    return;
  }

  appointmentsBody.innerHTML = appointments.map((appointment) => {
    const status = appointment.status || 'scheduled';

    const normalizedStatus = status.toLowerCase();

    const isCheckedIn = normalizedStatus === 'checked_in';
    const isCompleted = normalizedStatus === "complete"

    const isCancelled =
    normalizedStatus === 'cancelled' ||
    normalizedStatus === 'canceled';

    return `
      <tr>
        <td>${appointment.patient_name || '—'}</td>
        <td>${appointment.patient_email || '—'}</td>
        <td>${formatDate(appointment.appointment_date)}</td>
        <td>${formatTime(appointment.appointment_time)}</td>
        <td>${appointment.reason || '—'}</td>
        <td>
          <b class="pill ${statusClass(status)}">
            ${status.replace('_', ' ')}
          </b>
        </td>
        <td>
            <section class="appointment-actions">
                ${
                isCancelled
                    ? `<b class="pill pill-cancelled">Cancelled</b>`
                    : isCompleted
                    ? `<b class="pill pill-completed">Complete</b>`
                    : `
                        <button
                        class="btn btn-success"
                        data-checkin-id="${appointment.id}"
                        ${isCheckedIn ? 'disabled' : ''}
                        >
                        ${isCheckedIn ? 'Checked in' : 'Check in'}
                        </button>
                    `
                }
            </section>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('[data-checkin-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const appointmentId = button.getAttribute('data-checkin-id');
      checkInAppointment(appointmentId);
    });
  });
}

async function loadAppointments() {
  appointmentsBody.innerHTML = `
    <tr>
      <td colspan="7" class="empty-state">
        Loading appointments…
      </td>
    </tr>
  `;

  const { data, error } = await supabase
    .from('Appointments')
    .select('*')
    .eq('ClinicID', receptionistClinicId)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true });

  if (error) {
    appointmentsBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          Failed to load appointments: ${error.message}
        </td>
      </tr>
    `;
    return;
  }

  allAppointments = data || [];
  renderAppointments(allAppointments);
}

function searchAppointments() {
  const searchTerm = searchInput.value.trim().toLowerCase();

  if (!searchTerm) {
    renderAppointments(allAppointments);
    return;
  }

  const filtered = allAppointments.filter((appointment) => {
    const searchableText = [
      appointment.patient_name,
      appointment.patient_email,
      appointment.reason,
      appointment.status,
      appointment.appointment_date,
      appointment.appointment_time
    ].join(' ').toLowerCase();

    return searchableText.includes(searchTerm);
  });

  renderAppointments(filtered);
}

async function checkInAppointment(appointmentId) {
  const { error } = await supabase
    .from('Appointments')
    .update({
      status: 'checked_in'
    })
    .eq('id', appointmentId);

  if (error) {
    alert(`Failed to check in patient: ${error.message}`);
    return;
  }

  await loadAppointments();
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  localStorage.clear();
  window.location.href = '/pages/index.html';
});

searchInput.addEventListener('input', searchAppointments);

refreshBtn.addEventListener('click', loadAppointments);

async function init() {
  const receptionist = await getCurrentReceptionist();

  if (!receptionist) return;

  await loadAppointments();
}

init();