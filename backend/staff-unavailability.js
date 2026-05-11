import { supabase } from './supabase.js';

let currentStaff = null;

async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/pages/index.html';
        return;
    }

    document.getElementById('userEmail').textContent = session.user.email;

    const { data: staff, error } = await supabase
        .from('Staff')
        .select('*')
        .eq('email', session.user.email)
        .single();

    if (error || !staff) {
        window.location.href = '/pages/staff-dashboard.html';
        return;
    }

    currentStaff = staff;

    
    document.getElementById('inputDate').min = new Date().toISOString().split('T')[0];

    document.getElementById('addBtn').addEventListener('click', addUnavailability);

    await renderList();
}

async function renderList() {
    const listEl = document.getElementById('unavailList');
    listEl.innerHTML = '<div class="empty-state">Loading...</div>';

    const { data, error } = await supabase
        .from('staff_unavail')
        .select('*')
        .eq('Staff_id', currentStaff.id)
        .order('Date', { ascending: true })
        .order('Start', { ascending: true });

    if (error) {
        listEl.innerHTML = '<div class="empty-state">Failed to load data.</div>';
        showToast('Failed to load unavailability', true);
        return;
    }

    if (!data || data.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No unavailable periods set yet.</div>';
        return;
    }

    listEl.innerHTML = data.map(row => `
        <article class="unavail-item">
            <section class="unavail-info">
                <span class="unavail-date">${formatDate(row.Date)}</span>
                <span class="unavail-time">${formatTimeRange(row.Start, row.End)}</span>
            </section>
            <button class="delete-btn" data-id="${row.id}">Remove</button>
        </article>
    `).join('');


    listEl.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteEntry(btn.getAttribute('data-id')));
    });
}

async function addUnavailability() {
    const date  = document.getElementById('inputDate').value;
    const start = document.getElementById('inputStart').value || null;
    const end   = document.getElementById('inputEnd').value   || null;

    if (!date) {
        showToast('Please select a date', true);
        return;
    }

    if ((start && !end) || (!start && end)) {
        showToast('Please provide both start and end time, or leave both empty for a full day', true);
        return;
    }

    if (start && end && start >= end) {
        showToast('Start time must be before end time', true);
        return;
    }

    const { error } = await supabase
        .from('staff_unavail')
        .insert({
            Staff_id: currentStaff.id,
            Date: date,
            Start: start,
            End: end,
        });

    if (error) {
        showToast('Failed to save: ' + error.message, true);
        return;
    }

    document.getElementById('inputDate').value  = '';
    document.getElementById('inputStart').value = '';
    document.getElementById('inputEnd').value   = '';

    showToast('Unavailable period saved!');
    await renderList();
}

async function deleteEntry(id) {
    if (!confirm('Remove this unavailable period?')) return;

    const { error } = await supabase
        .from('staff_unavail')
        .delete()
        .eq('id', id);

    if (error) {
        showToast('Failed to delete: ' + error.message, true);
        return;
    }

    showToast('Removed successfully');
    await renderList();
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':');
    const hour   = parseInt(h);
    const ampm   = hour >= 12 ? 'PM' : 'AM';
    const h12    = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

function formatTimeRange(start, end) {
    if (!start && !end) return 'All day';
    return `${formatTime(start)} – ${formatTime(end)}`;
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className   = `toast${isError ? ' error' : ''} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
});

init();