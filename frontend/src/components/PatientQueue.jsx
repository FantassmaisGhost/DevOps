// QUEUE/frontend/src/components/PatientQueue.jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const PatientQueue = ({ userId }) => {
    const [status, setStatus] = useState(null);
    const [waitTime, setWaitTime] = useState(null);
    const [socket, setSocket] = useState(null);
    
    useEffect(() => {
        const newSocket = io('http://localhost:3001', {
            auth: { userId, role: 'patient' }
        });
        
        setSocket(newSocket);
        
        newSocket.on('appointment:status', (data) => {
            setStatus(data);
        });
        
        newSocket.on('status:changed', (data) => {
            setStatus(prev => ({ ...prev, patient_status: data.status }));
            if (data.status === 'in_consultation') {
                alert('Your turn has arrived! Please proceed to consultation.');
            }
        });
        
        return () => newSocket.close();
    }, [userId]);
    
    if (!status) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h2>No active appointment found</h2>
                <p>Please check in at the clinic to join the queue.</p>
            </div>
        );
    }
    
    return (
        <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px', textAlign: 'center' }}>
            <h1>Your Queue Status</h1>
            
            <div style={{ fontSize: '64px', fontWeight: 'bold', margin: '20px 0' }}>
                #{status.queue_position || '—'}
            </div>
            <p>Current Position</p>
            
            <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
                <div>Estimated Wait Time</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                    {status.estimated_wait_minutes || 'Calculating'} minutes
                </div>
            </div>
            
            <div style={{
                padding: '10px',
                background: status.patient_status === 'waiting' ? '#fef3c7' : '#d1fae5',
                borderRadius: '8px'
            }}>
                Status: {status.patient_status?.toUpperCase()}
            </div>
        </div>
    );
};

export default PatientQueue;