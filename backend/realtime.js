// QUEUE/backend/realtime.js
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

class RealtimeQueueManager {
    constructor(server) {
        this.io = new Server(server, {
            cors: {
                origin: "http://localhost:3000",
                methods: ["GET", "POST"]
            }
        });
        
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        
        this.setupHandlers();
        console.log('✅ WebSocket server ready');
    }
    
    setupHandlers() {
        this.io.on('connection', (socket) => {
            console.log('New client connected:', socket.id);
            
            const { userId, role, clinicId } = socket.handshake.auth;
            
            if (role === 'staff' && clinicId) {
                socket.join(`clinic:${clinicId}`);
                this.sendClinicQueue(socket, clinicId);
            }
            
            if (role === 'patient') {
                socket.join(`patient:${userId}`);
                this.sendPatientStatus(socket, userId);
            }
            
            // Handle status updates from staff
            socket.on('status:update', async (data) => {
                const { appointmentId, newStatus, staffId, clinicId } = data;
                
                const { error } = await this.supabase.rpc('update_queue_position', {
                    p_appointment_id: appointmentId,
                    p_new_status: newStatus,
                    p_staff_id: staffId
                });
                
                if (!error) {
                    // Notify patient
                    this.io.to(`appointment:${appointmentId}`).emit('status:changed', {
                        status: newStatus
                    });
                    
                    // Update staff dashboard
                    const queue = await this.getClinicQueue(clinicId);
                    this.io.to(`clinic:${clinicId}`).emit('queue:updated', queue);
                }
            });
            
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });
    }
    
    async sendClinicQueue(socket, clinicId) {
        const queue = await this.getClinicQueue(clinicId);
        socket.emit('queue:initial', queue);
    }
    
    async sendPatientStatus(socket, userId) {
        const { data } = await this.supabase
            .rpc('get_patient_queue_status', { p_patient_id: userId });
        
        if (data && data[0]) {
            socket.emit('appointment:status', data[0]);
        }
    }
    
    async getClinicQueue(clinicId) {
        const { data } = await this.supabase
            .rpc('get_clinic_queue', { p_clinic_id: clinicId });
        return data || [];
    }
}

module.exports = RealtimeQueueManager;