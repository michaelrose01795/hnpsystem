import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Button,
  LayerTheme,
  StaffAlert,
  StaffFilterBar,
  StaffModal,
  StaffPageHeader,
  StaffPagination,
} from "@/components/ui";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { STAFF_STYLE_REVIEW_STATUSES } from "@/lib/staff-style-review/auditParser";
import { buildStaffStyleReviewItemLink, resolveStaffStyleReviewRoute } from "@/lib/staff-style-review/routeNavigation";

const PAGE_SIZE = 20;
const API_PATH = "/api/dev/staff-style-review";

// This audit table must keep all nine columns inside the page-card viewport; full values remain available in the row review modal.
const TABLE_COLUMN_WIDTHS = Object.freeze(["5%", "8%", "10%", "12%", "14%", "15%", "12%", "14%", "10%"]);
const TABLE_LAYOUT_STYLE = Object.freeze({ width: "100%", minWidth: 0, maxWidth: "100%", tableLayout: "fixed" });
const TABLE_CELL_TEXT_STYLE = Object.freeze({ display: "block", minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
const TABLE_CONTROL_STYLE = Object.freeze({ width: "100%", minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" });
const TABLE_BADGE_STYLE = Object.freeze({ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });

const EMPTY_FILTERS = Object.freeze({
  category: "",
  route: "",
  sourceFile: "",
  featureArea: "",
  reviewStatus: "",
  partialAdoption: "",
});

const STATUS_TONES = Object.freeze({
  Pending: "neutral",
  Keep: "success",
  Change: "danger",
  "Unable to Locate": "neutral",
  "Needs Manual Review": "warning",
  "Final Check": "accent-soft",
});

const CATEGORY_TONES = Object.freeze({
  badge: "accent-soft",
  button: "success",
  input: "warning",
  popup: "neutral",
  specialised: "danger",
});

function Badge({ children, tone = "neutral" }) {
  return <span className={`app-badge app-badge--${tone}`} style={TABLE_BADGE_STYLE} title={String(children)}>{children}</span>;
}

function TableCellText({ children }) {
  const text = Array.isArray(children) ? children.join(", ") : String(children || "—");
  return <span style={TABLE_CELL_TEXT_STYLE} title={text}>{text}</span>;
}

function SelectFilter({ label, value, onChange, options }) {
  return (
    <DropdownField
      label={label}
      value={value}
      onChange={onChange}
      options={[{ value: "", label: "All" }, ...options]}
    />
  );
}

function unique(records, selector) {
  return Array.from(new Set(records.flatMap(selector).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function auditSortValue(record) {
  return record.originalAuditId == null ? Number.MAX_SAFE_INTEGER : record.originalAuditId;
}

function compareRecords(left, right, sort) {
  const direction = sort.direction === "asc" ? 1 : -1;
  if (sort.key === "auditId") return (auditSortValue(left) - auditSortValue(right)) * direction;
  const leftValue = String(left[sort.key] ?? "").toLocaleLowerCase();
  const rightValue = String(right[sort.key] ?? "").toLocaleLowerCase();
  return leftValue.localeCompare(rightValue, undefined, { numeric: true }) * direction;
}

function SortButton({ column, label, sort, onSort }) {
  const active = sort.key === column;
  return (
    <button
      type="button"
      className="app-table-action-btn app-table-action-btn--ghost"
      style={TABLE_CONTROL_STYLE}
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}${active ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`}
    >
      {label}{active ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

// Layout-only inline styles for the review popup. Colour, background, radius and spacing all come
// from staffglobal.css tokens; nothing here restyles a surface, button, badge or input.
const SUMMARY_ROW_STYLE = Object.freeze({ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", minWidth: 0 });
const SUMMARY_BADGES_STYLE = Object.freeze({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-sm)", minWidth: 0 });
const SUMMARY_GRID_STYLE = Object.freeze({ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "var(--space-sm) var(--layout-card-gap)", margin: 0, minWidth: 0 });
const FIELD_LABEL_STYLE = Object.freeze({ display: "block", fontWeight: 700, color: "var(--accentText)", fontSize: "var(--text-body-sm)" });
const FIELD_VALUE_STYLE = Object.freeze({ margin: "var(--space-xs) 0 0", whiteSpace: "pre-wrap", minWidth: 0, overflowWrap: "anywhere" });
const SOURCE_CODE_STYLE = Object.freeze({ display: "block", margin: "var(--space-xs) 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-body-sm)" });

// The shared staffglobal.css family each audit category should be adopting, named the way the
// prompt reader (Codex) needs to see it so it looks for the existing shared implementation.
const STAFF_FAMILY_BY_CATEGORY = Object.freeze({
  badge: "badge (`.app-badge`)",
  button: "button (the shared `<Button>` / `.app-btn`)",
  input: "input (`.app-input`)",
  popup: "modal/popup shell (`.app-modal` / the shared `PopupModal`)",
  specialised: "staff styling",
});

function condense(value, limit) {
  const text = String(value ?? "").replace(/`/g, "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

// One sentence, built only from the current finding plus the reviewer's own notes, so the prompt
// stays copy-and-run and never drifts from what is on screen.
function buildCodexPrompt(finding, reviewNotes) {
  if (!finding) return "";
  const family = STAFF_FAMILY_BY_CATEGORY[finding.category] || STAFF_FAMILY_BY_CATEGORY.specialised;
  const note = condense(reviewNotes, 200);
  return [
    `In HNPSystem, inspect the existing implementation of "${condense(finding.sectionName, 120) || "the audited item"}"`,
    ` on route ${condense(finding.route, 120) || "the audited route"}`,
    ` (staff style audit ID ${finding.auditId}; source ${condense(finding.sourceReference, 220) || "not recorded"};`,
    ` audit rationale: ${condense(finding.issueSummary, 240) || "not recorded"})`,
    `, then replace only its local recreation or override of the shared staffglobal.css ${family} family`,
    " with the correct existing shared staff styling/component",
    ", preserving layout, behaviour, permissions, data logic, responsive behaviour and any deliberate feature-specific design",
    note ? `, taking the reviewer note "${note}" into account` : "",
    ", and make no unrelated visual changes.",
  ].join("");
}

// Audit metadata is only kept in the normal popup when it can actually change the decision.
// Group, subsection, the boilerplate per-category recommendation and the parsed line references
// are constant or already implied by the badges and source reference, so they move into the
// collapsed "Full audit record" disclosure instead of competing for attention.
function materialAuditNotes(finding) {
  const rows = [];
  const rationale = String(finding.issueSummary || "").trim();
  if (finding.category === "specialised" && finding.recommendation) {
    rows.push(["Current recommendation", finding.recommendation]);
  }
  if (finding.partialAdoptionNotes && finding.partialAdoptionNotes.trim() !== rationale) {
    rows.push(["Partial-adoption note", finding.partialAdoptionNotes]);
  }
  if (finding.specialistExceptionNotes && finding.specialistExceptionNotes.trim() !== rationale) {
    rows.push(["Specialist-exception note", finding.specialistExceptionNotes]);
  }
  if (!(finding.sourceFiles || []).length && (finding.lineReferences || []).length) {
    rows.push(["Parsed line references", finding.lineReferences.join(", ")]);
  }
  return rows;
}

function Field({ label, value, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span style={FIELD_LABEL_STYLE}>{label}</span>
      {children || <p style={FIELD_VALUE_STYLE}>{value || "—"}</p>}
    </div>
  );
}

function useCopyAction() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return [copied, copy];
}

function FindingSummary({ finding, itemLink, onViewItem }) {
  return (
    <LayerTheme>
      <div style={SUMMARY_ROW_STYLE}>
        <div style={SUMMARY_BADGES_STYLE}>
          <Badge tone="accent-strong">Finding {finding.auditId}</Badge>
          <Badge tone={CATEGORY_TONES[finding.category]}>{finding.type}</Badge>
          <Badge tone={STATUS_TONES[finding.reviewStatus]}>{finding.reviewStatus}</Badge>
          {finding.partialAdoption && <Badge tone="warning">Partial adoption</Badge>}
        </div>
        <Button
          type="button"
          onClick={onViewItem}
          disabled={!itemLink}
          title={itemLink ? `Open ${itemLink.pathname} and locate this item` : "No navigable route could be resolved for this finding"}
        >
          Search / View Item
        </Button>
      </div>
      <dl style={SUMMARY_GRID_STYLE}>
        <Field label="Audit ID" value={finding.originalAuditId ?? "Unnumbered specialised decision"} />
        <Field label="Route" value={finding.route} />
        <Field label="Section / item" value={finding.sectionName} />
      </dl>
    </LayerTheme>
  );
}

function FindingEvidence({ finding }) {
  const [copiedSource, copySource] = useCopyAction();
  const auditNotes = materialAuditNotes(finding);

  return (
    <LayerTheme>
      <Field label="How to see it" value={finding.visibilityInstructions} />
      <Field label="Audit rationale" value={finding.issueSummary} />
      <Field label="Source reference">
        <code style={SOURCE_CODE_STYLE}>{String(finding.sourceReference || "").replace(/`/g, "") || "—"}</code>
        <div className="app-layout-toolbar-row app-toolbar--action">
          <Button type="button" size="sm" variant="secondary" onClick={() => copySource(String(finding.sourceReference || "").replace(/`/g, ""))}>
            {copiedSource ? "Source reference copied" : "Copy source reference"}
          </Button>
        </div>
      </Field>
      {auditNotes.map(([label, value]) => (
        <Field key={label} label={label} value={value} />
      ))}
      <details>
        <summary>Full audit record</summary>
        <dl style={SUMMARY_GRID_STYLE}>
          <Field label="Main audit group" value={finding.auditGroup} />
          <Field label="Audit subsection" value={finding.subsection} />
          <Field label="Parsed line references" value={(finding.lineReferences || []).join(", ")} />
          <Field label="Current recommendation" value={finding.recommendation} />
          <Field label="Partial-adoption note" value={finding.partialAdoptionNotes || "None recorded"} />
          <Field label="Specialist-exception note" value={finding.specialistExceptionNotes || "None recorded"} />
        </dl>
      </details>
    </LayerTheme>
  );
}

function CreatePromptPanel({ finding, notes }) {
  const [copiedPrompt, copyPrompt] = useCopyAction();
  const [regenerationCount, setRegenerationCount] = useState(0);
  const generated = useMemo(() => buildCodexPrompt(finding, notes), [finding, notes]);
  const [prompt, setPrompt] = useState(generated);

  // The prompt always tracks the finding and the reviewer's notes; editing it by hand is allowed
  // but the next detail or note change (or Regenerate) restores the generated wording.
  useEffect(() => { setPrompt(generated); }, [generated, regenerationCount]);

  return (
    <LayerTheme>
      <div style={SUMMARY_ROW_STYLE}>
        <strong>Create Prompt</strong>
        <div className="app-layout-toolbar-row app-toolbar--action">
          <Button type="button" size="sm" onClick={() => copyPrompt(prompt)}>{copiedPrompt ? "Prompt copied" : "Copy Prompt"}</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setRegenerationCount((count) => count + 1)}>Regenerate Prompt</Button>
        </div>
      </div>
      <label>
        <span>Generated Codex prompt</span>
        <textarea
          className="app-input app-input--textarea"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={5}
          aria-label={`Generated Codex prompt for finding ${finding.auditId}`}
        />
      </label>
    </LayerTheme>
  );
}

function ReviewModal({ finding, onClose, onSaved, onDeleted, onViewItem }) {
  const [status, setStatus] = useState(finding?.reviewStatus || "Pending");
  const [notes, setNotes] = useState(finding?.reviewNotes || "");
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(finding?.reviewStatus || "Pending");
    setNotes(finding?.reviewNotes || "");
    setHistory([]);
    setConfirmingDelete(false);
    setError("");
    if (!finding) return;
    let active = true;
    fetch(`${API_PATH}?historyFor=${encodeURIComponent(finding.id)}`)
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (active && response.ok) setHistory(payload.data || []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [finding]);

  if (!finding) return null;

  const save = async (nextStatus = status) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(API_PATH, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: finding.id, reviewStatus: nextStatus, reviewNotes: notes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Review decision could not be saved.");
      onSaved(payload.data);
    } catch (saveError) {
      setError(saveError.message || "Review decision could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(API_PATH, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: finding.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Finding could not be deleted.");
      onDeleted(finding.id);
    } catch (deleteError) {
      setError(deleteError.message || "Finding could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  const itemLink = buildStaffStyleReviewItemLink(finding);

  return (
    <StaffModal
      open
      size="lg"
      title={`Review ${finding.auditId}`}
      ariaLabel={`Review ${finding.auditId}: ${finding.sectionName}`}
      description="The audit entry is evidence for a decision, not an automatic verdict that the current implementation is wrong."
      onClose={onClose}
      headerActions={
        <>
          <Button type="button" size="sm" onClick={() => save("Keep")} disabled={saving || deleting}>{saving ? "Saving…" : "Keep"}</Button>
          <Button type="button" size="sm" onClick={() => save()} disabled={saving || deleting}>Save selected status</Button>
          <Button type="button" size="sm" variant="danger" onClick={() => setConfirmingDelete(true)} disabled={saving || deleting}>Delete finding</Button>
        </>
      }
    >
      <FindingSummary finding={finding} itemLink={itemLink} onViewItem={() => onViewItem(finding)} />
      {error && <StaffAlert tone="danger" title="Review action failed">{error}</StaffAlert>}
      {confirmingDelete && (
        <StaffAlert tone="danger" title="Permanently delete this finding?">
          This removes audit ID {finding.auditId} and its review history from the Staff Style Review database tables.
          <div className="app-layout-toolbar-row app-toolbar--action">
            <Button type="button" variant="danger" onClick={remove} disabled={deleting}>{deleting ? "Deleting…" : "Delete permanently"}</Button>
            <Button type="button" variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Cancel deletion</Button>
          </div>
        </StaffAlert>
      )}
      <FindingEvidence finding={finding} />
      <LayerTheme>
        <DropdownField
          label="Review status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={STAFF_STYLE_REVIEW_STATUSES}
        />
        <label>
          <span>Developer review notes</span>
          <textarea
            className="app-input app-input--textarea"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={5}
            maxLength={10000}
            placeholder="Record what was checked, evidence found, and the reason for the decision."
          />
        </label>
      </LayerTheme>
      <LayerTheme>
        <strong>Decision history</strong>
        {history.length === 0 ? (
          <span>No prior review changes.</span>
        ) : (
          <ol>
            {history.map((entry) => (
              <li key={entry.id}>
                {entry.previous_status || "Initial"} → {entry.new_status} by {entry.changed_by} on {new Date(entry.changed_at).toLocaleString("en-GB")}
              </li>
            ))}
          </ol>
        )}
      </LayerTheme>
      <CreatePromptPanel finding={finding} notes={notes} />
    </StaffModal>
  );
}

export default function StaffStyleReviewPage() {
  const router = useRouter();
  const [records, setRecords] = useState([]);
  const [metadata, setMetadata] = useState({ counts: {}, warnings: [], total: 0, persistenceAvailable: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState({ key: "auditId", direction: "asc" });
  const [page, setPage] = useState(1);
  const [reviewFinding, setReviewFinding] = useState(null);

  // Carries the audit ID / item / source hints so the future developer element-finding system can
  // take the reviewer straight to the component rather than only to the route.
  const navigateToFinding = (finding) => {
    const destination = buildStaffStyleReviewItemLink(finding);
    if (destination) router.push(destination);
  };

  const load = async () => {
    setError("");
    try {
      const response = await fetch(API_PATH);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Review findings could not be loaded.");
      setRecords(payload.data || []);
      setMetadata(payload);
    } catch (loadError) {
      setError(loadError.message || "Review findings could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const options = useMemo(() => ({
    categories: unique(records, (record) => [record.category]),
    routes: unique(records, (record) => [record.route]),
    sourceFiles: unique(records, (record) => record.sourceFiles),
    featureAreas: unique(records, (record) => [record.featureArea]),
  }), [records]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return records
      .filter((record) => !query || [
        record.auditId,
        record.type,
        record.route,
        record.sectionName,
        record.visibilityInstructions,
        record.issueSummary,
        record.sourceReference,
        record.reviewNotes,
      ].some((value) => String(value || "").toLocaleLowerCase().includes(query)))
      .filter((record) => !filters.category || record.category === filters.category)
      .filter((record) => !filters.route || record.route === filters.route)
      .filter((record) => !filters.sourceFile || record.sourceFiles.includes(filters.sourceFile))
      .filter((record) => !filters.featureArea || record.featureArea === filters.featureArea)
      .filter((record) => !filters.reviewStatus || record.reviewStatus === filters.reviewStatus)
      .filter((record) => !filters.partialAdoption || String(record.partialAdoption) === filters.partialAdoption)
      .sort((left, right) => compareRecords(left, right, sort));
  }, [records, search, filters, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const setFilter = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    setPage(1);
  };

  const onSort = (key) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
  };

  const onSaved = (updated) => {
    setRecords((current) => current.map((record) => record.id === updated.id ? updated : record));
    setReviewFinding(updated);
  };

  const onDeleted = (id) => {
    setRecords((current) => current.filter((record) => record.id !== id));
    setReviewFinding(null);
  };

  if (loading) return <PageSkeleton />;

  return (
    <>
      <StaffPageHeader
        subtitle="Phase 1 review queue imported only from the existing markdown audit. Findings require a Developer decision and are not automatic styling verdicts."
      />

      {error && <StaffAlert tone="danger" title="Review page error">{error}</StaffAlert>}
      {(metadata.warnings || []).map((warning, index) => (
        <StaffAlert key={`${warning.code || "warning"}-${index}`} tone="warning" title="Import validation warning">
          {warning.auditId ? `ID ${warning.auditId}: ` : ""}{warning.message}
        </StaffAlert>
      ))}

      <StaffFilterBar
        actions={
          <Button type="button" variant="secondary" onClick={() => { setSearch(""); setFilters(EMPTY_FILTERS); setPage(1); }}>
            Reset filters
          </Button>
        }
      >
        <label>
          <span>Search findings</span>
          <input
            type="search"
            className="app-input app-input--search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="ID, route, section, issue, source or note"
          />
        </label>
        <SelectFilter label="Category" value={filters.category} onChange={setFilter("category")} options={options.categories} />
        <SelectFilter label="Route" value={filters.route} onChange={setFilter("route")} options={options.routes} />
        <SelectFilter label="Source file" value={filters.sourceFile} onChange={setFilter("sourceFile")} options={options.sourceFiles} />
        <SelectFilter label="Feature area" value={filters.featureArea} onChange={setFilter("featureArea")} options={options.featureAreas} />
        <SelectFilter label="Review status" value={filters.reviewStatus} onChange={setFilter("reviewStatus")} options={STAFF_STYLE_REVIEW_STATUSES} />
        <SelectFilter
          label="Partial adoption"
          value={filters.partialAdoption}
          onChange={setFilter("partialAdoption")}
          options={[{ value: "true", label: "Partial adoption only" }, { value: "false", label: "No partial adoption note" }]}
        />
      </StaffFilterBar>

      <LayerTheme>
        <div className="app-layout-toolbar-row app-toolbar--header">
          <strong>{filtered.length} matching findings</strong>
          <span>Page {currentPage} of {pageCount}</span>
        </div>
        <div className="app-table-shell-wrap">
          <table
            className="app-data-table app-data-table--compact app-table-shell app-table-shell--with-headings app-data-table--rounded"
            aria-label="Staff style review findings"
            data-staff-style-review-table
            style={TABLE_LAYOUT_STYLE}
          >
            <colgroup>
              {TABLE_COLUMN_WIDTHS.map((width, index) => (
                <col key={`${width}-${index}`} style={{ width, minWidth: 0, maxWidth: width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" aria-sort={sort.key === "auditId" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><SortButton column="auditId" label="ID" sort={sort} onSort={onSort} /></th>
                <th scope="col" aria-sort={sort.key === "type" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><SortButton column="type" label="Type" sort={sort} onSort={onSort} /></th>
                <th scope="col" aria-sort={sort.key === "route" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><SortButton column="route" label="Route" sort={sort} onSort={onSort} /></th>
                <th scope="col" aria-sort={sort.key === "sectionName" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><SortButton column="sectionName" label="Section" sort={sort} onSort={onSort} /></th>
                <th scope="col"><TableCellText>Visibility instructions</TableCellText></th>
                <th scope="col"><TableCellText>Issue summary</TableCellText></th>
                <th scope="col"><TableCellText>Source files</TableCellText></th>
                <th scope="col" aria-sort={sort.key === "reviewStatus" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><SortButton column="reviewStatus" label="Review status" sort={sort} onSort={onSort} /></th>
                <th scope="col"><TableCellText>Actions</TableCellText></th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((finding) => (
                <FragmentRow
                  key={finding.id}
                  finding={finding}
                  destination={resolveStaffStyleReviewRoute(finding.route)}
                  onNavigate={() => navigateToFinding(finding)}
                  onReview={() => setReviewFinding(finding)}
                />
              ))}
              {visibleRecords.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <span className="app-status-message app-status-message--info">No findings match the current search and filters.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <StaffPagination
          page={currentPage}
          pageCount={pageCount}
          onPrevious={() => setPage(Math.max(1, currentPage - 1))}
          onNext={() => setPage(Math.min(pageCount, currentPage + 1))}
          onPageChange={setPage}
          label="Staff style review findings pages"
        />
      </LayerTheme>

      <ReviewModal
        finding={reviewFinding}
        onClose={() => setReviewFinding(null)}
        onSaved={onSaved}
        onDeleted={onDeleted}
        onViewItem={navigateToFinding}
      />
      {/* Local specificity correction: app-table-shell's later 12px cell padding otherwise makes a tokenised 32px control produce a 56px row. */}
      <style jsx global>{`
        html.staff-scope table[data-staff-style-review-table] th,
        html.staff-scope table[data-staff-style-review-table] td {
          min-width: 0;
          max-width: 0;
          overflow: hidden;
          padding: calc((var(--table-row-height) - var(--table-action-btn-height)) / 2) var(--space-1) !important;
        }

        html.staff-scope table[data-staff-style-review-table] tbody tr {
          height: var(--table-row-height) !important;
          max-height: var(--table-row-height);
        }

        html.staff-scope table[data-staff-style-review-table] .app-badge {
          height: var(--table-action-btn-height);
          min-height: var(--table-action-btn-height);
          max-height: var(--table-action-btn-height);
          box-sizing: border-box;
        }

        html.staff-scope table[data-staff-style-review-table] tbody .app-table-action-btn {
          width: var(--table-action-btn-height);
          min-width: var(--table-action-btn-height);
          max-width: var(--table-action-btn-height);
          height: var(--table-action-btn-height) !important;
          min-height: var(--table-action-btn-height);
          max-height: var(--table-action-btn-height);
          padding: 0;
        }
      `}</style>
    </>
  );
}

function FragmentRow({ finding, destination, onNavigate, onReview }) {
  const handleRowClick = (event) => {
    if (!(event.target instanceof Element) || event.target.closest("button, a, input, select, textarea, summary")) return;
    onReview();
  };
  return (
    <tr
      onClick={handleRowClick}
      title="Review this finding"
    >
        <td><TableCellText>{finding.auditId}</TableCellText></td>
        <td><Badge tone={CATEGORY_TONES[finding.category]}>{finding.type}</Badge></td>
        <td><TableCellText>{finding.route}</TableCellText></td>
        <td><TableCellText>{finding.sectionName}</TableCellText></td>
        <td><TableCellText>{finding.visibilityInstructions}</TableCellText></td>
        <td><TableCellText>{finding.issueSummary}</TableCellText></td>
        <td><TableCellText>{finding.sourceFiles}</TableCellText></td>
        <td><Badge tone={STATUS_TONES[finding.reviewStatus]}>{finding.reviewStatus}</Badge></td>
        <td>
          <div className="app-layout-toolbar-row app-toolbar--action">
            {destination && (
              <button
                type="button"
                className="app-table-action-btn app-table-action-btn--ghost"
                onClick={onNavigate}
                aria-label={`Open ${destination}`}
                title={`Open ${destination}`}
              >
                ↗
              </button>
            )}
          </div>
        </td>
    </tr>
  );
}
