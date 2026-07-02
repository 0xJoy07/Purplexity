import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gwundhyeqapyyoxpsztc.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dW5kaHllcWFweXlveHBzenRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MjE2NzQsImV4cCI6MjA5ODM5NzY3NH0.QkeVFh_W8CyAFpLi6B_SrQQr7OcoWKPbLvODOv5r5jU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
