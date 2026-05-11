// clinic_app.js
import { supabase } from './supabase.js';
import { Utils } from './utils.js';

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