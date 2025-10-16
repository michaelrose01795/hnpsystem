// file location: src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Load from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;  // loaded from .env.local
const supabaseKey = process.env.SUPABASE_KEY;              // loaded from .env.local

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);
