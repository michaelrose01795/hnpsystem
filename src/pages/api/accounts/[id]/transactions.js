// file location: src/pages/api/accounts/[id]/transactions.js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard for RBAC handling
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager", "general manager", "service manager", "sales"];
async function handler(req, res, session) {
  const permissions = deriveAccountPermissions(session.user?.roles || []);
  const { id } = req.query;
  if (!id) {
    res.status(400).json({ success: false, message: "Account id is required" });
    return;
  }
  if (req.method === "GET") {
    if (!permissions.canViewAccounts) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Number(req.query.pageSize || 20));
    const type = req.query.type || "";
    const paymentMethod = req.query.payment_method || "";
    const from = req.query.from || "";
    const to = req.query.to || "";
    let query = supabase
      .from("account_transactions")
      .select("*", { count: "exact" })
      .eq("account_id", id);
    if (type) { query = query.eq("type", type); }
    if (paymentMethod) { query = query.eq("payment_method", paymentMethod); }
    if (from) { query = query.gte("transaction_date", from); }
    if (to) { query = query.lte("transaction_date", to); }
    query = query.order("transaction_date", { ascending: false });
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    query = query.range(fromIndex, toIndex);
    const { data, error, count } = await query;
    if (error) {
      console.error("Failed to fetch transactions", error);
      res.status(500).json({ success: false, message: "Unable to load transactions" });
      return;
    }
    res.status(200).json({ success: true, data: data || [], pagination: { page, pageSize, total: count || 0 } });
    return;
  }
  if (req.method === "POST") {
    if (!permissions.canCreateTransactions) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    const payload = req.body || {};
    const insert = {
      account_id: id,
      transaction_date: payload.transaction_date || new Date().toISOString(),
      amount: payload.amount || 0,
      type: payload.type || "Debit",
      description: payload.description || "",
      job_number: payload.job_number || null,
      payment_method: payload.payment_method || "Account Transfer",
      created_by: session.user?.name || "System",
    };
    const { data, error } = await supabase
      .from("account_transactions")
      .insert([insert])
      .select()
      .single();
    if (error) {
      console.error("Failed to create transaction", error);
      res.status(500).json({ success: false, message: "Unable to create transaction" });
      return;
    }
    res.status(201).json({ success: true, data });
    return;
  }
  res.setHeader("Allow", "GET,POST");
  res.status(405).json({ success: false, message: "Method not allowed" });
}
export default withRoleGuard(handler, { allow: allowedRoles });
