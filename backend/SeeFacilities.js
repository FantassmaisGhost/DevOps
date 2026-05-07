import { supabase } from './supabase.js';

const params = new URLSearchParams(location.search);
const clinicID = params.get('clinicID');
const clinicName = params.get('name') || 'Health Facility';
const clinicType = params.get('type') || 'clinic';
const clinicSector = params.get('sector') || 'public';
const clinicSubtype = params.get('subtype') || '';
const clinicProvince = params.get('province') || '';

const CLINIC_ID = clinicID || '00001';

function showToast(message, type) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.backgroundColor = type === 'success' ? '#00e5a0' : '#ff6b6b';
  toast.style.color = type === 'success' ? '#0b0e14' : 'white';
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 5000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ========== STAFF ID GENERATION FUNCTION (Option B) ==========
async function generateStaffId(clinicId) {
  // Find the highest staff number for this clinic from Staff table
  const { data } = await supabase
    .from('Staff')
    .select('id')
    .eq('ClinicID', clinicId)
    .order('id', { ascending: false })
    .limit(1);
  
  let nextNumber = 1;
  
  if (data && data.length > 0 && data[0].id) {
    // Extract the number from STF-00004-001 (get part after last dash)
    const lastId = data[0].id;
    const parts = lastId.split('-');
    if (parts.length === 3) {
      const lastNumber = parseInt(parts[2], 10);
      nextNumber = lastNumber + 1;
    }
  }
  
  // Format: STF-00004-001 (5 digits for clinic, 3 digits for number)
  const paddedClinic = String(clinicId).padStart(5, '0');
  const paddedNumber = String(nextNumber).padStart(3, '0');
  
  return `STF-${paddedClinic}-${paddedNumber}`;
}

// ========== STAFF MANAGEMENT FUNCTIONS ==========
async function loadStaff() {
  const { data, error } = await supabase
    .from('Staff')
    .select('*')
    .eq('ClinicID', CLINIC_ID);
  // Remove .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error loading staff:', error);
    return [];
  }
  return data || [];
}

async function removeStaff(id, name) {
  if (!confirm(`Remove ${name} from staff? They will lose staff access.`)) return false;
  
  const { error } = await supabase
    .from('Staff')
    .delete()
    .eq('id', id);
  
  if (error) {
    showToast('Failed to remove staff', 'error');
    return false;
  }
  
  showToast(`Removed ${name} from staff`, 'success');
  return true;
}

async function renderStaffList() {
  const staff = await loadStaff();
  const container = document.getElementById('staff-list-container');
  
  if (!container) return;
  
  if (staff.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #5a6280; padding: 20px;">No staff members for this clinic.</p>';
    return;
  }
  
  container.innerHTML = staff.map(s => `
    <article style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #252b3d;">
      <header>
        <strong>${escapeHtml(s.full_name)}</strong><br>
        <small style="color: #5a6280;">${escapeHtml(s.email)} • ${escapeHtml(s.occupation)}</small><br>
        <small style="color: #5a6280;">Staff ID: ${escapeHtml(s.id)}</small><br>
        <small style="color: #5a6280;">Phone: ${escapeHtml(s.contact || 'N/A')}</small>
      </header>
      <button class="remove-staff-btn" data-id="${s.id}" data-name="${escapeHtml(s.full_name)}" 
              class="btn-danger">
        Remove
      </button>
    </article>
  `).join('');
  
  document.querySelectorAll('.remove-staff-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const success = await removeStaff(id, name);
      if (success) {
        renderStaffList();
      }
    });
  });
}

// ========== PENDING STAFF FUNCTIONS ==========
async function loadPendingStaff() {
  const { data, error } = await supabase
    .from('pending_staff')
    .select('*')
    .eq('clinicid', CLINIC_ID)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error loading pending staff:', error);
    return [];
  }
  return data || [];
}

async function approveStaff(pending) {
  // Generate the Staff ID before inserting
  const newStaffId = await generateStaffId(pending.clinicid);
  
  const { error: insertError } = await supabase
    .from('Staff')
    .insert([{
      id: newStaffId,
      email: pending.email,
      ClinicID: pending.clinicid,
      full_name: pending.full_name,
      Occupation: pending.occupation || 'Staff Member',
      contact: pending.phone_number || null
    }]);
  
  if (insertError) {
    showToast('Failed to approve staff: ' + insertError.message, 'error');
    return false;
  }
  
  await supabase
    .from('pending_staff')
    .update({ status: 'approved' })
    .eq('email', pending.email);
  
  showToast(`✅ ${pending.full_name} approved as staff! Staff ID: ${newStaffId}`, 'success');
  return true;
}

async function renderPendingStaff() {
  const pending = await loadPendingStaff();
  const container = document.getElementById('pending-staff-container');
  
  if (!container) return;
  
  if (pending.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #5a6280; padding: 20px;">No pending staff requests for this clinic.</p>';
    return;
  }
  
  container.innerHTML = pending.map(p => `
    <article style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #252b3d;">
      <header>
        <strong>${escapeHtml(p.full_name)}</strong><br>
        <small style="color: #5a6280;">${escapeHtml(p.email)}</small><br>
        <small style="color: #5a6280;">Occupation: ${escapeHtml(p.occupation || 'Not specified')}</small>
        ${p.phone_number ? `<br><small style="color: #5a6280;">Phone: ${escapeHtml(p.phone_number)}</small>` : ''}
      </header>
      <button class="approve-staff-btn" data-email="${p.email}" 
              style="background: #00e5a0; color: #0b0e14; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer;">
        Approve
      </button>
    </article>
  `).join('');
  
  document.querySelectorAll('.approve-staff-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.getAttribute('data-email');
      const pendingItem = pending.find(p => p.email === email);
      if (pendingItem) {
        const success = await approveStaff(pendingItem);
        if (success) {
          renderPendingStaff();
          renderStaffList();
        }
      }
    });
  });
}

// ========== INIT FUNCTIONS ==========
function initStaffManagement() {
  const clinicDisplay = document.getElementById('current-clinic-display');
  if (clinicDisplay) {
    clinicDisplay.textContent = CLINIC_ID;
  }
  
  renderStaffList();
  renderPendingStaff();
}

async function init() {
  if (!clinicID) {
    renderError('No facility selected.', 'Go back to the map and click a clinic or hospital.');
    return;
  }
  
  renderClinicHeader();
  renderActionCards();
  initStaffManagement();
}

function renderClinicHeader() {
  const typeLabel = clinicType === 'hospital' ? 'HOSPITAL' : 'CLINIC / CHC';
  const typeClass = clinicType === 'hospital' ? 'chip-hosp' : 'chip-clinic';
  const sectClass = clinicSector === 'public' ? 'chip-public' : 'chip-private';

  const headerHtml = `
    <section class="clinic-header">
      <a href="admin-dashboard.html" class="back-link">← Back to Admin Dashboard</a>
      <h1 class="clinic-name">${escapeHtml(clinicName)}</h1>
      <section class="clinic-meta">
        <strong>${escapeHtml(clinicProvince)}</strong>
        ${clinicSubtype ? `<strong>· ${escapeHtml(clinicSubtype)}</strong>` : ''}
      </section>
      <section style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
        <strong class="chip ${typeClass}">${typeLabel}</strong>
        <strong class="chip ${sectClass}">${clinicSector.toUpperCase()}</strong>
        <strong class="chip chip-prov">${escapeHtml(clinicProvince).toUpperCase()}</strong>
        <strong class="chip chip-id">ID: ${escapeHtml(clinicID)}</strong>
      </section>
    </section>
  `;

  const container = document.getElementById('dynamic-content');
  container.innerHTML = headerHtml;
}

function renderActionCards() {
  const actionsHtml = `
    <section class="panel">
      <header class="panel-header">
        <h3 class="panel-title">Management Actions</h3>
      </header>
      <section class="action-card">
        <section class="action-info">
          <h4 class="action-title">Operating Hours</h4>
          <p class="action-desc">Edit clinic opening and closing times</p>
        </section>
        <a href="Changetime.html?clinicID=${encodeURIComponent(clinicID)}" class="btn-primary">Manage Hours →</a>
      </section>
    </section>
  `;
  
  const container = document.getElementById('dynamic-content');
  container.insertAdjacentHTML('beforeend', actionsHtml);
}

function renderError(title, msg) {
  const container = document.getElementById('dynamic-content');
  container.innerHTML = `
    <section class="error-state">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(msg)}</p>
      <br>
      <a href="admin-dashboard.html" class="btn-outline" style="margin-top:16px; display:inline-block;">← Back to Admin Dashboard</a>
    </section>
  `;
}

init();