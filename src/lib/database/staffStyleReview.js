// Persistence for the Developer-only Staff Global Style Review.
// All repository evidence comes from the fixed markdown importer; this module
// never scans application source files.

import { supabaseService } from "@/lib/database/supabaseClient";
import { STAFF_STYLE_REVIEW_STATUSES } from "@/lib/staff-style-review/auditParser";
import { loadStaffStyleAuditSource } from "@/lib/staff-style-review/auditSource";

const FINDINGS = "staff_style_review_findings";
const HISTORY = "staff_style_review_history";
const IMPORTS = "staff_style_review_imports";

let tableProbe;

function missingTable(error) {
  const message = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("does not exist");
}

async function persistenceAvailable() {
  if (!supabaseService) return false;
  if (!tableProbe) {
    tableProbe = (async () => {
      try {
        const { error } = await supabaseService.from(FINDINGS).select("id", { head: true, count: "exact" }).limit(1);
        if (error) {
          if (!missingTable(error)) console.warn("[staff-style-review] table probe failed:", error.message || error);
          return false;
        }
        return true;
      } catch (error) {
        console.warn("[staff-style-review] table probe threw:", error?.message || error);
        return false;
      }
    })();
  }
  return tableProbe;
}

export function clearStaffStyleReviewTableProbe() {
  tableProbe = null;
}

function toDatabaseRecord(record, source) {
  return {
    audit_id: record.auditId,
    original_audit_id: record.originalAuditId,
    source_key: record.sourceKey,
    finding_type: record.type,
    audit_group: record.auditGroup,
    category: record.category,
    feature_area: record.featureArea,
    subsection: record.subsection,
    route: record.route,
    section_name: record.sectionName,
    visibility_instructions: record.visibilityInstructions,
    issue_summary: record.issueSummary,
    source_reference: record.sourceReference,
    source_files: record.sourceFiles,
    line_references: record.lineReferences,
    recommendation: record.recommendation,
    partial_adoption: record.partialAdoption,
    partial_adoption_notes: record.partialAdoptionNotes,
    specialist_exception_notes: record.specialistExceptionNotes,
    import_metadata: {
      source_path: source.sourcePath,
      source_hash: source.sourceHash,
    },
    last_synced_at: new Date().toISOString(),
  };
}

function fromDatabaseRecord(row) {
  return {
    id: row.id,
    auditId: row.audit_id,
    originalAuditId: row.original_audit_id,
    sourceKey: row.source_key,
    type: row.finding_type,
    auditGroup: row.audit_group,
    category: row.category,
    featureArea: row.feature_area,
    subsection: row.subsection,
    route: row.route,
    sectionName: row.section_name,
    visibilityInstructions: row.visibility_instructions,
    issueSummary: row.issue_summary,
    sourceReference: row.source_reference,
    sourceFiles: row.source_files || [],
    lineReferences: row.line_references || [],
    recommendation: row.recommendation,
    partialAdoption: row.partial_adoption === true,
    partialAdoptionNotes: row.partial_adoption_notes,
    specialistExceptionNotes: row.specialist_exception_notes,
    reviewStatus: row.review_status,
    reviewNotes: row.review_notes || "",
    firstImportedAt: row.first_imported_at,
    lastSyncedAt: row.last_synced_at,
    updatedAt: row.updated_at,
  };
}

function sourceFallback(source, message) {
  return {
    ok: true,
    data: source.records.map((record) => ({ ...record, id: `source:${record.auditId}:${record.sourceKey}` })),
    persistenceAvailable: false,
    counts: source.counts,
    total: source.total,
    warnings: [
      ...source.warnings,
      { code: "persistence_unavailable", message },
    ],
    sourcePath: source.sourcePath,
    sourceHash: source.sourceHash,
  };
}

export async function syncStaffStyleReview({ actorKey = "dev-platform", trigger = "manual" } = {}) {
  const source = loadStaffStyleAuditSource();
  if (!(await persistenceAvailable())) {
    return {
      ...sourceFallback(source, "The Staff Style Review migration is not applied or the service database client is unavailable."),
      ok: false,
      error: "Apply the Staff Style Review migration before syncing the audit.",
    };
  }

  const rows = source.records.map((record) => toDatabaseRecord(record, source));
  const { error } = await supabaseService.from(FINDINGS).upsert(rows, {
    onConflict: "audit_id,source_key",
    ignoreDuplicates: false,
  });
  if (error) return { ok: false, error: error.message };

  const importedAt = new Date().toISOString();
  const importSummary = {
    source_path: source.sourcePath,
    source_hash: source.sourceHash,
    trigger,
    imported_by: actorKey,
    parsed_total: source.total,
    expected_total: 129,
    category_totals: source.counts,
    warnings: source.warnings,
    imported_at: importedAt,
  };
  const importResult = await supabaseService.from(IMPORTS).insert([importSummary]);
  if (importResult.error && !missingTable(importResult.error)) {
    console.warn("[staff-style-review] import summary write failed:", importResult.error.message || importResult.error);
  }

  return {
    ok: true,
    persistenceAvailable: true,
    counts: source.counts,
    total: source.total,
    warnings: source.warnings,
    sourcePath: source.sourcePath,
    sourceHash: source.sourceHash,
    importedAt,
  };
}

export async function listStaffStyleReviewFindings() {
  const source = loadStaffStyleAuditSource();
  if (!(await persistenceAvailable())) {
    return { ok: false, error: "The Staff Style Review database tables are unavailable. Apply the supplied migrations before loading findings." };
  }

  let { data, error } = await supabaseService
    .from(FINDINGS)
    .select("*")
    .order("original_audit_id", { ascending: true, nullsFirst: false });
  if (error) return { ok: false, error: error.message };

  let latestImport = await supabaseService
    .from(IMPORTS)
    .select("*")
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestImport.error) return { ok: false, error: latestImport.error.message };

  if (!data?.length && !latestImport.data) {
    const synced = await syncStaffStyleReview({ trigger: "initial" });
    if (!synced.ok) return synced;
    const refreshed = await supabaseService
      .from(FINDINGS)
      .select("*")
      .order("original_audit_id", { ascending: true, nullsFirst: false });
    if (refreshed.error) return { ok: false, error: refreshed.error.message };
    data = refreshed.data || [];
    latestImport = await supabaseService
      .from(IMPORTS)
      .select("*")
      .order("imported_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestImport.error) return { ok: false, error: latestImport.error.message };
  }

  return {
    ok: true,
    data: (data || []).map(fromDatabaseRecord),
    persistenceAvailable: true,
    counts: source.counts,
    total: data?.length || 0,
    warnings: source.warnings,
    sourcePath: source.sourcePath,
    sourceHash: source.sourceHash,
    latestImport: latestImport.data || null,
  };
}

export async function deleteStaffStyleReviewFinding({ id }) {
  if (!(await persistenceAvailable())) return { ok: false, error: "Review persistence is unavailable." };
  if (!id) return { ok: false, error: "Finding ID is required." };

  const deleted = await supabaseService
    .from(FINDINGS)
    .delete()
    .eq("id", id)
    .select("id,audit_id,source_key")
    .maybeSingle();
  if (deleted.error) return { ok: false, error: deleted.error.message };
  if (!deleted.data) return { ok: false, error: "Finding not found." };

  return {
    ok: true,
    data: {
      id: deleted.data.id,
      auditId: deleted.data.audit_id,
      sourceKey: deleted.data.source_key,
    },
  };
}

export async function updateStaffStyleReviewFinding({ id, reviewStatus, reviewNotes, actorKey }) {
  if (!(await persistenceAvailable())) return { ok: false, error: "Review persistence is unavailable." };
  if (!STAFF_STYLE_REVIEW_STATUSES.includes(reviewStatus)) return { ok: false, error: "Invalid review status." };
  const notes = String(reviewNotes || "").trim().slice(0, 10000);

  const current = await supabaseService
    .from(FINDINGS)
    .select("id,audit_id,source_key,review_status,review_notes")
    .eq("id", id)
    .maybeSingle();
  if (current.error) return { ok: false, error: current.error.message };
  if (!current.data) return { ok: false, error: "Finding not found." };

  const now = new Date().toISOString();
  const updated = await supabaseService
    .from(FINDINGS)
    .update({ review_status: reviewStatus, review_notes: notes, updated_at: now })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (updated.error) return { ok: false, error: updated.error.message };

  const history = await supabaseService.from(HISTORY).insert([{
    finding_id: current.data.id,
    audit_id: current.data.audit_id,
    source_key: current.data.source_key,
    previous_status: current.data.review_status,
    new_status: reviewStatus,
    previous_notes: current.data.review_notes || "",
    new_notes: notes,
    changed_by: actorKey || "dev-platform",
    changed_at: now,
  }]);
  if (history.error) {
    return { ok: false, error: `Decision saved, but review history could not be recorded: ${history.error.message}` };
  }

  return { ok: true, data: fromDatabaseRecord(updated.data) };
}

export async function listStaffStyleReviewHistory(findingId) {
  if (!(await persistenceAvailable())) return { ok: true, data: [] };
  const { data, error } = await supabaseService
    .from(HISTORY)
    .select("*")
    .eq("finding_id", findingId)
    .order("changed_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data || [] };
}
