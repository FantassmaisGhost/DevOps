import { supabase } from './supabase.js';
import { Utils } from './utils.js';

const esc = Utils.esc;
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

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inputDate').min = today;
    document.getElementById('inputStart').min = '08:00';
    document.getElementById('inputStart').max = '17:00';
    document.getElementById('inputEnd').min = '08:00';
    document.getElementById('inputEnd').max = '17:00';

    document.getElementById('addBtn').addEventListener('click', addUnavailability);
    await renderList();
}

async function renderList() {
    const listEl = document.getElementById('unavailList');
    listEl.innerHTML = '<div class="loading-state" style="padding:40px; text-align:center;">Loading...</div>';
    const { data, error } = await supabase
        .from('staff_unavail')
        .select('*')
        .eq('Staff_id', currentStaff.id)
        .order('Date', { ascending: true })
        .order('Start', { ascending: true });

    if (error) {
        listEl.innerHTML = '<div class="error-state">Failed to load data.</div>';
        showToast('Failed to load', true);
        return;
    }
    if (!data || data.length === 0) {
        listEl.innerHTML = '<div class="empty-state" style="text-align:center; padding:40px; color:var(--ink-3);">No unavailable periods set yet.</div>';
        return;
    }
    listEl.innerHTML = data.map(row => `
        <div class="unavail-item" style="display:flex; justify-content:space-between; align-items:center; padding:14px 20px; border-bottom:1px solid var(--border);">
            <div><div class="unavail-date" style="font-weight:600;">${formatDate(row.Date)}</div><div class="unavail-time" style="font-size:13px; color:var(--ink-3);">${formatTimeRange(row.Start, row.End)}</div></div>
            <button class="delete-btn" data-id="${row.id}" style="background:transparent; border:1px solid var(--rust); color:var(--rust); border-radius:var(--radius-sm); padding:5px 12px; cursor:pointer;">Remove</button>
        </div>
    `).join('');
    listEl.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteEntry(btn.getAttribute('data-id')));
    });
}

async function markClashingAppointments(date, start, end) {
    const { data: appointments, error } = await supabase
        .from('Appointments')
        .select('id, appointment_time')
        .eq('StaffID', currentStaff.id)
        .eq('appointment_date', date)
        .eq('status', 'waiting');
    if (error || !appointments?.length) return;
    const toMark = appointments.filter(apt => {
        const aptTime = apt.appointment_time?.slice(0,5);
        if (!start && !end) return true;
        return aptTime >= start && aptTime < end;
    }).map(apt => apt.id);
    if (toMark.length) {
        await supabase.from('Appointments').update({ status: 'unavailable' }).in('id', toMark);
    }
}

async function revertClashingAppointments(date, start, end) {
    const { data: appointments, error } = await supabase
        .from('Appointments')
        .select('id, appointment_time')
        .eq('StaffID', currentStaff.id)
        .eq('appointment_date', date)
        .eq('status', 'unavailable');
    if (error || !appointments?.length) return;
    const toRevert = appointments.filter(apt => {
        const aptTime = apt.appointment_time?.slice(0,5);
        if (!start && !end) return true;
        return aptTime >= start && aptTime < end;
    }).map(apt => apt.id);
    if (toRevert.length) {
        await supabase.from('Appointments').update({ status: 'waiting' }).in('id', toRevert);
    }
}

async function addUnavailability() {
    const date = document.getElementById('inputDate').value;
    let start = document.getElementById('inputStart').value || null;
    let end = document.getElementById('inputEnd').value || null;
    if (!date) { showToast('Please select a date', true); return; }
    if ((start && !end) || (!start && end)) { showToast('Provide both start and end, or leave both empty', true); return; }
    if (start && end && start >= end) { showToast('Start time must be before end time', true); return; }
    if (start && end && (start < '08:00' || start > '17:00' || end < '08:00' || end > '17:00')) { showToast('Hours must be between 08:00 and 17:00', true); return; }

    const { error } = await supabase.from('staff_unavail').insert({ Staff_id: currentStaff.id, Date: date, Start: start, End: end });
    if (error) { showToast('Failed to save: ' + error.message, true); return; }
    await markClashingAppointments(date, start, end);

    document.getElementById('inputDate').value = '';
    document.getElementById('inputStart').value = '';
    document.getElementById('inputEnd').value = '';
    showToast('Unavailable period saved!');
    await renderList();
}

async function deleteEntry(id) {
    if (!confirm('Remove this unavailable period?')) return;
    const { data: record, error: fetchError } = await supabase.from('staff_unavail').select('*').eq('id', id).single();
    if (fetchError || !record) { showToast('Record not found', true); return; }
    const { error } = await supabase.from('staff_unavail').delete().eq('id', id);
    if (error) { showToast('Failed to delete: ' + error.message, true); return; }
    await revertClashingAppointments(record.Date, record.Start, record.End);
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
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}
function formatTimeRange(start, end) {
    if (!start && !end) return 'All day';
    return `${formatTime(start)} – ${formatTime(end)}`;
}
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${isError ? 'error' : 'success'} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
    localStorage.removeItem('userRole');
    await supabase.auth.signOut();
    window.location.href = '/pages/index.html';
});

init();