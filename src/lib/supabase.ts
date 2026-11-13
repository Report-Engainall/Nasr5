import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export const ORG_ID = 'a0000000-0000-0000-0000-000000000001';
export const ADMIN_PROFILE_ID = 'f0000000-0000-0000-0000-000000000001';
export const WAREHOUSE_ID = 'd0000000-0000-0000-0000-000000000001';
