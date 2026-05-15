// clinic_app.js
import { supabase } from './supabase.js';
import { Utils } from './utils.js';

<<<<<<< HEAD
// ========== GLOBAL VARIABLES ==========
let allClinics = [];
let currentClinicId = null;
let selectedRating = 0;
let currentFilter = 'all';
let allBookings = [];

const esc = Utils.esc;

// ========== ADMIN CHECK (using Admin table) ==========
async function isAdmin() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        const { data: admin } = await supabase
            .from('Admin')
            .select('Email')
            .eq('Email', user.email)
            .maybeSingle();
        return !!admin;
    } catch (err) {
        console.error('Admin check error:', err);
        return false;
    }
}

// ========== CLINIC LIST ==========
async function loadClinics() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '<div class="loading">🔄 Loading clinics from database...</div>';
    try {
        const { data, error } = await supabase
            .from('Facilities')
            .select('*')
            .order('Name');
        if (error) throw error;
        allClinics = data || [];
        if (allClinics.length === 0) {
            contentDiv.innerHTML = '<div class="info">📭 No clinics found in database.</div>';
            return;
        }
        const provinces = [...new Set(allClinics.map(c => c.Province).filter(p => p))];
        const html = `
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="🔍 Search by clinic name...">
            </div>
            <div class="province-filter">
                <select id="provinceFilter">
                    <option value="">🌍 All Provinces (${allClinics.length} clinics)</option>
                    ${provinces.map(p => `<option value="${p}">📍 ${p}</option>`).join('')}
                </select>
            </div>
            <div class="clinics-grid" id="clinicsGrid"></div>
        `;
        contentDiv.innerHTML = html;
        filterClinics();

        document.getElementById('searchInput').addEventListener('input', () => filterClinics());
        document.getElementById('provinceFilter').addEventListener('change', () => filterClinics());
    } catch (err) {
        contentDiv.innerHTML = `<div class="error">💥 Error: ${esc(err.message)}</div>`;
    }
}

function filterClinics() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const province = document.getElementById('provinceFilter')?.value || '';
    let filtered = allClinics;
    if (searchTerm) filtered = filtered.filter(c => c.Name?.toLowerCase().includes(searchTerm));
    if (province) filtered = filtered.filter(c => c.Province === province);
    const grid = document.getElementById('clinicsGrid');
    if (!grid) return;
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="info">🔍 No clinics match your search.</div>';
        return;
    }
    grid.innerHTML = filtered.map(clinic => `
        <div class="clinic-card" data-clinic-id="${esc(clinic.ClinicID)}">
            <h3>🏥 ${esc(clinic.Name || 'Unnamed Clinic')}</h3>
            <p>📍 ${esc(clinic.Province || 'Unknown')} | 🏥 ${esc(clinic.Type || 'Clinic')}</p>
            <p>🏢 ${esc(clinic.Sector || 'N/A')}</p>
            <button class="btn btn-primary view-detail-btn" style="margin-top: 10px;">View Details →</button>
        </div>
    `).join('');

    document.querySelectorAll('.clinic-card').forEach(card => {
        const clinicId = card.dataset.clinicId;
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-detail-btn')) e.stopPropagation();
            viewClinicDetail(clinicId);
        });
        const btn = card.querySelector('.view-detail-btn');
        if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); viewClinicDetail(clinicId); });
    });
}

// ========== CLINIC DETAILS (WITH EDIT BUTTON) ==========
async function viewClinicDetail(clinicId) {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '<div class="loading">🔍 Loading clinic details...</div>';
    try {
        const { data: clinic, error } = await supabase
            .from('Facilities')
            .select('*')
            .eq('ClinicID', clinicId)
            .single();
        if (error) throw error;

        const admin = await isAdmin();

        // Operating hours
        let hoursHtml = '';
        const { data: hours } = await supabase
            .from('Operating_Hours')
            .select('*')
            .eq('clinicid', clinicId);
        if (hours && hours.length) {
            hoursHtml = `<div class="detail-section"><h3>🕒 Operating Hours</h3>${hours.map(h => `<p><strong>${esc(h.day)}:</strong> ${esc(h.opentime || '--')} - ${esc(h.closingtime || '--')}</p>`).join('')}</div>`;
        }

        // Reviews
        let ratingHtml = '<div class="detail-section"><h3>⭐ Patient Reviews</h3><p>No reviews yet. Be the first!</p></div>';
        const { data: reviews } = await supabase
            .from('clinic_reviews')
            .select('rating, comment, created_at')
            .eq('clinic_id', clinicId);
        if (reviews && reviews.length) {
            const sum = reviews.reduce((a, b) => a + b.rating, 0);
            const avg = (sum / reviews.length).toFixed(1);
            ratingHtml = `<div class="detail-section"><h3>⭐ Patient Reviews</h3><p><strong>Average: ${avg}/5</strong> (${reviews.length} reviews)</p>${reviews.slice(0, 5).map(r => `<div style="border-top:1px solid #eee; padding:10px 0;"><div>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>${r.comment ? `<p style="margin:5px 0 0 0; color:#555;">${esc(r.comment)}</p>` : ''}<small style="color:#999;">${new Date(r.created_at).toLocaleDateString()}</small></div>`).join('')}</div>`;
        }

        const html = `
            <button class="btn btn-secondary" id="backToClinicsBtn" style="margin-bottom: 20px;">← Back to Clinics</button>
            <div style="background: white; border-radius: 12px;">
                <div class="header-with-edit">
                    <h2 style="margin: 0;">🏥 ${esc(clinic.Name)}</h2>
                    ${admin ? `<button class="btn btn-warning" id="editClinicBtn">✏️ Edit Clinic Info</button>` : ''}
                </div>
                ${admin ? '<span class="admin-badge">👑 Admin Mode - You can edit clinic information</span>' : ''}
                <div class="detail-section"><h3>📍 Location</h3><p><strong>Type:</strong> ${esc(clinic.Type || 'N/A')}</p><p><strong>Subtype:</strong> ${esc(clinic.Subtype || 'N/A')}</p><p><strong>Sector:</strong> ${esc(clinic.Sector || 'N/A')}</p><p><strong>Province:</strong> ${esc(clinic.Province || 'N/A')}</p>${clinic.district ? `<p><strong>District:</strong> ${esc(clinic.district)}</p>` : ''}</div>
                ${hoursHtml}
                <div class="detail-section" id="contactSection">
                    <h3>📞 Contact Information</h3>
                    <p><strong>Phone:</strong> ${esc(clinic.phone || 'Not available')}</p>
                    <p><strong>Email:</strong> ${esc(clinic.email || 'Not available')}</p>
                    ${clinic.address ? `<p><strong>Address:</strong> ${esc(clinic.address)}${clinic.suburb ? `, ${esc(clinic.suburb)}` : ''}${clinic.city ? `, ${esc(clinic.city)}` : ''}${clinic.postal_code ? `, ${esc(clinic.postal_code)}` : ''}</p>` : ''}
                </div>
                ${ratingHtml}
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-success" id="bookAppointmentBtn" style="flex: 1;">📅 Book Appointment</button>
                    <button class="btn btn-review" id="writeReviewBtn" style="flex: 1;">⭐ Write a Review</button>
                </div>
            </div>
        `;
        contentDiv.innerHTML = html;

        document.getElementById('backToClinicsBtn').addEventListener('click', () => loadClinics());
        if (admin) document.getElementById('editClinicBtn').addEventListener('click', () => showEditForm(clinicId));
        document.getElementById('bookAppointmentBtn').addEventListener('click', () => alert('Booking feature coming soon!'));
        document.getElementById('writeReviewBtn').addEventListener('click', () => openReviewModal(clinicId, clinic.Name));
    } catch (err) {
        contentDiv.innerHTML = `<div class="error">💥 Error: ${esc(err.message)}</div>`;
    }
}

// ========== ADMIN: EDIT CLINIC FORM ==========
async function showEditForm(clinicId) {
    if (!(await isAdmin())) {
        alert('Admin access required.');
        return;
    }
    const { data: clinic, error } = await supabase
        .from('Facilities')
        .select('*')
        .eq('ClinicID', clinicId)
        .single();
    if (error) { alert('Error loading clinic data'); return; }

    const existingForm = document.getElementById('editForm');
    if (existingForm) existingForm.remove();

    const formHtml = `
        <div class="edit-form" id="editForm">
            <h3>✏️ Edit Clinic Information</h3>
            <label>📞 Phone Number:</label>
            <input type="text" id="editPhone" value="${esc(clinic.phone || '')}" placeholder="e.g., 012 345 6789">
            <label>📧 Email Address:</label>
            <input type="email" id="editEmail" value="${esc(clinic.email || '')}" placeholder="e.g., clinic@example.com">
            <label>📍 Street Address:</label>
            <textarea id="editAddress" rows="2" placeholder="Street address">${esc(clinic.address || '')}</textarea>
            <label>🏘️ Suburb/Town:</label>
            <input type="text" id="editSuburb" value="${esc(clinic.suburb || '')}">
            <label>🏙️ City:</label>
            <input type="text" id="editCity" value="${esc(clinic.city || '')}">
            <label>📮 Postal Code:</label>
            <input type="text" id="editPostalCode" value="${esc(clinic.postal_code || '')}">
            <label>🏥 Facility Type:</label>
            <select id="editType">
                <option value="Clinic" ${clinic.Type === 'Clinic' ? 'selected' : ''}>Clinic</option>
                <option value="Hospital" ${clinic.Type === 'Hospital' ? 'selected' : ''}>Hospital</option>
                <option value="Community Health Centre" ${clinic.Type === 'Community Health Centre' ? 'selected' : ''}>Community Health Centre</option>
                <option value="Primary Health Care" ${clinic.Type === 'Primary Health Care' ? 'selected' : ''}>Primary Health Care</option>
            </select>
            <div style="margin-top: 20px;">
                <button class="btn btn-success" id="saveClinicBtn">💾 Save Changes</button>
                <button class="btn btn-secondary" id="cancelEditBtn">Cancel</button>
            </div>
        </div>
    `;
    const contactSection = document.getElementById('contactSection');
    if (contactSection) contactSection.insertAdjacentHTML('afterend', formHtml);
    else document.querySelector('#content > div:last-child').insertAdjacentHTML('beforeend', formHtml);

    document.getElementById('saveClinicBtn').addEventListener('click', () => saveClinicUpdates(clinicId));
    document.getElementById('cancelEditBtn').addEventListener('click', () => document.getElementById('editForm')?.remove());
}

async function saveClinicUpdates(clinicId) {
    const updates = {
        phone: document.getElementById('editPhone')?.value || null,
        email: document.getElementById('editEmail')?.value || null,
        address: document.getElementById('editAddress')?.value || null,
        suburb: document.getElementById('editSuburb')?.value || null,
        city: document.getElementById('editCity')?.value || null,
        postal_code: document.getElementById('editPostalCode')?.value || null,
        Type: document.getElementById('editType')?.value || null,
        updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('Facilities').update(updates).eq('ClinicID', clinicId);
    if (error) alert('Error saving: ' + error.message);
    else { alert('✅ Clinic information updated successfully!'); document.getElementById('editForm')?.remove(); viewClinicDetail(clinicId); }
}

// ========== BOOKING HISTORY ==========
async function loadBookings() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '<div class="loading">📅 Loading your bookings...</div>';
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            contentDiv.innerHTML = `<div class="info">🔐 Please log in to view your bookings.<br><br>⚠️ You need to create an account first.</div><button class="btn btn-primary" id="browseClinicsBtn" style="margin-top: 15px;">← Browse Clinics</button>`;
            document.getElementById('browseClinicsBtn')?.addEventListener('click', () => loadClinics());
            return;
        }
        const { data, error } = await supabase
            .from('Appointments')
            .select('*, Facilities!ClinicID(Name, Province)')
            .eq('PatientID', user.id)
            .order('appointment_date', { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) {
            contentDiv.innerHTML = `<div class="info">📭 You have no bookings yet.</div><button class="btn btn-primary" id="browseClinicsBtn">Browse Clinics to Book</button>`;
            document.getElementById('browseClinicsBtn')?.addEventListener('click', () => loadClinics());
            return;
        }
        allBookings = data;
        const html = `<h2>📅 My Appointments</h2><div class="filter-group"><button class="filter-btn" data-filter="all">All</button><button class="filter-btn" data-filter="upcoming">Upcoming</button><button class="filter-btn" data-filter="completed">Completed</button><button class="filter-btn" data-filter="cancelled">Cancelled</button></div><div id="bookingsList"></div>`;
        contentDiv.innerHTML = html;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentFilter = btn.dataset.filter;
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                displayBookings();
            });
        });
        displayBookings();
    } catch (err) {
        contentDiv.innerHTML = `<div class="error">💥 Error: ${esc(err.message)}</div>`;
    }
}

function displayBookings() {
    let filtered = allBookings;
    const now = new Date();
    if (currentFilter === 'upcoming') filtered = filtered.filter(b => b.appointment_date && new Date(b.appointment_date) > now && b.status !== 'cancelled');
    else if (currentFilter === 'completed') filtered = filtered.filter(b => b.status === 'completed');
    else if (currentFilter === 'cancelled') filtered = filtered.filter(b => b.status === 'cancelled');
    const container = document.getElementById('bookingsList');
    if (!container) return;
    if (filtered.length === 0) { container.innerHTML = '<div class="info">No appointments in this category.</div>'; return; }
    container.innerHTML = filtered.map(apt => `<div class="booking-card ${apt.status === 'cancelled' ? 'cancelled' : (apt.status === 'completed' ? 'completed' : 'scheduled')}"><div style="display:flex; justify-content:space-between; align-items:center;"><h3 style="margin:0;">🏥 ${esc(apt.Facilities?.Name || 'Unknown')}</h3><span class="booking-status status-${apt.status || 'scheduled'}">${esc(apt.status || 'scheduled')}</span></div>${apt.appointment_date ? `<p>📅 ${new Date(apt.appointment_date).toLocaleDateString()}</p>` : ''}${apt.appointment_time ? `<p>⏰ ${apt.appointment_time}</p>` : ''}<p>📍 ${esc(apt.Facilities?.Province || 'N/A')}</p></div>`).join('');
}

// ========== REVIEWS ==========
function openReviewModal(clinicId, clinicName) {
    currentClinicId = clinicId;
    selectedRating = 0;
    document.getElementById('reviewClinicName').innerHTML = `<strong>${esc(clinicName)}</strong>`;
    document.getElementById('reviewComment').value = '';
    document.querySelectorAll('#starContainer .star').forEach(star => star.innerHTML = '☆');
    document.getElementById('reviewModal').style.display = 'block';
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
    currentClinicId = null;
    selectedRating = 0;
}

function setupStars() {
    const starContainer = document.getElementById('starContainer');
    if (!starContainer) return;
    starContainer.addEventListener('click', (e) => {
        const star = e.target.closest('.star');
        if (star) {
            selectedRating = parseInt(star.dataset.rating);
            const stars = document.querySelectorAll('#starContainer .star');
            stars.forEach((s, i) => s.innerHTML = i < selectedRating ? '★' : '☆');
        }
    });
}

async function submitReview() {
    if (selectedRating === 0) { alert('Please select a rating'); return; }
    const comment = document.getElementById('reviewComment').value;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('Please login to submit a review'); return; }
    const { error } = await supabase.from('clinic_reviews').upsert({
        clinic_id: currentClinicId,
        patient_id: user.id,
        rating: selectedRating,
        comment: comment,
        created_at: new Date().toISOString()
    });
    if (error) alert('Error: ' + error.message);
    else { alert('Thank you for your review!'); closeReviewModal(); viewClinicDetail(currentClinicId); }
}

// ========== INITIALISE ==========
function init() {
    document.getElementById('clinicsBtn').addEventListener('click', () => {
        document.getElementById('clinicsBtn').classList.add('active');
        document.getElementById('bookingsBtn').classList.remove('active');
        loadClinics();
    });
    document.getElementById('bookingsBtn').addEventListener('click', () => {
        document.getElementById('bookingsBtn').classList.add('active');
        document.getElementById('clinicsBtn').classList.remove('active');
        loadBookings();
    });
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeReviewModal);
    const submitBtn = document.getElementById('submitReviewBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitReview);
    setupStars();
    loadClinics();
}

init();
=======
const GOOGLE_API_KEY = 'AIzaSyCK6BUjEk1HQq7Pr3kNH3Clif8iSBvM0YI';

let allClinics = [], currentClinicId = null, selectedRating = 0, currentFilter = 'all', allBookings = [];
const gCache = {};

// ── SVG icons (unchanged) ──
const I = {
  pin:   `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  map:   `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
  phone: `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.12 6.12l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  globe: `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  search:`<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  arrow: `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`,
  back:  `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`,
};

// ── GOOGLE PLACES (unchanged) ──
async function searchPlaceId(name, province) {
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask':'places.id' },
      body: JSON.stringify({ textQuery:`${name} ${province} South Africa`, maxResultCount:1, regionCode:'ZA' })
    });
    const d = await r.json();
    return d.places?.[0]?.id || null;
  } catch { return null; }
}

async function getPlaceDetails(id) {
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
      headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask':'id,nationalPhoneNumber,internationalPhoneNumber,formattedAddress,websiteUri,regularOpeningHours,currentOpeningHours,rating,userRatingCount,googleMapsUri,businessStatus,reviews' }
    });
    return await r.json();
  } catch { return null; }
}

async function fetchGoogle(name, province) {
  const key = `${name}|${province}`;
  if (gCache[key] !== undefined) return gCache[key];
  gCache[key] = null;
  const id = await searchPlaceId(name, province);
  if (!id) return null;
  const d = await getPlaceDetails(id);
  gCache[key] = d;
  return d;
}

// ── HELPERS ──
const typeIcon = t => t==='Hospital'?'🏨':t==='Community Health Centre'?'🏘️':'🏥';
const stars = (n, tot=5) => '★'.repeat(n)+'☆'.repeat(tot-n);

// ── CLINIC LIST ──
async function loadClinics() {
  const c = document.getElementById('content');
  c.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><span class="loading-label">Loading facilities…</span></div>`;
  try {
    const { data, error } = await supabase.from('Facilities').select('*').order('Name');
    if (error) throw error;
    allClinics = data || [];
    if (!allClinics.length) {
      c.innerHTML = `<div class="empty-wrap"><div class="empty-icon">🏥</div><div class="empty-title">No clinics found</div></div>`;
      return;
    }
    const provinces = [...new Set(allClinics.map(x=>x.Province).filter(Boolean))].sort();
    c.innerHTML = `
      <div class="hero">
        <div class="hero-pattern"></div>
        <div class="hero-eyebrow">South Africa</div>
        <h1>Public Health Facility Directory</h1>
        <p>Search ${allClinics.length} registered clinics, hospitals and community health centres</p>
        <div class="search-bar">
          <div class="field-wrap">
            <span class="field-icon">${I.search}</span>
            <input class="search-input" type="text" id="searchInput" placeholder="Search by facility name…">
          </div>
          <div class="field-wrap" style="flex:0 0 210px;">
            <span class="field-icon">${I.pin}</span>
            <select class="search-input" id="provinceFilter">
              <option value="">All Provinces</option>
              ${provinces.map(p=>`<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="section-header">
        <span class="section-title">Facilities</span>
        <span class="result-count" id="resultCount">${allClinics.length} results</span>
      </div>
      <div class="clinics-grid" id="clinicsGrid"></div>`;
    const searchInput = document.getElementById('searchInput');
    const provinceFilter = document.getElementById('provinceFilter');
    searchInput.addEventListener('input', filterClinics);
    provinceFilter.addEventListener('change', filterClinics);
    filterClinics();
  } catch(e) {
    c.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function filterClinics() {
  const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const prov = document.getElementById('provinceFilter')?.value || '';
  let list = allClinics;
  if (q) list = list.filter(x => x.Name?.toLowerCase().includes(q));
  if (prov) list = list.filter(x => x.Province === prov);
  list = list.filter(cl => cl.ClinicID && cl.ClinicID !== 'null');
  const rc = document.getElementById('resultCount');
  if (rc) rc.textContent = `${list.length} result${list.length!==1?'s':''}`;
  const grid = document.getElementById('clinicsGrid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = `<div class="empty-wrap" style="grid-column:1/-1"><div class="empty-icon">🔍</div><div class="empty-title">No results found</div><div class="empty-sub">Try adjusting your search or province filter</div></div>`;
    return;
  }
 grid.innerHTML = list.map(cl => `
  <div class="clinic-card" ${cl.ClinicID ? `data-clinic-id="${cl.ClinicID}"` : ''}>
      <div class="card-header-strip"></div>
      <div class="card-body">
        <div class="card-top">
          <div class="facility-icon">${typeIcon(cl.Type)}</div>
          <span class="type-chip">${cl.Type||'Clinic'}</span>
        </div>
        <div class="clinic-name">${cl.Name||'Unnamed Facility'}</div>
        <div class="clinic-meta">
          <div class="meta-item">${I.pin} ${cl.Province||'Unknown'}</div>
          ${cl.district?`<div class="meta-item">${I.map} ${cl.district}</div>`:''}
        </div>
      </div>
      <div class="card-footer">
        <div class="sector-label"><div class="sector-dot"></div>${cl.Sector||'N/A'}</div>
        <button class="view-link">View ${I.arrow}</button>
      </div>
    </div>`).join('');
  // attach click listeners
  document.querySelectorAll('.clinic-card').forEach(card => {
    const clinicId = card.dataset.clinicId;
    if (!clinicId || clinicId === 'null') return; // skip invalid ids
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.view-link')) viewClinicDetail(clinicId);
    });
    const viewBtn = card.querySelector('.view-link');
    if (viewBtn) viewBtn.addEventListener('click', (e) => { e.stopPropagation(); viewClinicDetail(clinicId); });
  });
}

// ── CLINIC DETAIL ──
async function viewClinicDetail(clinicId) {
  if (!clinicId || clinicId === 'null') {
    console.warn('Invalid clinic ID:', clinicId);
    alert('Invalid clinic ID. Please go back and try again.');
    return;
  }
  const c = document.getElementById('content');
  c.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><span class="loading-label">Loading facility details…</span></div>`;
  try {
    const { data:clinic, error } = await supabase.from('Facilities').select('*').eq('ClinicID', clinicId).maybeSingle();
    if (error || !clinic) {
      c.innerHTML = `<div class="alert alert-error">Facility not found.</div>`;
      return;
    }
    const { data:reviews } = await supabase.from('clinic_reviews').select('rating,comment,created_at').eq('clinic_id', clinicId);

    c.innerHTML = `
      <div class="breadcrumb">
        <button class="breadcrumb-btn" id="backToClinicsBtn">${I.back} Facilities</button>
        <span class="breadcrumb-sep">/</span>
        <span>${clinic.Name}</span>
      </div>

      <div class="detail-hero">
        <div class="detail-hero-top"></div>
        <div class="detail-hero-body">
          <div class="detail-hero-left">
            <div class="detail-facility-icon">${typeIcon(clinic.Type)}</div>
            <div class="detail-name">${clinic.Name}</div>
            <div class="chip-row">
              ${clinic.Type?`<span class="chip chip-blue">${clinic.Type}</span>`:''}
              ${clinic.Sector?`<span class="chip chip-grey">${clinic.Sector}</span>`:''}
              ${clinic.Province?`<span class="chip chip-grey">${clinic.Province}</span>`:''}
            </div>
          </div>
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-card">
          <div class="card-title-bar">
            <div class="card-title-icon icon-blue">📋</div>
            <span class="card-title-text">Facility Information</span>
          </div>
          <div class="card-content">
            ${clinic.Subtype?`<div class="info-row"><span class="info-key">Subtype</span><span class="info-val">${clinic.Subtype}</span></div>`:''}
            ${clinic.Province?`<div class="info-row"><span class="info-key">Province</span><span class="info-val">${clinic.Province}</span></div>`:''}
            ${clinic.district?`<div class="info-row"><span class="info-key">District</span><span class="info-val">${clinic.district}</span></div>`:''}
            ${clinic.Sector?`<div class="info-row"><span class="info-key">Sector</span><span class="info-val">${clinic.Sector}</span></div>`:''}
          </div>
        </div>

        <div class="detail-card" id="contactCard">
          <div class="card-title-bar">
            <div class="card-title-icon icon-blue">📞</div>
            <span class="card-title-text">Contact Information</span>
          </div>
          <div class="card-content">
            <div class="inline-loader"><div class="mini-spin"></div>Fetching live contact details…</div>
          </div>
        </div>

        <div class="detail-card" id="hoursCard">
          <div class="card-title-bar">
            <div class="card-title-icon icon-amber">🕒</div>
            <span class="card-title-text">Operating Hours</span>
          </div>
          <div class="card-content">
            <div class="inline-loader"><div class="mini-spin"></div>Fetching live hours…</div>
          </div>
        </div>

        <div class="detail-card full" id="reviewsCard">
          <div class="card-title-bar">
            <div class="card-title-icon icon-amber">⭐</div>
            <span class="card-title-text">Ratings &amp; Reviews</span>
          </div>
          <div class="card-content">
            <div class="inline-loader"><div class="mini-spin"></div>Loading reviews…</div>
          </div>
        </div>

        <div style="grid-column:1/-1;">
          <button class="write-review-btn" id="writeReviewBtn" data-clinic-id="${clinic.ClinicID}" data-clinic-name="${clinic.Name.replace(/'/g,"\\'")}">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Submit a Patient Review
          </button>
        </div>
      </div>`;

    document.getElementById('backToClinicsBtn').addEventListener('click', loadClinics);
    const writeReviewBtn = document.getElementById('writeReviewBtn');
    if (writeReviewBtn) {
      writeReviewBtn.addEventListener('click', () => {
        const id = writeReviewBtn.dataset.clinicId;
        const name = writeReviewBtn.dataset.clinicName;
        openReviewModal(id, name);
      });
    }
    loadGoogleData(clinic, reviews||[]);
  } catch(e) {
    c.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

async function loadGoogleData(clinic, patientReviews) {
  const g = await fetchGoogle(clinic.Name, clinic.Province);

  // Contact card
  const cc = document.getElementById('contactCard');
  if (cc) {
    const phone = g?.nationalPhoneNumber||g?.internationalPhoneNumber;
    const addr  = g?.formattedAddress;
    const web   = g?.websiteUri;
    const maps  = g?.googleMapsUri;
    let rows = '';
    if (g) rows += `<div class="live-tag"><div class="live-dot"></div>Live · Google Places</div>`;
    if (phone) rows += `<div class="info-row"><span class="info-key">${I.phone} Phone</span><span class="info-val"><a href="tel:${phone}">${phone}</a></span></div>`;
    if (addr)  rows += `<div class="info-row"><span class="info-key">${I.pin} Address</span><span class="info-val">${addr}</span></div>`;
    if (web)   rows += `<div class="info-row"><span class="info-key">${I.globe} Website</span><span class="info-val"><a href="${web}" target="_blank">${web.replace(/^https?:\/\//,'').replace(/\/$/,'')}</a></span></div>`;
    if (maps)  rows += `<div class="info-row"><span class="info-key">${I.map} Maps</span><span class="info-val"><a href="${maps}" target="_blank">Open in Google Maps →</a></span></div>`;
    if (!phone && !addr && !web) {
      if (clinic.phone) rows += `<div class="info-row"><span class="info-key">${I.phone} Phone</span><span class="info-val">${clinic.phone}</span></div>`;
      if (clinic.email) rows += `<div class="info-row"><span class="info-key">✉ Email</span><span class="info-val"><a href="mailto:${clinic.email}">${clinic.email}</a></span></div>`;
      if (clinic.address) rows += `<div class="info-row"><span class="info-key">${I.pin} Address</span><span class="info-val">${[clinic.address,clinic.suburb,clinic.city].filter(Boolean).join(', ')}</span></div>`;
      if (!clinic.phone && !clinic.email && !clinic.address) rows = `<span style="font-size:12px;color:var(--grey-400)">No contact details available.</span>`;
    }
    cc.innerHTML = `
      <div class="card-title-bar"><div class="card-title-icon icon-blue">📞</div><span class="card-title-text">Contact Information</span></div>
      <div class="card-content">${rows}</div>`;
  }

  // Hours card
  const hc = document.getElementById('hoursCard');
  if (hc) {
    const oh = g?.currentOpeningHours||g?.regularOpeningHours;
    let titleExtra = '';
    if (oh?.openNow !== undefined) titleExtra = `<span class="status-pill ${oh.openNow?'pill-open':'pill-closed'}">${oh.openNow?'● Open Now':'● Closed'}</span>`;
    let body = '';
    if (oh?.weekdayDescriptions?.length) {
      body += `<div class="live-tag"><div class="live-dot"></div>Live · Google Places</div><div class="hours-table">`;
      const today = new Date().getDay();
      oh.weekdayDescriptions.forEach((desc,i) => {
        const jsDay = (i+1)%7, isToday = jsDay===today;
        const [day,...rest] = desc.split(': ');
        body += `<div class="hour-row ${isToday?'today':''}"><span class="hour-day">${day}${isToday?' (Today)':''}</span><span class="hour-time">${rest.join(': ')||'Closed'}</span></div>`;
      });
      body += `</div>`;
    } else {
      const { data:hrs } = await supabase.from('Operating_Hours').select('*').eq('clinicid', clinic.ClinicID);
      if (hrs?.length) {
        body = `<div class="hours-table">${hrs.map(h=>`<div class="hour-row"><span class="hour-day">${h.day}</span><span class="hour-time">${h.opentime||'--'} – ${h.closingtime||'--'}</span></div>`).join('')}</div>`;
      } else {
        body = `<span style="font-size:12px;color:var(--grey-400)">Operating hours not available.</span>`;
      }
    }
    hc.innerHTML = `
      <div class="card-title-bar"><div class="card-title-icon icon-amber">🕒</div><span class="card-title-text">Operating Hours</span>${titleExtra}</div>
      <div class="card-content">${body}</div>`;
  }

  // Reviews card
  const rc = document.getElementById('reviewsCard');
  if (rc) {
    const hasP = patientReviews?.length>0;
    const hasG = g?.reviews?.length>0;
    let body = '';
    if (g?.rating) {
      body += `<div class="rating-block"><div class="rating-num">${g.rating}</div><div><div class="rating-stars">${stars(Math.round(g.rating))}</div><div class="rating-label">${g.userRatingCount?.toLocaleString()||''} Google reviews</div></div></div>`;
    }
    if (hasP) {
      const avg = (patientReviews.reduce((a,b)=>a+b.rating,0)/patientReviews.length).toFixed(1);
      body += `<div class="patient-summary">🩺 Patient average: ${avg} / 5 &nbsp;·&nbsp; ${patientReviews.length} review${patientReviews.length!==1?'s':''}</div>`;
    }
    if (!hasP && !hasG) {
      body += `<div class="no-reviews"><div class="no-reviews-icon">💬</div>No reviews yet — be the first to submit one.</div>`;
    } else {
      body += `<div class="review-tabs">
        ${hasP?`<button class="rtab active" data-tab="P">🩺 Patient Reviews (${patientReviews.length})</button>`:''}
        ${hasG?`<button class="rtab ${!hasP?'active':''}" data-tab="G">🌐 Google Reviews (${g.reviews.length})</button>`:''}
      </div>`;
      if (hasP) body += `<div id="panelP" class="review-panel">${patientReviews.slice(0,5).map(r=>`
        <div class="review-item">
          <div class="review-top"><span class="r-name">🩺 Patient</span><span class="r-stars">${stars(r.rating)}</span></div>
          ${r.comment?`<div class="r-text">${r.comment}</div>`:''}
          <div class="r-meta">${new Date(r.created_at).toLocaleDateString('en-ZA',{year:'numeric',month:'short',day:'numeric'})}</div>
        </div>`).join('')}</div>`;
      if (hasG) body += `<div id="panelG" class="review-panel" style="display:${hasP?'none':'block'}">
        <div class="live-tag" style="margin-bottom:12px"><div class="live-dot"></div>Live · Google Places</div>
        ${g.reviews.slice(0,5).map(r=>`
        <div class="review-item">
          <div class="review-top"><span class="r-name">${r.authorAttribution?.displayName||'Google Reviewer'}</span><span class="r-stars">${stars(r.rating)}</span></div>
          ${r.text?.text?`<div class="r-text">${r.text.text.slice(0,300)}${r.text.text.length>300?'…':''}</div>`:''}
          <div class="r-meta">${r.relativePublishTimeDescription||''}</div>
        </div>`).join('')}
      </div>`;
    }
    rc.innerHTML = `
      <div class="card-title-bar"><div class="card-title-icon icon-amber">⭐</div><span class="card-title-text">Ratings &amp; Reviews</span></div>
      <div class="card-content">${body}</div>`;
    // attach tab listeners
    document.querySelectorAll('.rtab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.rtab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.review-panel').forEach(panel => panel.style.display = 'none');
        const activePanel = document.getElementById(`panel${tab}`);
        if (activePanel) activePanel.style.display = 'block';
      });
    });
  }
}

// ── BOOKINGS ──
async function loadBookings() {
  const c = document.getElementById('content');
  c.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><span class="loading-label">Loading bookings…</span></div>`;
  try {
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) {
      c.innerHTML = `<div class="alert alert-info">🔐 Please log in to view your appointment history.</div>`;
      return;
    }
    const { data, error } = await supabase.from('Appointments').select('*, Facilities!ClinicID(Name,Province)').eq('PatientID', user.id).order('appointment_date', { ascending:false });
    if (error) throw error;
    if (!data?.length) {
      c.innerHTML = `<div class="empty-wrap"><div class="empty-icon">📅</div><div class="empty-title">No appointments found</div><div class="empty-sub">Your appointment history will appear here once bookings are made</div></div>`;
      return;
    }
    allBookings = data;
    c.innerHTML = `
      <div class="page-heading">My Appointments</div>
      <div class="filter-bar">
        <button class="filter-pill" data-filter="all">All (${data.length})</button>
        <button class="filter-pill" data-filter="upcoming">Upcoming</button>
        <button class="filter-pill" data-filter="completed">Completed</button>
        <button class="filter-pill" data-filter="cancelled">Cancelled</button>
      </div>
      <div id="bookingsList"></div>`;
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        displayBookings();
        document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    displayBookings();
  } catch(e) {
    c.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function displayBookings() {
  let list = allBookings;
  const now = new Date();
  if (currentFilter==='upcoming') list=list.filter(b=>b.appointment_date&&new Date(b.appointment_date)>now&&b.status!=='cancelled');
  else if (currentFilter==='completed') list=list.filter(b=>b.status==='completed');
  else if (currentFilter==='cancelled') list=list.filter(b=>b.status==='cancelled');
  const el = document.getElementById('bookingsList');
  if (!el) return;
  if (!list.length) { el.innerHTML=`<div class="alert alert-info">No appointments in this category.</div>`; return; }
  const sIcon=s=>s==='completed'?'✅':s==='cancelled'?'❌':'📅';
  const sCls=s=>s==='completed'?'done':s==='cancelled'?'cancelled':'';
  const bCls=s=>s==='completed'?'badge-completed':s==='cancelled'?'badge-cancelled':'badge-scheduled';
  el.innerHTML=list.map(a=>`
    <div class="booking-item">
      <div class="booking-icon-wrap ${sCls(a.status)}">${sIcon(a.status)}</div>
      <div class="booking-info">
        <div class="booking-facility">${a.Facilities?.Name||'Unknown Facility'}</div>
        <div class="booking-sub">
          ${a.appointment_date?new Date(a.appointment_date).toLocaleDateString('en-ZA',{weekday:'short',year:'numeric',month:'short',day:'numeric'}):''}
          ${a.appointment_time?' · '+a.appointment_time:''}
          ${a.Facilities?.Province?' · '+a.Facilities.Province:''}
        </div>
      </div>
      <span class="booking-badge ${bCls(a.status)}">${a.status||'Scheduled'}</span>
    </div>`).join('');
}

function setFilter(f) {
  currentFilter=f; displayBookings();
  document.querySelectorAll('.filter-pill').forEach(b=>b.classList.toggle('active', b.textContent.toLowerCase().startsWith(f)));
}

// ── REVIEWS MODAL ──
function openReviewModal(clinicId, name) {
  currentClinicId=clinicId;
  selectedRating=0;
  document.getElementById('reviewClinicName').textContent=name;
  document.getElementById('reviewComment').value='';
  document.querySelectorAll('#starContainer .star').forEach(s=>s.classList.remove('lit'));
  document.getElementById('reviewModal').classList.add('open');
}

function closeReviewModal(){
  document.getElementById('reviewModal').classList.remove('open');
  currentClinicId=null; selectedRating=0;
}

function setupStarContainer() {
  const starContainer = document.getElementById('starContainer');
  if (!starContainer) return;
  starContainer.addEventListener('click', e=>{
    const s=e.target.closest('.star'); if(!s) return;
    selectedRating=parseInt(s.dataset.rating);
    document.querySelectorAll('#starContainer .star').forEach((star,i)=>star.classList.toggle('lit',i<selectedRating));
  });
}

async function submitReview() {
  if (!selectedRating) {
    alert('Please select a star rating.');
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Please log in to submit a review.');
    return;
  }
  
  // Store the clinic ID BEFORE closing the modal
  const clinicId = currentClinicId;
  if (!clinicId) {
    alert('Clinic information is missing. Please refresh and try again.');
    return;
  }
  
  const { error } = await supabase.from('clinic_reviews').insert({
    clinic_id: clinicId,
    patient_id: user.id,
    rating: selectedRating,
    comment: document.getElementById('reviewComment').value,
    created_at: new Date().toISOString()
  });
  
  if (error) {
    alert('Error: ' + error.message);
  } else {
    closeReviewModal();           // this resets currentClinicId to null, but we already saved it
    viewClinicDetail(clinicId);   // use the saved ID
  }
}

// ── NAVIGATION ──
document.getElementById('clinicsBtn').addEventListener('click', () => {
  document.getElementById('clinicsBtn').classList.add('active');
  document.getElementById('bookingsBtn').classList.remove('active');
  loadClinics();
});
document.getElementById('bookingsBtn').addEventListener('click', () => {
  document.getElementById('bookingsBtn').classList.add('active');
  document.getElementById('clinicsBtn').classList.remove('active');
  loadBookings();
});
document.getElementById('closeModalBtn').addEventListener('click', closeReviewModal);
document.getElementById('submitReviewBtn').addEventListener('click', submitReview);
setupStarContainer();

// Start the app
loadClinics();
>>>>>>> Classes
