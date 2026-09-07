// Server-only customer VHC report data and permanent link access.
import { generateShareCode } from "@/lib/vhc/shareCode";
import { createClient } from "@supabase/supabase-js";
import { resolveJobIdentity } from "@/lib/jobs/jobIdentity";
import { logFailure } from "@/lib/utils/logFailure";


let cachedClient = null;

const getDbClient = () => {
  if (cachedClient) return cachedClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase configuration");
  }
  cachedClient = createClient(supabaseUrl, serviceRoleKey);
  return cachedClient;
};

const isDev = () => process.env.NODE_ENV !== "production";

// One access check for both report reads and customer decisions. Possession of
// a valid code grants access to its job; creation time never changes permissions.
export async function validateCustomerVhcLink({ jobNumber, linkCode }, client = getDbClient()) {
  if (typeof linkCode !== "string" || !linkCode.trim()) {
    return { status: 400, body: { success: false, error: "Link code is required" } };
  }
  const { data: shareLink, error } = await client.from("job_share_links")
    .select("*").eq("link_code", linkCode).maybeSingle();
  if (error) return { status: 500, body: { success: false, error: "Failed to validate link" } };
  if (!shareLink) return { status: 404, body: { success: false, error: "Invalid customer link" } };
  // The stored foreign key is authoritative, including numeric job numbers
  // that could otherwise be mistaken for internal job IDs.
  const identity = !jobNumber || jobNumber === shareLink.job_number
    ? { id: shareLink.job_id, job_number: shareLink.job_number }
    : await resolveJobIdentity({ client, identifier: jobNumber, select: "id, job_number" });
  if (!identity?.id || identity.id !== shareLink.job_id || identity.job_number !== shareLink.job_number) {
    return { status: 404, body: { success: false, error: "Invalid customer link" } };
  }
  return { status: 200, identity, shareLink };
}

export async function resolveJobNumberForShareCode(linkCode) {
  const result = await validateCustomerVhcLink({ linkCode });
  return result.identity?.job_number || null;
}

export async function resolveSharedVhcReport(params) {
  try {
    const dbClient = getDbClient();
    const access = await validateCustomerVhcLink(params, dbClient);
    if (access.status !== 200) return access;
    const { identity, shareLink } = access;
    if (!shareLink.viewed_at) {
      const { error: viewedError } = await dbClient
        .from("job_share_links")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", shareLink.id);

      if (viewedError) {
        console.warn("Failed to mark VHC share link as viewed:", viewedError.message);
      }
    }

    // Fetch the job row first (simpler queries are more reliable)
    const { data: jobRow, error: jobRowError } = await dbClient
      .from("jobs")
      .select(`
        id, job_number, vehicle_reg, vehicle_make_model,
        customer:customer_id(name, firstname, lastname),
        vehicle:vehicle_id(registration, reg_number, make, model)
      `)
      .eq("id", identity.id)
      .maybeSingle();

    if (jobRowError) {
      logFailure("Error fetching job row:", jobRowError);
      const details = isDev()
        ? jobRowError?.message || JSON.stringify(jobRowError, Object.getOwnPropertyNames(jobRowError))
        : undefined;
      return { status: 500, body: { success: false, error: "Failed to fetch job data", details } };
    }

    if (!jobRow) {
      return { status: 404, body: { success: false, error: "Job not found" } };
    }

    // Load all report collections together; never show partial quote totals.
    const [vhcChecksRes, partsRes, filesRes] = await Promise.all([
      dbClient
        .from("vhc_checks")
        .select(
          `vhc_id, job_id, severity, authorization_state, slot_code, line_key, Complete, section, issue_description, customer_description, issue_title, measurement, created_at, updated_at, approval_status, display_status, approved_by, approved_at, labour_hours, parts_cost, total_override, labour_complete, parts_complete, note_text, request_id, display_id`
        )
        .eq("job_id", jobRow.id),
      dbClient
        .from("parts_job_items")
        .select(
          `id, part_id, quantity_requested, quantity_allocated, quantity_fitted, status, origin, vhc_item_id, unit_price, request_notes, created_at, updated_at, authorised, stock_status, labour_hours, part:part_id(id, part_number, name, unit_price)`
        )
        .eq("job_id", jobRow.id),
      dbClient
        .from("job_files")
        .select(`file_id, file_name, file_url, file_type, folder, uploaded_at, vhc_concern_link, is_main_vhc_video`)
        .eq("visible_to_customer", true)
        .eq("job_id", jobRow.id),
    ]);

    const warnings = [];
    if (vhcChecksRes.error) {
      logFailure("Error fetching vhc_checks:", vhcChecksRes.error);
      warnings.push("vhc_checks");
    }
    if (partsRes.error) {
      logFailure("Error fetching parts_job_items:", partsRes.error);
      warnings.push("parts_job_items");
    }
    if (filesRes.error) {
      logFailure("Error fetching job_files:", filesRes.error);
      warnings.push("job_files");
    }

    if (warnings.length) {
      return { status: 503, body: { success: false, error: "The complete report could not be loaded. Please try again." } };
    }

    const jobData = {
      ...jobRow,
      customer: { name: jobRow.customer?.name || [jobRow.customer?.firstname, jobRow.customer?.lastname].filter(Boolean).join(" ") },
      vehicle: { ...jobRow.vehicle, registration: jobRow.vehicle?.registration || jobRow.vehicle?.reg_number || jobRow.vehicle_reg },
      vhc_checks: vhcChecksRes.data || [],
      parts_job_items: partsRes.data || [],
      job_files: filesRes.data || [],
    };

    return {
      status: 200,
      body: {
        success: true,
        valid: true,
        jobData,
        warnings: warnings.length ? warnings : undefined,
        debug: isDev()
          ? { vhcChecksError: vhcChecksRes.error, partsError: partsRes.error, filesError: filesRes.error }
          : undefined,
        expiresAt: null,
      },
    };
  } catch (error) {
    logFailure("Error resolving shared VHC report:", error);
    return { status: 500, body: { success: false, error: "Internal server error" } };
  }
}

export default resolveSharedVhcReport;

export async function getOrCreateCustomerVhcLink(jobNumber, client = getDbClient()) {
  const identity = await resolveJobIdentity({ client, identifier: jobNumber, select: "id, job_number" });
  if (!identity?.id) throw new Error("Job not found");
  const { data: links, error } = await client.from("job_share_links")
    .select("*").eq("job_number", identity.job_number)
    .order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  if (links?.[0]) return { ...links[0], isNew: false };
  const { data, error: insertError } = await client.from("job_share_links").insert({
    job_id: identity.id, job_number: identity.job_number,
    link_code: generateShareCode(), created_at: new Date().toISOString(),
  }).select().single();
  if (insertError) throw insertError;
  return { ...data, isNew: true };
}
