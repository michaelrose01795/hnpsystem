// file location: src/pages/api/settings/company-profile.js // identify API route
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import RBAC helper
import supabase from "@/lib/supabaseClient"; // import Supabase client for DB access

const allowedRoles = [ // roles allowed to read/write company profile
  "admin",
  "owner",
  "admin manager",
  "accounts",
  "accounts manager",
  "general manager",
  "service manager",
  "workshop manager"
]; // end allowed roles

async function handler(req, res, session) { // route handler supporting GET + PUT
  if (req.method === "GET") { // handle profile fetch
    const { data, error } = await supabase // query Supabase for latest profile
      .from("company_profile_settings") // table name
      .select("*") // fetch all columns
      .order("updated_at", { ascending: false }) // prefer latest update
      .limit(1) // only one row expected
      .maybeSingle(); // expect zero or one row
    if (error && error.code !== "PGRST116") { // handle actual errors
      console.error("Failed to load company profile", error); // log error
      res.status(500).json({ success: false, message: "Unable to load company profile" }); // send error
      return; // exit handler
    }
    res.status(200).json({ success: true, data: data || null }); // send profile (or null)
    return; // exit handler
  }

  if (req.method === "PUT") { // handle profile updates
    const payload = req.body || {}; // read request body
    if (!payload.company_name) { // require company name
      res.status(400).json({ success: false, message: "company_name is required" }); // send validation error
      return; // exit handler
    }
    const upsertPayload = { // build row payload
      ...payload, // spread incoming values
      updated_at: new Date().toISOString(), // update timestamp
      created_at: payload.created_at || new Date().toISOString(), // ensure created timestamp for first insert
      updated_by: session?.user?.id || null // capture editor id when available
    }; // end payload
    const { data, error } = await supabase // upsert row
      .from("company_profile_settings") // target table
      .upsert(upsertPayload, { onConflict: "id" }) // upsert by primary key
      .select("*") // return row
      .maybeSingle(); // expect one row
    if (error) { // handle DB errors
      console.error("Failed to save company profile", error); // log error
      res.status(500).json({ success: false, message: "Unable to save company profile" }); // send error
      return; // exit handler
    }
    res.status(200).json({ success: true, data }); // send updated row
    return; // exit handler
  }

  res.setHeader("Allow", "GET,PUT"); // advertise supported methods
  res.status(405).json({ success: false, message: "Method not allowed" }); // respond 405 for others
} // end handler

export default withRoleGuard(handler, { allow: allowedRoles }); // wrap handler with RBAC guard
