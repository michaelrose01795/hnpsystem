// file location: src/pages/api/accounts/settings.js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard to enforce Keycloak RBAC
import supabase from "@/lib/supabaseClient"; // import Supabase client for persistence
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager"]; // restrict settings endpoint to accounts leadership
const TABLE = "account_settings"; // table storing serialized settings payload
async function handler(req, res) { // main handler for GET/PUT requests
  if (req.method === "GET") { // handle settings fetch requests
    const { data, error } = await supabase // query Supabase for settings record
      .from(TABLE) // target account_settings table
      .select("settings") // fetch only settings column (JSON)
      .eq("id", 1) // use singleton record with id 1
      .maybeSingle(); // expect zero or one row
    if (error) { // handle Supabase errors gracefully
      console.error("Failed to load account settings", error); // log error for diagnostics
      res.status(200).json({ success: true, data: {} }); // return empty settings so UI can fallback to defaults
      return; // exit handler
    } // close guard
    res.status(200).json({ success: true, data: data?.settings || {} }); // return stored settings or blank object
    return; // exit handler
  } // close GET branch
  if (req.method === "PUT") { // handle settings update requests
    const payload = req.body || {}; // read settings object from request body
    const { error } = await supabase // upsert JSON payload into table
      .from(TABLE) // target account_settings table
      .upsert({ id: 1, settings: payload }, { onConflict: "id" }); // upsert on singleton id 1
    if (error) { // handle Supabase write errors
      console.error("Failed to save account settings", error); // log error for debugging
      res.status(500).json({ success: false, message: "Unable to save settings" }); // respond with failure message
      return; // exit handler
    } // close guard
    res.status(200).json({ success: true, data: payload }); // respond with saved payload for confirmation
    return; // exit handler
  } // close PUT branch
  res.setHeader("Allow", "GET,PUT"); // advertise allowed methods
  res.status(405).json({ success: false, message: "Method not allowed" }); // respond with failure for unsupported verbs
} // close handler definition
export default withRoleGuard(handler, { allow: allowedRoles }); // wrap handler with role guard enforcing allowed roles
