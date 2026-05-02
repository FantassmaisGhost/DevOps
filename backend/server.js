// C:\Users\nasin\Downloads\Queue\backend\server.js

// IMPORTANT: Load dotenv FIRST, before any other imports
require('dotenv').config();

// Now check if environment variables are loaded
console.log('🔍 Checking environment variables...');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Loaded' : '❌ Missing');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Loaded' : '❌ Missing');

// If missing, show error and exit
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ ERROR: Missing Supabase credentials in .env file');
    console.error('Please create a .env file in the backend folder with:');
    console.error('SUPABASE_URL=your_supabase_url');
    console.error('SUPABASE_ANON_KEY=your_anon_key');
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Import WebSocket manager and reports AFTER dotenv is loaded
const RealtimeQueueManager = require('./realtime');
const reportsRouter = require('./api/reports');

// API routes
app.use('/api/reports', reportsRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize real-time manager
const queueManager = new RealtimeQueueManager(httpServer);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket ready on ws://localhost:${PORT}`);
});

module.exports = { app, httpServer };