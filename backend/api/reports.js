// C:\Users\nasin\Downloads\Queue\backend\api\reports.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { Parser } = require('json2csv');

// Use process.env directly (dotenv already loaded in server.js)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Get queue summary for dashboard
router.get('/summary/:clinicId', async (req, res) => {
    const { clinicId } = req.params;
    
    try {
        // Get queue summary from RPC
        const { data: queueSummary } = await supabase
            .rpc('get_queue_summary', { p_clinic_id: clinicId });
        
        // Get daily analytics for last 7 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        
        const { data: dailyAnalytics } = await supabase
            .rpc('get_daily_analytics', {
                p_clinic_id: clinicId,
                p_start_date: startDate.toISOString().split('T')[0],
                p_end_date: endDate.toISOString().split('T')[0]
            });
        
        // Get wait time report
        const { data: waitTimes } = await supabase
            .from('report_wait_times')
            .select('*')
            .eq('clinic_name', clinicId)
            .limit(10);
        
        res.json({
            queue_summary: queueSummary?.[0] || {},
            daily_analytics: dailyAnalytics || [],
            wait_times: waitTimes || []
        });
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export as CSV
router.get('/export/csv', async (req, res) => {
    const { clinicId, startDate, endDate } = req.query;
    
    const { data } = await supabase
        .rpc('export_wait_time_report', {
            p_clinic_id: clinicId,
            p_start_date: startDate,
            p_end_date: endDate
        });
    
    const parser = new Parser();
    const csv = parser.parse(data || []);
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`queue_report_${clinicId}.csv`);
    res.send(csv);
});

module.exports = router;