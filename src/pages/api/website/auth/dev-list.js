// file location: src/pages/api/website/auth/dev-list.js
// Dev-only endpoint: returns the list of customers for the dev login
// dropdown on /website/login. Gated by canShowDevLogin() so it cannot
// leak the customer book in environments that have dev tools disabled.

import { canShowDevLogin } from "@/lib/dev-tools/config";
import { supabaseService, supabase } from "@/lib/database/supabaseClient";

const db = () => supabaseService || supabase;

export default async function handler(req, res) {
  if (!canShowDevLogin()) {
    return res.status(404).json({ success: false, message: "Not found." });
  }
  const { data, error } = await db()
    .from("customers")
    .select("id, firstname, lastname, email")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
  return res.status(200).json({ success: true, customers: data || [] });
}
