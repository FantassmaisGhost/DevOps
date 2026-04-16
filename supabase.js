const SUPABASE_URL = "https://eegqpjzoaslfkospimjy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZ3FwanpvYXNsZmtvc3BpbWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MTQ0MzAsImV4cCI6MjA5MTM5MDQzMH0.hudLTCYP6aQEmeB1XSB5_ikzD1bgQeig5nJQ-r__kCM";

// IMPORTANT: this is correct for the UMD script
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export default supabaseClient;