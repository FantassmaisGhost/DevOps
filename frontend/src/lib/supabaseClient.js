// C:\Users\nasin\Downloads\Queue\frontend\src\lib\supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ixikhufrylaugpdxokwu.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_7T38wLjTEs7UJKMMTxl9tQ_OLM6Wsf3';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);