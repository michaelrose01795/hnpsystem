// file location: src/lib/vhc/sharedReport.js
//
// SERVER ONLY. Resolves a link-authenticated VHC report.
//
// This is the read half of /api/job-cards/[jobNumber]/share-link, lifted out of
// the request handler so it has exactly one implementation and two callers:
//
//   * the API route, which still serves the browser's refetches unchanged, and
//   * getServerSideProps on /vhc/customer/[jobNumber]/[linkCode], so a customer
//     opening the link from a text message gets the report in the HTML instead
//     of an empty document that has to download, parse and hydrate the app
//     before it can even ask for the data.
//
// The logic below is a straight transcription of the previous handler body: same
// queries, same order, same status codes, same payload keys, same `viewed_at`
// side effect. The only change is that it RETURNS { status, body } rather than
// writing to `res`, so a non-HTTP caller can use it.
//
// It holds the service-role key, so it must never be imported from anything that
// reaches the client bundle. Next strips getServerSideProps and its exclusive
// imports from the browser build; the client is also created lazily rather than
// at module scope so an accidental client import fails loudly at call time
// instead of throwing during hydration.

import { createClient } from "@supabase/supabase-js";
import { resolveJobIdentity } from "@/lib/jobs/jobIdentity";
import { logFailure } from "@/lib/utils/logFailure";

const LINK_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

const isLinkExpired = (createdAt) => Date.now() - new Date(createdAt).getTime() > LINK_TTL_MS;

const expiryFor = (createdAt) => new Date(new Date(createdAt).getTime() + LINK_TTL_MS).toISOString();

const isDev = () => process.env.NODE_ENV !== "production";

/**
 * Resolve a share code on its own, with no job number.
 *
 * `job_share_links.link_code` is UNIQUE (schemaReference.sql), so the code is a
 * complete key by itself — the job number in the old three-segment URL was never
 * load-bearing for lookup, only for the composite filter below. This is what
 * lets /report/<code> be a two-segment, job-number-free customer link.
 *
 * Returns just the job number so the caller can hand it to the existing
 * job-number-shaped read/write paths unchanged. Expiry is NOT checked here —
 * resolveSharedVhcReport still owns that, so there is one place that decides a
 * link is too old.
 *
 * @param {string} linkCode
 * @returns {Promise<string|null>} canonical job number, or null if unknown
 */
export async function resolveJobNumberForShareCode(linkCode) {
  if (!linkCode) return null;
  const { data, error } = await getDbClient()
    .from("job_share_links")
    .select("job_number")
    .eq("link_code", linkCode)
    .maybeSingle();

  if (error) {
    logFailure("Error resolving share code:", error);
    return null;
  }
  return data?.job_number || null;
}

/**
 * @param {{ jobNumber?: string, linkCode: string }} params
 *   `jobNumber` is optional — omit it and the (unique) link code resolves it.
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function resolveSharedVhcReport({ jobNumber: rawJobNumber, linkCode }) {
  if (!linkCode) {
    return { status: 400, body: { success: false, error: "Link code is required" } };
  }
  // Code-only callers (/report/<code>) pass no job number; the code is unique,
  // so resolve the job number from it and carry on down the identical path.
  const jobNumber = rawJobNumber || (await resolveJobNumberForShareCode(linkCode));
  if (!jobNumber) {
    return { status: 404, body: { success: false, error: "Link not found or invalid" } };
  }

  const dbClient = getDbClient();

  const identity = await resolveJobIdentity({
    client: dbClient,
    identifier: jobNumber,
    select: "id, job_number",
  });
  if (!identity?.id) {
    return { status: 404, body: { success: false, error: "Job not found" } };
  }
  const canonicalJobNumber = identity.job_number;

  try {
    const { data: shareLink, error: linkError } = await dbClient
      .from("job_share_links")
      .select("*")
      .eq("job_number", canonicalJobNumber)
      .eq("link_code", linkCode)
      .maybeSingle();

    if (linkError) {
      logFailure("Error fetching share link:", linkError);
      return { status: 500, body: { success: false, error: "Failed to validate link" } };
    }

    if (!shareLink) {
      return { status: 404, body: { success: false, error: "Link not found or invalid" } };
    }

    if (isLinkExpired(shareLink.created_at)) {
      return { status: 410, body: { success: false, error: "Link has expired" } };
    }

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
        *,
        customer:customer_id(*),
        vehicle:vehicle_id(*)
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

    // Related collections in parallel; a failing one degrades to empty with a
    // warning rather than failing the whole report.
    const [vhcChecksRes, partsRes, filesRes] = await Promise.all([
      dbClient
        .from("vhc_checks")
        .select(
          `vhc_id, job_id, section, issue_description, customer_description, issue_title, measurement, created_at, updated_at, approval_status, display_status, approved_by, approved_at, labour_hours, parts_cost, total_override, labour_complete, parts_complete, note_text, pre_pick_location, request_id, display_id`
        )
        .eq("job_id", jobRow.id),
      dbClient
        .from("parts_job_items")
        .select(
          `id, part_id, quantity_requested, quantity_allocated, quantity_fitted, status, origin, vhc_item_id, unit_cost, unit_price, request_notes, created_at, updated_at, authorised, stock_status, labour_hours, part:part_id(id, part_number, name, unit_price)`
        )
        .eq("job_id", jobRow.id),
      dbClient
        .from("job_files")
        .select(`file_id, file_name, file_url, file_type, folder, uploaded_at`)
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

    const jobData = {
      ...jobRow,
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
        expiresAt: expiryFor(shareLink.created_at),
      },
    };
  } catch (error) {
    logFailure("Error resolving shared VHC report:", error);
    return { status: 500, body: { success: false, error: "Internal server error" } };
  }
}

export default resolveSharedVhcReport;
