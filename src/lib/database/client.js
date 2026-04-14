// file location: src/lib/database/client.js
import { supabase } from "@/lib/database/supabaseClient";

export const getDatabaseClient = () => supabase;

export default supabase;
