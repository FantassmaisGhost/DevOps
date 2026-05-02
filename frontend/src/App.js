import React from 'react';
import StaffDashboard from './components/StaffDashboard';

function App() {
    // Hardcoded staff info for now
    const staffInfo = {
        clinicId: 'clinic_001',
        staffId: 'staff_001',
        staffName: 'Dr. Smith'
    };
    
    return (
        <StaffDashboard 
            clinicId={staffInfo.clinicId}
            staffId={staffInfo.staffId}
            staffName={staffInfo.staffName}
        />
    );
}

export default App;