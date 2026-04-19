import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://ixikhufrylaugpdxokwu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4aWtodWZyeWxhdWdwZHhva3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTQ0NTIsImV4cCI6MjA5MTIzMDQ1Mn0.F7g_bNWAsxjWtkHihVNYPicghiKOisgHGV9-zaBjXvQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default supabase;