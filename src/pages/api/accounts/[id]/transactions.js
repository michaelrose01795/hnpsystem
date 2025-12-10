// file location: src/pages/api/accounts/[id]/transactions.js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard for RBAC handling
import { deriveAccountPermissions } from "@/lib/accounts/permissions"; // import permission helper shared with UI
import supabase from "@/lib/supabaseClient"; // import Supabase client for database queries
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager", "general manager", "service manager", "sales"]; // allowed caller roles for this endpoint
async function handler(req, res, session) { // main handler for transaction list/create
  const permissions = deriveAccountPermissions(session.user?.roles || []); // derive permission flags from session roles
  const { id } = req.query; // read account id from route parameters
  if (!id) { // ensure account id provided
    res.status(400).json({ success: false, message: "Account id is required" }); // respond with validation error when missing
    return; // exit handler
  } // close guard
  if (req.method === "GET") { // handle transaction list requests
    if (!permissions.canViewAccounts) { // ensure caller allowed to view financial data
      res.status(403).json({ success: false, message: "Insufficient permissions" }); // respond 403 when unauthorized
      return; // exit handler
    } // close guard
    const page = Math.max(1, Number(req.query.page || 1)); // parse page number from query
    const pageSize = Math.max(1, Number(req.query.pageSize || 20)); // parse page size from query
    const type = req.query.type || ""; // read transaction type filter
    const paymentMethod = req.query.payment_method || ""; // read payment method filter
    const from = req.query.from || ""; // read start date filter
    const to = req.query.to || ""; // read end date filter
    let query = supabase // start building Supabase query
      .from("account_transactions") // target account_transactions table
      .select("*", { count: "exact" }) // fetch rows and include total count
      .eq("account_id", id); // filter by account id
    if (type) { query = query.eq("type", type); } // filter by transaction type when provided
    if (paymentMethod) { query = query.eq("payment_method", paymentMethod); } // filter by payment method when provided
    if (from) { query = query.gte("transaction_date", from); } // filter by date lower bound
    if (to) { query = query.lte("transaction_date", to); } // filter by date upper bound
    query = query.order("transaction_date", { ascending: false }); // order newest transactions first
    const fromIndex = (page - 1) * pageSize; // compute pagination start index
    const toIndex = fromIndex + pageSize - 1; // compute pagination end index
    query = query.range(fromIndex, toIndex); // apply pagination range to query
    const { data, error, count } = await query; // execute query
    if (error) { // handle Supabase query errors
      console.error("Failed to fetch transactions", error); // log error for debugging
      res.status(500).json({ success: false, message: "Unable to load transactions" }); // respond with failure message
      return; // exit handler
    } // close guard
    res.status(200).json({ success: true, data: data || [], pagination: { page, pageSize, total: count || 0 } }); // return paginated result payload
    return; // exit handler
  } // close GET branch
  if (req.method === "POST") { // handle creation of manual transactions
    if (!permissions.canCreateTransactions) { // ensure caller allowed to create transactions
      res.status(403).json({ success: false, message: "Insufficient permissions" }); // respond 403 when unauthorized
      return; // exit handler
    } // close guard
    const payload = req.body || {}; // read transaction data from request body
    const insert = { // map payload fields to database columns
      account_id: id, // assign account id from route param
      transaction_date: payload.transaction_date || new Date().toISOString(), // default to now when not provided
      amount: payload.amount || 0, // set transaction amount
      type: payload.type || "Debit", // default transaction type
      description: payload.description || "", // optional description field
      job_number: payload.job_number || null, // optional job number link
      payment_method: payload.payment_method || "Account Transfer", // default payment method
      created_by: session.user?.name || "System", // track user performing action
    }; // close insert object
    const { data, error } = await supabase // execute insert statement
      .from("account_transactions") // target transaction table
      .insert([insert]) // insert record
      .select() // fetch inserted row to return to client
      .single(); // expect single row
    if (error) { // handle insert errors
      console.error("Failed to create transaction", error); // log error for debugging
      res.status(500).json({ success: false, message: "Unable to create transaction" }); // respond with failure message
      return; // exit handler
    } // close guard
    res.status(201).json({ success: true, data }); // return inserted transaction to caller
    return; // exit handler
  } // close POST branch
  res.setHeader("Allow", "GET,POST"); // advertise supported methods
  res.status(405).json({ success: false, message: "Method not allowed" }); // respond 405 for unsupported methods
} // close handler definition
export default withRoleGuard(handler, { allow: allowedRoles }); // wrap handler with role guard using allowed roles list
