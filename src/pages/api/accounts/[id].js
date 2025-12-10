// file location: src/pages/api/accounts/[id].js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard helper for RBAC enforcement
import { deriveAccountPermissions } from "@/lib/accounts/permissions"; // import permission helper for fine-grained checks
import supabase from "@/lib/supabaseClient"; // import Supabase client for database queries
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager", "general manager", "service manager", "workshop manager", "sales"]; // allow same roles as list endpoint
async function handler(req, res, session) { // main API handler for account detail/update
  const permissions = deriveAccountPermissions(session.user?.roles || []); // derive permission flags from session roles
  const { id } = req.query; // extract account id from request query params
  if (!id) { // ensure id provided
    res.status(400).json({ success: false, message: "Account id is required" }); // respond with validation error when missing
    return; // exit handler early
  } // close guard
  if (req.method === "GET") { // handle fetch requests for account detail view
    if (!permissions.canViewAccounts) { // ensure caller allowed to view accounts
      res.status(403).json({ success: false, message: "Insufficient permissions" }); // respond 403 when user lacks access
      return; // exit handler
    } // close guard
    const { data: account, error } = await supabase // fetch account record from database
      .from("accounts") // query accounts table
      .select("*") // select all columns for detail view
      .eq("account_id", id) // filter by account id
      .maybeSingle(); // expect zero or one row
    if (error) { // handle Supabase errors
      console.error("Failed to fetch account", error); // log for debugging
      res.status(500).json({ success: false, message: "Unable to load account" }); // respond with failure message
      return; // exit handler
    } // close guard
    if (!account) { // handle missing account record
      res.status(404).json({ success: false, message: "Account not found" }); // respond 404 when id invalid
      return; // exit handler
    } // close guard
    const { data: transactions } = await supabase // fetch recent transactions for preview cards
      .from("account_transactions") // query account_transactions table
      .select("*") // fetch all columns for display
      .eq("account_id", id) // filter by account id
      .order("transaction_date", { ascending: false }) // order newest first
      .limit(10); // limit to recent 10 transactions
    const { data: invoices } = await supabase // fetch recent invoices linked to this account
      .from("invoices") // query invoices table
      .select("*") // fetch all columns for UI display
      .eq("account_id", id) // filter by account id
      .order("created_at", { ascending: false }) // order newest first
      .limit(10); // limit to 10 rows
    res.status(200).json({ success: true, data: account, transactions: transactions || [], invoices: invoices || [] }); // return aggregated payload to caller
    return; // exit handler
  } // close GET branch
  if (req.method === "PUT") { // handle account updates
    if (!permissions.canEditAccount) { // ensure caller allowed to edit accounts at all
      res.status(403).json({ success: false, message: "Insufficient permissions" }); // respond 403 when user lacks edit rights
      return; // exit handler
    } // close guard
    const incoming = req.body || {}; // read payload fields from request body
    const updates = {}; // prepare object storing sanitized update fields
    const copyFields = [ // fields accessible only to accounts/admin roles
      "customer_id", // customer relationship id
      "account_type", // account type string
      "billing_name", // billing contact name
      "billing_email", // billing contact email
      "billing_phone", // billing phone number
      "billing_address_line1", // billing address line 1
      "billing_address_line2", // billing address line 2
      "billing_city", // billing city
      "billing_postcode", // billing postal code
      "billing_country", // billing country
      "credit_terms", // credit terms in days
      "notes", // internal notes
    ]; // close copyFields array
    const sharedFields = ["balance", "credit_limit", "status"]; // fields accessible to managers for limited edits
    sharedFields.forEach((field) => { // copy shared fields when provided
      if (field in incoming) { // ensure incoming payload contains field
        updates[field] = incoming[field]; // copy value into updates object
      } // close guard
    }); // close loop over shared fields
    if (permissions.hasAccounts || permissions.hasAdmin) { // allow broader updates for accounts/admin staff
      copyFields.forEach((field) => { // iterate over privileged field list
        if (field in incoming) { // ensure payload contains field
          updates[field] = incoming[field]; // copy value from payload into updates
        } // close guard
      }); // close copyFields iteration
    } // close privileged branch
    if (Object.keys(updates).length === 0) { // ensure there is at least one field to update
      res.status(400).json({ success: false, message: "No valid fields to update" }); // respond 400 when payload empty
      return; // exit handler early
    } // close guard
    const { data, error } = await supabase // execute update statement with sanitized fields
      .from("accounts") // target accounts table
      .update(updates) // set requested fields
      .eq("account_id", id) // constrain update to the requested account
      .select() // fetch updated row for response
      .single(); // expect single record result
    if (error) { // handle Supabase errors from update
      console.error("Failed to update account", error); // log for debugging
      res.status(500).json({ success: false, message: "Unable to update account" }); // respond with failure message
      return; // exit handler
    } // close guard
    res.status(200).json({ success: true, data }); // respond with updated record to caller
    return; // exit handler
  } // close PUT branch
  res.setHeader("Allow", "GET,PUT"); // advertise supported methods
  res.status(405).json({ success: false, message: "Method not allowed" }); // respond 405 when method unsupported
} // close handler definition
export default withRoleGuard(handler, { allow: allowedRoles }); // wrap handler with role guard to enforce base role list
