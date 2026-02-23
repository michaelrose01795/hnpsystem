// file location: src/pages/api/parts/suppliers/search.js

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/supabaseClient";

const GOODS_IN_ROLES = [
  "parts",
  "parts manager",
  "service",
  "service manager",
  "workshop manager",
  "after sales manager",
  "aftersales manager",
];
const SUPPLIER_SELECT = `
  account_number,
  company_name,
  trading_name,
  contact_email,
  contact_phone,
  billing_address_line1,
  billing_address_line2,
  billing_city,
  billing_postcode,
  linked_account_id,
  linked_account_label
`;

function normaliseSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function supplierMatchesQuery(supplier, query) {
  const needle = normaliseSearchText(query);
  if (!needle) return true;

  const haystack = normaliseSearchText(
    [
      supplier?.account_number,
      supplier?.company_name,
      supplier?.trading_name,
      supplier?.contact_email,
      supplier?.contact_phone,
      supplier?.billing_city,
    ].join(" ")
  );

  if (haystack.includes(needle)) return true;

  const queryTokens = needle.split(" ").filter(Boolean);
  return queryTokens.length > 1 && queryTokens.every((token) => haystack.includes(token));
}

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { q = "", limit = "20" } = req.query || {};
  const searchQuery = String(q || "").trim().replace(/\s+/g, " ");
  const size = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);

  try {
    let query = supabase
      .from("company_accounts")
      .select(SUPPLIER_SELECT)
      .order("company_name", { ascending: true })
      .limit(size);

    if (searchQuery) {
      const term = `%${searchQuery}%`;
      query = query.or(
        `account_number.ilike.${term},company_name.ilike.${term},trading_name.ilike.${term},contact_email.ilike.${term},contact_phone.ilike.${term},billing_city.ilike.${term}`
      );
    }

    let { data, error } = await query;
    if (error) throw error;

    // Fallback: if punctuation/spacing differences break direct ilike matches,
    // run a broader local-normalized match so full supplier names still resolve.
    if (searchQuery && (!data || data.length === 0)) {
      const fallbackLimit = Math.min(Math.max(size * 5, 100), 250);
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("company_accounts")
        .select(SUPPLIER_SELECT)
        .order("company_name", { ascending: true })
        .limit(fallbackLimit);

      if (fallbackError) throw fallbackError;

      data = (fallbackData || []).filter((supplier) => supplierMatchesQuery(supplier, searchQuery)).slice(0, size);
    }

    return res.status(200).json({ success: true, suppliers: data || [] });
  } catch (error) {
    console.error("Failed to search suppliers:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to search supplier accounts",
      error: error.message,
    });
  }
}

export default withRoleGuard(handler, { allow: GOODS_IN_ROLES });
