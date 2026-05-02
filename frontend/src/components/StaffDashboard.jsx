import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import io from 'socket.io-client';

const supabase = createClient(
    'https://ixikhufrylaugpdxokwu.supabase.co',
    'sb_publishable_7T38wLjTEs7UJKMMTxl9tQ_OLM6Wsf3'
);

const StaffDashboard = ({ staffId, staffName }) => {
    const [queue, setQueue] = useState([]);
    const [clinics, setClinics] = useState([]);
    const [selectedClinic, setSelectedClinic] = useState('all');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [summary, setSummary] = useState({
        total_waiting: 0,
        in_consultation_count: 0,
        completed: 0,
        cancelled: 0,
        total_for_date: 0,
        average_wait_minutes: 0
    });
    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const fetchClinics = async () => {
        try {
            const { data, error } = await supabase
                .from('Facilities')
                .select('"ClinicID", "Name", "Type", "Province"')
                .order('"Name"', { ascending: true });
            
            if (error) throw error;
            setClinics(data || []);
        } catch (err) {
            console.error('Error fetching clinics:', err);
        }
    };
    
    useEffect(() => {
        fetchClinics();
        
        const newSocket = io('http://localhost:3001', {
            auth: { userId: staffId, role: 'staff', clinicId: selectedClinic === 'all' ? null : selectedClinic }
        });
        setSocket(newSocket);
        
        newSocket.on('queue:updated', () => {
            fetchQueueFromDB();
            fetchSummary();
        });
        
        fetchQueueFromDB();
        fetchSummary();
        
        const interval = setInterval(() => {
            fetchQueueFromDB();
            fetchSummary();
        }, 10000);
        
        return () => {
            newSocket.close();
            clearInterval(interval);
        };
    }, [selectedClinic, selectedDate]);
    
    const fetchQueueFromDB = async () => {
        try {
            let query = supabase
                .from('Appointments')
                .select('*')
                .eq('appointment_date', selectedDate)
                .in('status', ['waiting', 'in_consultation'])
                .order('arrived_at', { ascending: true });
            
            if (selectedClinic !== 'all') {
                query = query.eq('ClinicID', selectedClinic);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            const now = new Date();
            const formattedQueue = (data || []).map((item, idx) => {
                let waitMinutes = 0;
                let waitDisplay = '';
                let waitColor = '#6b7280';
                
                if (item.arrived_at) {
                    const arrived = new Date(item.arrived_at);
                    waitMinutes = Math.floor((now - arrived) / 60000);
                    
                    if (waitMinutes < 60) {
                        waitDisplay = `${waitMinutes} min`;
                    } else {
                        const hours = Math.floor(waitMinutes / 60);
                        const mins = waitMinutes % 60;
                        waitDisplay = `${hours}h ${mins}m`;
                    }
                    
                    if (waitMinutes > 60) waitColor = '#dc2626';
                    else if (waitMinutes > 30) waitColor = '#f59e0b';
                    else if (waitMinutes > 15) waitColor = '#eab308';
                    else waitColor = '#10b981';
                }
                
                return {
                    appointment_id: item.id,
                    queue_position: idx + 1,
                    patient_name: item.patient_name,
                    waiting_minutes: waitMinutes,
                    wait_display: waitDisplay,
                    wait_color: waitColor,
                    patient_status: item.status,
                    is_walk_in: item.is_walk_in || false,
                    arrived_at: item.arrived_at,
                    arrived_time: item.arrived_at ? new Date(item.arrived_at).toLocaleTimeString() : 'Unknown',
                    clinic_id: item.ClinicID,
                    reason: item.reason || 'General checkup',
                    appointment_date: item.appointment_date
                };
            });
            
            setQueue(formattedQueue);
            setError(null);
        } catch (err) {
            console.error('Error in fetchQueueFromDB:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const fetchSummary = async () => {
        try {
            let query = supabase
                .from('Appointments')
                .select('status, actual_wait_seconds, ClinicID, appointment_date')
                .eq('appointment_date', selectedDate);
            
            if (selectedClinic !== 'all') {
                query = query.eq('ClinicID', selectedClinic);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            if (!data) return;
            
            const waiting = data.filter(a => a.status === 'waiting').length;
            const inConsultation = data.filter(a => a.status === 'in_consultation').length;
            const completed = data.filter(a => a.status === 'complete').length;
            const cancelled = data.filter(a => a.status === 'cancelled').length;
            const total = data.length;
            
            const completedWithWait = data.filter(a => a.status === 'complete' && a.actual_wait_seconds);
            let avgWait = 0;
            if (completedWithWait.length > 0) {
                const totalWait = completedWithWait.reduce((sum, a) => sum + (a.actual_wait_seconds || 0), 0);
                avgWait = Math.round(totalWait / completedWithWait.length / 60);
            }
            
            setSummary({
                total_waiting: waiting,
                in_consultation_count: inConsultation,
                completed: completed,
                cancelled: cancelled,
                total_for_date: total,
                average_wait_minutes: avgWait
            });
        } catch (err) {
            console.error('Error in fetchSummary:', err);
        }
    };
    
    // const changeStatus = async (appointmentId, newStatus) => {
    //     try {
    //         const appointment = queue.find(a => a.appointment_id === appointmentId);
    //         const today = new Date().toISOString().split('T')[0];
            
    //         // Validation for future dates
    //         if (newStatus === 'in_consultation' && appointment?.appointment_date > today) {
    //             alert(`Cannot start consultation. This patient is booked for ${appointment?.appointment_date}. Only today's (${today}) appointments can be attended.`);
    //             return;
    //         }
            
    //         if (newStatus === 'complete' && appointment?.appointment_date > today) {
    //             alert(`Cannot complete consultation. This patient is booked for ${appointment?.appointment_date}. Only today's (${today}) appointments can be attended.`);
    //             return;
    //         }
            
    //         const updateData = { status: newStatus };
            
    //         if (newStatus === 'complete' && appointment && appointment.arrived_at) {
    //             const arrived = new Date(appointment.arrived_at);
    //             const now = new Date();
    //             updateData.actual_wait_seconds = Math.floor((now - arrived) / 1000);
    //             updateData.consultation_ended_at = new Date().toISOString();
    //         }
            
    //         if (newStatus === 'in_consultation') {
    //             updateData.consultation_started_at = new Date().toISOString();
    //         }
            
    //         if (newStatus === 'cancelled') {
    //             updateData.cancelled_at = new Date().toISOString();
    //         }
            
    //         console.log('Updating appointment:', appointmentId, 'to status:', newStatus);
            
    //         const { error } = await supabase
    //             .from('Appointments')
    //             .update(updateData)
    //             .eq('id', appointmentId);
            
    //         if (error) {
    //             console.error('Supabase error:', error);
    //             alert('Error changing status: ' + error.message);
    //             return;
    //         }
            
    //         console.log('Update successful');
            
    //         // Refresh the data
    //         await fetchQueueFromDB();
    //         await fetchSummary();
            
    //         if (socket) {
    //             socket.emit('status:update', {
    //                 appointmentId,
    //                 newStatus,
    //                 staffId,
    //                 clinicId: selectedClinic
    //             });
    //         }
            
    //         if (newStatus === 'cancelled') {
    //             alert('Appointment cancelled successfully!');
    //         }
            
    //     } catch (err) {
    //         console.error('Error in changeStatus:', err);
    //         alert('Error changing status: ' + err.message);
    //     }
    // };
    const changeStatus = async (appointmentId, newStatus) => {
    try {
        const appointment = queue.find(a => a.appointment_id === appointmentId);
        const today = new Date().toISOString().split('T')[0];
        
        if (newStatus === 'in_consultation' && appointment?.appointment_date > today) {
            alert(`Cannot start consultation. This patient is booked for ${appointment?.appointment_date}. Only today's (${today}) appointments can be attended.`);
            return;
        }
        
        if (newStatus === 'complete' && appointment?.appointment_date > today) {
            alert(`Cannot complete consultation. This patient is booked for ${appointment?.appointment_date}. Only today's (${today}) appointments can be attended.`);
            return;
        }
        
        const updateData = { status: newStatus };
        
        if (newStatus === 'complete' && appointment && appointment.arrived_at) {
            const arrived = new Date(appointment.arrived_at);
            const now = new Date();
            updateData.actual_wait_seconds = Math.floor((now - arrived) / 1000);
            updateData.consultation_ended_at = new Date().toISOString();
        }
        
        if (newStatus === 'in_consultation') {
            updateData.consultation_started_at = new Date().toISOString();
        }
        
        if (newStatus === 'cancelled') {
            updateData.cancelled_at = new Date().toISOString();
        }
        
        const { error } = await supabase
            .from('Appointments')
            .update(updateData)
            .eq('id', appointmentId);
        
        if (error) {
            console.error('Supabase error:', error);
            alert('Error changing status: ' + error.message);
            return;
        }
        
        await fetchQueueFromDB();
        await fetchSummary();
        
        if (socket) {
            socket.emit('status:update', {
                appointmentId,
                newStatus,
                staffId,
                clinicId: selectedClinic
            });
        }
        
        if (newStatus === 'cancelled') {
            alert('Appointment cancelled successfully!');
        }
        
    } catch (err) {
        console.error('Error in changeStatus:', err);
        alert('Error changing status: ' + err.message);
    }
};
    const completeConsultation = async (appointmentId) => {
        await changeStatus(appointmentId, 'complete');
    };
    
    const startConsultation = async (appointmentId) => {
        await changeStatus(appointmentId, 'in_consultation');
    };
    
    const cancelAppointment = async (appointmentId) => {
        if (window.confirm('Are you sure you want to cancel this appointment?')) {
            await changeStatus(appointmentId, 'cancelled');
        }
    };
    
    const callNextPatient = async () => {
        const nextWaiting = queue.find(p => p.patient_status === 'waiting');
        
        if (!nextWaiting) {
            alert('No patients waiting in queue for this date.');
            return;
        }
        
        await startConsultation(nextWaiting.appointment_id);
    };
    
    const getClinicName = () => {
        if (selectedClinic === 'all') return 'All Clinics';
        const clinic = clinics.find(c => c.ClinicID === selectedClinic);
        return clinic ? `${clinic.Name} (${clinic.ClinicID})` : selectedClinic;
    };
    
    const formatDate = (dateString) => {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };
    
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    const isFuture = selectedDate > new Date().toISOString().split('T')[0];
    const isPast = selectedDate < new Date().toISOString().split('T')[0];
    
    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h2>Loading Dashboard...</h2>
            </div>
        );
    }
    
    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>
                <h2>Error Loading Data</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }
    
    const currentPatient = queue.find(p => p.patient_status === 'in_consultation');
    const waitingPatients = queue.filter(p => p.patient_status === 'waiting');
    
    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                    <h1>🏥 Clinic Queue Management Dashboard</h1>
                    <p>Welcome, {staffName || 'Staff Member'}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select 
                        value={selectedClinic} 
                        onChange={(e) => setSelectedClinic(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', cursor: 'pointer' }}
                    >
                        <option value="all">🏥 All Clinics</option>
                        {clinics.map(clinic => (
                            <option key={clinic.ClinicID} value={clinic.ClinicID}>
                                🏥 {clinic.Name} ({clinic.ClinicID})
                            </option>
                        ))}
                    </select>
                    
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', cursor: 'pointer' }}
                    />
                    
                    <button 
                        onClick={callNextPatient}
                        disabled={!isToday || waitingPatients.length === 0}
                        style={{ 
                            background: (!isToday || waitingPatients.length === 0) ? '#9ca3af' : '#10b981', 
                            color: 'white', 
                            border: 'none', 
                            padding: '10px 20px', 
                            borderRadius: '8px', 
                            cursor: (!isToday || waitingPatients.length === 0) ? 'not-allowed' : 'pointer', 
                            fontSize: '14px', 
                            fontWeight: 'bold' 
                        }}
                    >
                        🔔 Call Next Patient
                    </button>
                </div>
            </div>
            
            {/* Active View Info */}
            <div style={{ 
                background: isFuture ? '#fef3c7' : (isPast ? '#f3f4f6' : '#e0e7ff'), 
                padding: '10px 15px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
            }}>
                <span>📍</span>
                <span style={{ fontWeight: 'bold' }}>Clinic: {getClinicName()}</span>
                <span>|</span>
                <span>📅 {formatDate(selectedDate)}</span>
                {isFuture && <span style={{ background: '#f59e0b', padding: '2px 8px', borderRadius: '20px', fontSize: '12px' }}>🔮 Future Date - View Only</span>}
                {isPast && <span style={{ background: '#6b7280', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', color: 'white' }}>📜 Past Date - History View</span>}
                {isToday && <span style={{ background: '#10b981', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', color: 'white' }}>✅ Today - Active</span>}
            </div>
            
            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '15px', margin: '20px 0' }}>
                <div style={{ padding: '20px', background: '#fef3c7', borderRadius: '8px' }}>
                    <div>🕐 Waiting</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.total_waiting}</div>
                </div>
                <div style={{ padding: '20px', background: '#d1fae5', borderRadius: '8px' }}>
                    <div>💚 In Consultation</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.in_consultation_count}</div>
                </div>
                <div style={{ padding: '20px', background: '#dbeafe', borderRadius: '8px' }}>
                    <div>✅ Completed</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.completed}</div>
                </div>
                <div style={{ padding: '20px', background: '#fee2e2', borderRadius: '8px' }}>
                    <div>❌ Cancelled</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.cancelled}</div>
                </div>
                <div style={{ padding: '20px', background: '#e9d5ff', borderRadius: '8px' }}>
                    <div>⏱️ Avg Wait Time</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.average_wait_minutes} min</div>
                </div>
                <div style={{ padding: '20px', background: '#cffafe', borderRadius: '8px' }}>
                    <div>📋 Total</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary.total_for_date}</div>
                </div>
            </div>
            
            {/* Current Consultation */}
            {currentPatient && (
                <div style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    color: 'white', 
                    padding: '20px', 
                    borderRadius: '12px', 
                    marginBottom: '20px',
                    opacity: isFuture ? 0.6 : 1
                }}>
                    <h3>💚 Current Consultation</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{currentPatient.patient_name}</div>
                            <div>Wait: {currentPatient.wait_display || `${currentPatient.waiting_minutes} min`}</div>
                            <div>Arrived: {currentPatient.arrived_time}</div>
                            {currentPatient.reason && <div>Reason: {currentPatient.reason}</div>}
                        </div>
                        {isToday && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => cancelAppointment(currentPatient.appointment_id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>
                                    ❌ Cancel
                                </button>
                                <button onClick={() => completeConsultation(currentPatient.appointment_id)} style={{ background: 'white', color: '#4c1d95', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    ✓ Complete & Next
                                </button>
                            </div>
                        )}
                        {!isToday && (
                            <div style={{ background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '8px' }}>
                                View Only - Not Today
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Waiting Queue Table */}
            <h3>🕐 Waiting Queue ({waitingPatients.length} patients for {selectedDate})</h3>
            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>#</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Patient Name</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Wait Time</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Reason</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {waitingPatients.map((patient) => (
                            <tr key={patient.appointment_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{patient.queue_position}</td>
                                <td style={{ padding: '12px' }}>{patient.patient_name}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ color: patient.wait_color }}>{patient.wait_display || `${patient.waiting_minutes} min`}</span>
                                    <div style={{ fontSize: '10px', color: '#999' }}>Arrived: {patient.arrived_time}</div>
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: patient.is_walk_in ? '#fed7aa' : '#bfdbfe' }}>
                                        {patient.is_walk_in ? 'Walk-in' : 'Scheduled'}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', fontSize: '13px' }}>{patient.reason}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ padding: '4px 8px', borderRadius: '20px', fontSize: '12px', background: '#fef3c7', color: '#92400e' }}>
                                        {patient.patient_status}
                                    </span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                    {isToday ? (
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <button 
                                                onClick={() => startConsultation(patient.appointment_id)} 
                                                style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                                            >
                                                Start Now
                                            </button>
                                            <button 
                                                onClick={() => cancelAppointment(patient.appointment_id)} 
                                                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>View Only</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {waitingPatients.length === 0 && !currentPatient && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px' }}>🏥</div>
                    <h3>No appointments for {formatDate(selectedDate)}</h3>
                    {isFuture && <p>You can view future appointments here, but cannot start consultations until that date.</p>}
                    {isPast && <p>This is a past date. View history of what happened.</p>}
                    {isToday && <p>No patients scheduled for today. Add appointments to get started.</p>}
                </div>
            )}
            
            {/* Debug Info */}
            <details style={{ marginTop: '20px', padding: '10px', background: '#f3f4f6', borderRadius: '8px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Debug Info</summary>
                <pre style={{ fontSize: '12px', marginTop: '10px', overflow: 'auto' }}>
                    Selected Date: {selectedDate}
                    Is Today: {isToday ? 'Yes' : 'No'}
                    Is Future: {isFuture ? 'Yes' : 'No'}
                    Is Past: {isPast ? 'Yes' : 'No'}
                    Clinic: {selectedClinic}
                    Waiting: {summary.total_waiting}
                    In Consultation: {summary.in_consultation_count}
                    Completed: {summary.completed}
                    Cancelled: {summary.cancelled}
                    Total: {summary.total_for_date}
                </pre>
            </details>
        </div>
    );
};

export default StaffDashboard;