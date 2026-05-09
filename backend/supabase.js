// supabase.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

export const supabaseUrl = 'https://ixikhufrylaugpdxokwu.supabase.co'
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4aWtodWZyeWxhdWdwZHhva3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTQ0NTIsImV4cCI6MjA5MTIzMDQ1Mn0.F7g_bNWAsxjWtkHihVNYPicghiKOisgHGV9-zaBjXvQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)