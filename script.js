// ============================================
// SINGLE DECLARATION - NO DUPLICATES
// ============================================
const MY_SUPABASE_URL = 'https://ixikhufrylaugpdxokwu.supabase.co';
const MY_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4aWtodWZyeWxhdWdwZHhva3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTQ0NTIsImV4cCI6MjA5MTIzMDQ1Mn0.F7g_bNWAsxjWtkHihVNYPicghiKOisgHGV9-zaBjXvQ';

// Create client with unique name
const mySupabase = window.supabase.createClient(MY_SUPABASE_URL, MY_SUPABASE_KEY);

console.log('App started');

// Main function to show clinics
async function showClinics() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '<p>Loading clinics...</p>';
    
    const { data: clinics, error } = await mySupabase
        .from('Facilities')
        .select('ClinicID, Name, Type, Province')
        .limit(10);
    
    if (error) {
        contentDiv.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
        return;
    }
    
    if (!clinics || clinics.length === 0) {
        contentDiv.innerHTML = '<p>No clinics found. Please add data to the Facilities table.</p>';
        return;
    }
    
    let html = '<h2>🏥 Clinics</h2><div style="display:grid;gap:15px;">';
    clinics.forEach(clinic => {
        html += `
            <div style="border:1px solid #ddd;padding:15px;border-radius:8px;">
                <h3>${clinic.Name || 'Unknown'}</h3>
                <p>Type: ${clinic.Type || 'N/A'}</p>
                <p>Province: ${clinic.Province || 'N/A'}</p>
                <button onclick="viewClinic('${clinic.ClinicID}')" style="background:#3498db;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">View Details</button>
            </div>
        `;
    });
    html += '</div>';
    contentDiv.innerHTML = html;
}

// View clinic details
window.viewClinic = async function(clinicId) {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '<p>Loading details...</p>';
    
    const { data: clinic, error } = await mySupabase
        .from('Facilities')
        .select('*')
        .eq('ClinicID', clinicId)
        .single();
    
    if (error) {
        contentDiv.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
        return;
    }
    
    contentDiv.innerHTML = `
        <button onclick="showClinics()" style="background:#666;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;margin-bottom:20px;">← Back</button>
        <div style="background:white;padding:20px;border-radius:8px;">
            <h2>${clinic.Name || 'Unknown Clinic'}</h2>
            <p><strong>Type:</strong> ${clinic.Type || 'N/A'}</p>
            <p><strong>Subtype:</strong> ${clinic.Subtype || 'N/A'}</p>
            <p><strong>Sector:</strong> ${clinic.Sector || 'N/A'}</p>
            <p><strong>Province:</strong> ${clinic.Province || 'N/A'}</p>
            <button onclick="alert('Booking coming soon!')" style="background:#27ae60;color:white;border:none;padding:10px;border-radius:4px;cursor:pointer;margin-top:20px;width:100%;">Book Appointment</button>
        </div>
    `;
};

// Make function global
window.showClinics = showClinics;

// Start the app when page loads
showClinics();