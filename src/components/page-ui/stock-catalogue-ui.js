// file location: src/components/page-ui/stock-catalogue-ui.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import { DropdownField } from "@/components/ui/dropdownAPI";
import PopupModal from "@/components/popups/popupStyleApi";

const QUICK_FILTERS = [
  { id: "all", label: "All parts" },
  { id: "attention", label: "Needs attention" },
  { id: "low", label: "Low stock" },
  { id: "out", label: "Out of stock" },
  { id: "on_order", label: "On order" },
  { id: "reserved", label: "Reserved" },
  { id: "recent", label: "Recently added" },
];

const numberValue = (value) => Number(value) || 0;
// Keep the wrapped Potential margin row exactly 10px from the summary row above and overview panels below.
const STOCK_OVERVIEW_SECTION_GAP = "10px";
const availableStock = (part) =>
  numberValue(part?.qty_in_stock) - numberValue(part?.qty_reserved);

const stockStatusBadgeTone = (status) => {
  if (status === "low_stock") return "app-badge--warning";
  if (status === "back_order") return "app-badge--danger";
  if (status === "high_stock") return "app-badge--success";
  return "app-badge--accent-soft";
};

const linkedJobStatusBadgeTone = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("cancel") || normalized.includes("reject")) return "app-badge--danger";
  if (normalized.includes("wait") || normalized.includes("pending") || normalized.includes("order")) return "app-badge--warning";
  if (normalized.includes("book") || normalized.includes("pick") || normalized.includes("fit") || normalized.includes("stock")) return "app-badge--success";
  return "app-badge--neutral";
};

const matchesQuickFilter = (part, filter) => {
  const onHand = numberValue(part.qty_in_stock);
  const reserved = numberValue(part.qty_reserved);
  const onOrder = numberValue(part.qty_on_order);
  const reorder = numberValue(part.reorder_level);
  if (filter === "attention") return availableStock(part) <= reorder || onOrder > 0;
  if (filter === "low") return onHand > 0 && availableStock(part) <= reorder;
  if (filter === "out") return onHand <= 0;
  if (filter === "on_order") return onOrder > 0;
  if (filter === "reserved") return reserved > 0;
  if (filter === "recent") {
    const created = new Date(part.created_at || 0).getTime();
    return created > Date.now() - 30 * 24 * 60 * 60 * 1000;
  }
  return true;
};

const searchRank = (part, rawTerm) => {
  const term = String(rawTerm || "").trim().toLowerCase();
  if (!term) return 0;
  const partNumber = String(part.part_number || "").toLowerCase();
  const oem = String(part.oem_reference || "").toLowerCase();
  const description = `${part.name || ""} ${part.description || ""}`.toLowerCase();
  if (partNumber === term) return 0;
  if (partNumber.startsWith(term)) return 1;
  if (oem === term) return 2;
  if (oem.startsWith(term)) return 3;
  if (partNumber.includes(term)) return 4;
  if (oem.includes(term)) return 5;
  if (description.startsWith(term)) return 6;
  if (description.includes(term)) return 7;
  return 8;
};

export default function StockCataloguePageUi(props) {
  const {
    ConfirmationDialog,
    JOB_PART_STATUSES,
    PRE_PICK_OPTIONS,
    RequirementBadge,
    STORAGE_LOCATION_CODES,
    SearchBar,
    buttonStyle,
    cardStyle,
    confirmDialog,
    displayLimit,
    displayedJobParts,
    editedPart,
    filterType,
    formatCurrency,
    formatDateTime,
    formatMargin,
    formatStatusLabel,
    getPipelineStageMeta,
    handleCancelEdit,
    handleEditPart,
    handleJobPartUpdate,
    handleSavePart,
    inventory,
    inventoryError,
    inventoryLoading,
    inventorySearch,
    isEditMode,
    isPartModalOpen,
    isSavingPart,
    jobCardSectionExpanded,
    jobData,
    jobError,
    jobLoading,
    jobParts,
    jobRequests,
    jobSearch,
    locationFilter,
    locationSearchTerm,
    mapPartStatusToPipelineId,
    matchesLinkedJobStatus,
    partsPipeline,
    pendingJobParts,
    renderAddToJobModal,
    renderDeliveryModal,
    resetAddToJobModal,
    resolveSourceMeta,
    resolveStatusStyles,
    searchJob,
    sectionTitleStyle,
    selectedPart,
    selectedPipelineStage,
    setConfirmDialog,
    setDisplayLimit,
    setEditedPart,
    setFilterType,
    setInventorySearch,
    setIsEditMode,
    setIsPartModalOpen,
    setJobCardSectionExpanded,
    setJobSearch,
    setLocationFilter,
    setLocationSearchTerm,
    setSelectedPart,
    setSelectedPipelineStage,
    setShowAddToJobModal,
    setStatusFilter,
    statusFilter,
    tableStyle,
  } = props; // receive page logic props.

  const [quickFilter, setQuickFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stockSummary, setStockSummary] = useState(null);
  const [stockSummaryLoading, setStockSummaryLoading] = useState(true);
  const [stockSummaryError, setStockSummaryError] = useState("");
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [recentReceiptsError, setRecentReceiptsError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadSummary = async () => {
      setStockSummaryLoading(true);
      setStockSummaryError("");
      try {
        const response = await fetch("/api/parts/summary", { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to load stock summary");
        }
        setStockSummary(payload.summary || null);
      } catch (error) {
        if (error?.name !== "AbortError") {
          setStockSummaryError(error.message || "Unable to load stock summary");
        }
      } finally {
        if (!controller.signal.aborted) setStockSummaryLoading(false);
      }
    };
    loadSummary();
    return () => controller.abort();
  }, [selectedPart?.updated_at]);

  useEffect(() => {
    if (!isPartModalOpen || !selectedPart?.id) return undefined;
    const controller = new AbortController();
    const loadReceipts = async () => {
      setRecentReceiptsError("");
      try {
        const query = new URLSearchParams({ partId: selectedPart.id, limit: "8" });
        const response = await fetch(`/api/parts/delivery-logs?${query.toString()}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.message || "Unable to load receipts");
        setRecentReceipts(payload.deliveryLogs || []);
      } catch (error) {
        if (error?.name !== "AbortError") setRecentReceiptsError(error.message || "Unable to load receipts");
      }
    };
    loadReceipts();
    return () => controller.abort();
  }, [isPartModalOpen, selectedPart?.id]);

  const categories = useMemo(
    () => [...new Set(inventory.map((part) => part.category).filter(Boolean))].sort(),
    [inventory]
  );
  const suppliers = useMemo(
    () => [...new Set(inventory.map((part) => part.supplier).filter(Boolean))].sort(),
    [inventory]
  );
  const filteredInventory = useMemo(() => {
    return inventory
      .filter((part) => matchesQuickFilter(part, quickFilter))
      .filter((part) => statusFilter === "all" || part.stock_status === statusFilter)
      .filter((part) => locationFilter === "all" || part.storage_location === locationFilter)
      .filter((part) => categoryFilter === "all" || part.category === categoryFilter)
      .filter((part) => supplierFilter === "all" || part.supplier === supplierFilter)
      .sort((a, b) => searchRank(a, inventorySearch) - searchRank(b, inventorySearch));
  }, [categoryFilter, inventory, inventorySearch, locationFilter, quickFilter, statusFilter, supplierFilter]);

  const loadedStock = useMemo(() => inventory.reduce((totals, part) => {
    totals.onHand += numberValue(part.qty_in_stock);
    totals.reserved += numberValue(part.qty_reserved);
    totals.onOrder += numberValue(part.qty_on_order);
    totals.available += availableStock(part);
    totals.openJobs += numberValue(part.open_job_count);
    return totals;
  }, { onHand: 0, reserved: 0, onOrder: 0, available: 0, openJobs: 0 }), [inventory]);

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div className="app-page-stack" style={{ gap: "var(--layout-card-gap)" }}>
        <LayerTheme
          as="section"
          sectionKey="stock-catalogue-overview"
          parentKey="stock-catalogue-page"
          gap="var(--layout-card-gap)"
        >
          <div className="app-layout-header-row">
            <div>
              <h1 style={{ margin: 0, color: "var(--accentText)", fontSize: "var(--text-h2)", letterSpacing: "-0.02em" }}>
                Parts inventory
              </h1>
            </div>
            <span className="app-badge app-badge--accent-soft">
              Available = on hand − reserved
            </span>
          </div>

          {stockSummaryError ? <div className="app-status-message app-status-message--warning">
            Summary unavailable. Catalogue search and stock actions are still available.
          </div> : null}

          <div style={{ display: "grid", gap: STOCK_OVERVIEW_SECTION_GAP }}>
            <div
              className="app-summary-grid"
              role="list"
              aria-label="Stock catalogue summary"
              style={{ columnGap: "var(--layout-card-gap)", rowGap: STOCK_OVERVIEW_SECTION_GAP }}
            >
            {[
              ["Active parts", stockSummary?.totalParts],
              ["In stock", stockSummary?.inStockCount],
              ["Low stock", stockSummary?.lowStockCount],
              ["Out of stock", stockSummary?.outOfStockCount],
              ["On order", stockSummary?.quantityOnOrder],
              ["Reserved", stockSummary?.reservedQuantity],
              ["Stock value", stockSummary ? formatCurrency(stockSummary.totalInventoryValue) : null],
              ["Retail value", stockSummary ? formatCurrency(stockSummary.totalRetailValue) : null],
              ["Potential margin", stockSummary ? formatCurrency(stockSummary.potentialMargin) : null],
            ].map(([label, value]) => <LayerSurface
              key={label}
              className="app-summary-item"
              padding="8px 10px"
              radius="var(--radius-sm)"
              gap="2px var(--space-sm)"
              sectionType="stat-card"
              role="listitem"
              style={{ flexDirection: "row" }}
            >
              <span className="app-summary-label">{label}</span>
              <strong className="app-summary-value">
                {stockSummaryLoading ? "…" : value ?? 0}
              </strong>
              </LayerSurface>)}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--layout-card-gap)" }}>
            <LayerSurface padding="var(--space-3)" radius="var(--radius-sm)" gap="var(--space-2)">
              <strong style={{ color: "var(--accentText)" }}>Stock status breakdown</strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-2)" }}>
                {[
                  ["On hand", loadedStock.onHand],
                  ["Reserved", loadedStock.reserved],
                  ["Available", loadedStock.available],
                  ["On order", loadedStock.onOrder],
                  ["Back order", inventory.filter((part) => part.stock_status === "back_order").length],
                  ["Expected soon", loadedStock.onOrder],
                  ["Inactive", stockSummary?.inactiveParts ?? 0],
                ].map(([label, value]) => <div key={label}>
                  <div style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>{label}</div>
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>{value}</strong>
                </div>)}
              </div>
              <span style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>
                Quantities reflect the currently loaded catalogue result. Expected soon excludes received stock.
              </span>
            </LayerSurface>

            <LayerSurface padding="var(--space-3)" radius="var(--radius-sm)" gap="var(--space-2)">
              <strong style={{ color: "var(--accentText)" }}>Demand overview</strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-2)" }}>
                <div>
                  <div style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>Open job requirements</div>
                  <strong style={{ fontSize: "var(--text-h3)", fontVariantNumeric: "tabular-nums" }}>{stockSummary?.activeJobParts ?? loadedStock.openJobs}</strong>
                </div>
                <div>
                  <div style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>Parts linked to open jobs</div>
                  <strong style={{ fontSize: "var(--text-h3)", fontVariantNumeric: "tabular-nums" }}>{loadedStock.openJobs}</strong>
                </div>
              </div>
              <span style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>
                Appointment and VHC impact is shown only where it is present in linked job requirements.
              </span>
            </LayerSurface>

            <LayerSurface padding="var(--space-3)" radius="var(--radius-sm)" gap="var(--space-2)">
              <strong style={{ color: "var(--accentText)" }}>Top categories by cost value</strong>
              {(stockSummary?.topCategoriesByValue || []).length > 0 ?
                stockSummary.topCategoriesByValue.slice(0, 4).map((item) => <div key={item.category} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)" }}>
                  <span style={{ color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.category}</span>
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(item.value)}</strong>
                </div>) :
                <span style={{ color: "var(--text-1)", fontSize: "var(--text-body-sm)" }}>No category value data available.</span>}
            </LayerSurface>
            </div>
          </div>
        </LayerTheme>

        <div data-dev-section="1" data-dev-section-key="stock-catalogue-find-job" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-page" data-dev-text-preview="Find Job Card" style={{
      ...cardStyle,
      backgroundColor: "var(--theme)"
    }}>
          <div data-dev-section="1" data-dev-section-key="stock-catalogue-find-job-header" data-dev-section-type="toolbar" data-dev-section-parent="stock-catalogue-find-job" data-dev-text-preview="Find Job Card header" style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        marginBottom: "16px"
      }}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Find Job Card</h2>
            <form data-dev-section="1" data-dev-section-key="stock-catalogue-find-job-search-form" data-dev-section-type="filter-row" data-dev-section-parent="stock-catalogue-find-job-header" data-dev-text-preview="Job search form" onSubmit={event => {
          event.preventDefault();
          searchJob(jobSearch);
        }} style={{
          display: "flex",
          gap: "12px",
          flex: "1 1 320px",
          maxWidth: "640px"
        }}>
              <SearchBar
                type="search"
                placeholder="Job number or registration"
                ariaLabel="Job number or registration"
                value={jobSearch}
                onChange={event => setJobSearch(event.target.value)}
                onClear={() => setJobSearch("")}
                disabled={jobLoading}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Button type="submit" variant="primary" busy={jobLoading}>
                Search
              </Button>
            </form>
          </div>

          {jobError && <div style={{
          color: "var(--danger)",
          marginBottom: "12px",
          fontWeight: 600
        }}>
                  {jobError}
                </div>}

              {jobData ? <>
                  <div data-dev-section="1" data-dev-section-key="stock-catalogue-job-summary-grid" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-find-job" data-dev-text-preview="Job / Vehicle / Status summary" style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "12px",
            marginBottom: "16px"
          }}>
                    <div data-dev-section="1" data-dev-section-key="stock-catalogue-summary-job" data-dev-section-type="stat-card" data-dev-section-parent="stock-catalogue-job-summary-grid" data-dev-text-preview="Job summary card" style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              padding: "14px",
              border: "none"
            }}>
                      <div style={{
                fontSize: "var(--text-label)",
                color: "var(--danger)"
              }}>JOB</div>
                      <div style={{
                fontSize: "var(--text-h3)",
                fontWeight: 700,
                color: "var(--primary)"
              }}>
                        {jobData.jobNumber}
                      </div>
                      <div>{jobData.description || "No description"}</div>
                    </div>
                    <div data-dev-section="1" data-dev-section-key="stock-catalogue-summary-vehicle" data-dev-section-type="stat-card" data-dev-section-parent="stock-catalogue-job-summary-grid" data-dev-text-preview="Vehicle summary card" style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              padding: "14px",
              border: "none"
            }}>
                      <div style={{
                fontSize: "var(--text-label)",
                color: "var(--danger)"
              }}>VEHICLE</div>
                      <div style={{
                fontSize: "var(--text-h3)",
                fontWeight: 700
              }}>{jobData.reg}</div>
                      <div>{jobData.makeModel || `${jobData.make} ${jobData.model}`}</div>
                    </div>
                    <div data-dev-section="1" data-dev-section-key="stock-catalogue-summary-status" data-dev-section-type="stat-card" data-dev-section-parent="stock-catalogue-job-summary-grid" data-dev-text-preview="Job status summary card" style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              padding: "14px",
              border: "none"
            }}>
                      <div style={{
                fontSize: "var(--text-label)",
                color: "var(--danger)"
              }}>STATUS</div>
                      <div style={{
                fontSize: "var(--text-h3)",
                fontWeight: 700
              }}>
                        {jobData.status}
                      </div>
                      <div>{jobData.waitingStatus}</div>
                    </div>
                  </div>

                  <div data-dev-section="1" data-dev-section-key="stock-catalogue-parts-header" data-dev-section-type="toolbar" data-dev-section-parent="stock-catalogue-find-job" data-dev-text-preview="Parts on this Job header" style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px"
          }}>
                    <h3 style={{
              ...sectionTitleStyle,
              marginBottom: 0
            }}>
                      Parts on this Job
                    </h3>
                  </div>

                  {jobParts.length > 0 && <div data-dev-section="1" data-dev-section-key="stock-catalogue-pipeline-filters" data-dev-section-type="filter-row" data-dev-section-parent="stock-catalogue-find-job" data-dev-text-preview="Pipeline stage filter chips" className="tab-api" style={{
            height: "auto",
            minHeight: "44px",
            flexWrap: "wrap",
            marginBottom: "12px"
          }}>
                      <button type="button" onClick={() => setSelectedPipelineStage("all")} aria-pressed={selectedPipelineStage === "all"} className={`tab-api__item${selectedPipelineStage === "all" ? " is-active" : ""}`}>
                        All Parts ({jobParts.length})
                      </button>
                      {partsPipeline.stageSummary.map(stage => <button key={stage.id} type="button" onClick={() => setSelectedPipelineStage(stage.id)} aria-pressed={selectedPipelineStage === stage.id} className={`tab-api__item${selectedPipelineStage === stage.id ? " is-active" : ""}`}>
                          {stage.label} ({stage.count})
                        </button>)}
                    </div>}

                  {selectedPipelineStage !== "all" && displayedJobParts.length === 0 && <div style={{
            background: "var(--warning-surface)",
            borderRadius: "var(--radius-sm)",
            border: "none",
            padding: "10px 14px",
            marginBottom: "12px",
            color: "var(--danger-dark)",
            fontSize: "var(--text-body)"
          }}>
                      No parts currently staged for{" "}
                      {getPipelineStageMeta(selectedPipelineStage).label}.
                    </div>}

                  {jobParts.length === 0 ? <div data-dev-section="1" data-dev-section-key="stock-catalogue-job-parts-empty" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-find-job" data-dev-text-preview="No parts linked empty state" style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-xs)",
            padding: "16px",
            color: "var(--danger)",
            textAlign: "center"
          }}>
                      No parts linked to this job. Add required parts to get started.
                    </div> : <div data-dev-section="1" data-dev-section-key="stock-catalogue-job-parts-scroll" data-dev-section-type="data-table" data-dev-section-parent="stock-catalogue-find-job" data-dev-text-preview="Job parts table scroll" style={{
            overflowX: "auto"
          }}>
                      <table data-dev-section="1" data-dev-section-key="stock-catalogue-job-parts-table" data-dev-section-type="data-table" data-dev-section-parent="stock-catalogue-job-parts-scroll" data-dev-text-preview="Job parts table" className="app-data-table">
                        <thead>
                          <tr>
                            <th style={{ width: "26%" }}>Part</th>
                            <th style={{ width: "12%" }}>Qty</th>
                            <th style={{ width: "12%" }}>Stage</th>
                            <th style={{ width: "14%" }}>Status</th>
                            <th style={{ width: "14%" }}>Pre-pick</th>
                            <th style={{ width: "22%" }}>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedJobParts.map(part => {
                  const stageId = mapPartStatusToPipelineId(part.status);
                  const stageMeta = getPipelineStageMeta(stageId);
                  const rawNotes = part.request_notes || "";
                  const metaMatch = rawNotes.match(/VHC_META:(\{.*\})/);
                  let vhcMeta = null;
                  let notesText = rawNotes;
                  if (metaMatch) {
                    try {
                      vhcMeta = JSON.parse(metaMatch[1]);
                    } catch (_) {
                      vhcMeta = null;
                    }
                    notesText = rawNotes.replace(metaMatch[0], "").trim();
                  }
                  const metaChip = (label, value) => <span className="app-table-action-btn" style={{
                    cursor: "default",
                    whiteSpace: "nowrap",
                    background: value ? "rgba(var(--success-rgb), 0.18)" : "var(--surface)",
                    color: value ? "var(--success-dark)" : "var(--text-1)"
                  }}>
                                {label} <strong style={{ marginLeft: "4px" }}>{value ? "Yes" : "No"}</strong>
                              </span>;
                  return <tr key={part.id}>
                              <td style={{ verticalAlign: "middle" }}>
                                <div style={{ fontWeight: 600 }}>
                                  {part.part?.part_number} · {part.part?.name}
                                </div>
                                <div style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--grey-accent-dark)"
                      }}>
                                  {part.part?.storage_location || "No bin"} · Stock: {part.part?.qty_in_stock}
                                </div>
                                <div style={{
                        marginTop: "6px",
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap"
                      }}>
                                  {(() => {
                          const meta = resolveSourceMeta(part.origin);
                          return <RequirementBadge label={meta.label} background={meta.background} color={meta.color} />;
                        })()}
                                  {part.vhc_item_id ? <RequirementBadge label={`VHC #${part.vhc_item_id}`} background="rgba(var(--danger-rgb), 0.18)" color="var(--danger)" /> : null}
                                </div>
                              </td>
                              <td style={{ verticalAlign: "middle" }}>
                                <div style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        marginBottom: "6px"
                      }}>
                                  <span className="app-table-action-btn" style={{ cursor: "default" }}>
                                    Req <strong style={{ marginLeft: "4px" }}>{part.quantity_requested}</strong>
                                  </span>
                                  <span className="app-table-action-btn" style={{ cursor: "default" }}>
                                    Alloc <strong style={{ marginLeft: "4px" }}>{part.quantity_allocated}</strong>
                                  </span>
                                  <span className="app-table-action-btn" style={{ cursor: "default" }}>
                                    Fitted <strong style={{ marginLeft: "4px" }}>{part.quantity_fitted}</strong>
                                  </span>
                                </div>
                                <button type="button" className="app-table-action-btn app-table-action-btn--primary" onClick={() => handleJobPartUpdate(part.id, {
                        quantityFitted: part.quantity_allocated,
                        status: "fitted"
                      })}>
                                  Mark fitted
                                </button>
                              </td>
                              <td style={{ verticalAlign: "middle" }}>
                                <span className="app-table-action-btn" style={{
                        cursor: "default",
                        color: "var(--danger)"
                      }}>
                                  {stageMeta.label}
                                </span>
                                <div style={{
                        marginTop: "4px",
                        fontSize: "var(--text-caption)",
                        color: "var(--grey-accent-dark)"
                      }}>
                                  {stageMeta.description}
                                </div>
                              </td>
                              <td style={{ verticalAlign: "middle" }}>
                                <select className="app-input" value={part.status} onChange={event => handleJobPartUpdate(part.id, {
                        status: event.target.value
                      })}>
                                  {JOB_PART_STATUSES.map(statusValue => <option key={statusValue} value={statusValue}>
                                      {statusValue.replace(/_/g, " ")}
                                    </option>)}
                                </select>
                              </td>
                              <td style={{ verticalAlign: "middle" }}>
                                <select className="app-input" value={part.pre_pick_location || ""} onChange={event => handleJobPartUpdate(part.id, {
                        prePickLocation: event.target.value
                      })}>
                                  {PRE_PICK_OPTIONS.map(option => <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>)}
                                </select>
                              </td>
                              <td style={{
                      verticalAlign: "middle",
                      fontSize: "var(--text-body-sm)"
                    }}>
                                {notesText ? <div style={{ marginBottom: vhcMeta ? "6px" : 0 }}>{notesText}</div> : null}
                                {!notesText && !vhcMeta ? "—" : null}
                                {vhcMeta ? <div style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px"
                      }}>
                                  {metaChip("Warranty", !!vhcMeta.warranty)}
                                  {metaChip("Back order", !!vhcMeta.backOrder)}
                                  {metaChip("Surcharge", !!vhcMeta.surcharge)}
                                </div> : null}
                              </td>
                            </tr>;
                })}
                        </tbody>
                      </table>
                    </div>}

                  {jobRequests.length > 0 && <div data-dev-section="1" data-dev-section-key="stock-catalogue-workshop-requests" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-find-job" data-dev-text-preview="Workshop Requests block" style={{
            marginTop: "20px"
          }}>
                      <h4 style={{
              ...sectionTitleStyle,
              marginBottom: "8px"
            }}>Workshop Requests</h4>
                      <div data-dev-section="1" data-dev-section-key="stock-catalogue-workshop-requests-scroll" data-dev-section-type="data-table" data-dev-section-parent="stock-catalogue-workshop-requests" style={{
              overflowX: "auto"
            }}>
                        <table data-dev-section="1" data-dev-section-key="stock-catalogue-workshop-requests-table" data-dev-section-type="data-table" data-dev-section-parent="stock-catalogue-workshop-requests-scroll" data-dev-text-preview="Workshop Requests table" style={{
                ...tableStyle,
                fontSize: "var(--text-body)"
              }}>
                          <thead>
                            <tr style={{
                    background: "var(--warning-surface)",
                    color: "var(--danger-dark)"
                  }}>
                              <th style={{
                      textAlign: "left",
                      padding: "10px"
                    }}>Request</th>
                              <th style={{
                      textAlign: "left",
                      padding: "10px"
                    }}>Quantity</th>
                              <th style={{
                      textAlign: "left",
                      padding: "10px"
                    }}>Source</th>
                              <th style={{
                      textAlign: "left",
                      padding: "10px"
                    }}>Status</th>
                              <th style={{
                      textAlign: "left",
                      padding: "10px"
                    }}>Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobRequests.map(request => {
                    const sourceMeta = resolveSourceMeta(request.source);
                    const statusMeta = resolveStatusStyles(request.status);
                    return <tr key={request.request_id} style={{
                      borderBottom: "var(--separating-line)"
                    }}>
                                  <td style={{
                        padding: "10px"
                      }}>
                                    <div style={{
                          fontWeight: 600
                        }}>{request.description || "Part request"}</div>
                                    {request.part ? <div style={{
                          fontSize: "var(--text-label)",
                          color: "var(--info)"
                        }}>
                                        Suggested: {request.part.part_number} · {request.part.name}
                                      </div> : null}
                                  </td>
                                  <td style={{
                        padding: "10px"
                      }}>{request.quantity || 1}</td>
                                  <td style={{
                        padding: "10px"
                      }}>
                                    <RequirementBadge label={sourceMeta.label} background={sourceMeta.background} color={sourceMeta.color} />
                                  </td>
                                  <td style={{
                        padding: "10px"
                      }}>
                                    <RequirementBadge label={formatStatusLabel(request.status)} background={statusMeta.background} color={statusMeta.color} />
                                  </td>
                                  <td style={{
                        padding: "10px"
                      }}>{formatDateTime(request.created_at)}</td>
                                </tr>;
                  })}
                          </tbody>
                        </table>
                      </div>
                    </div>}

                  {pendingJobParts.length > 0 && <div data-dev-section="1" data-dev-section-key="stock-catalogue-pending-warning" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-find-job" data-dev-text-preview="Pending parts warning" style={{
            marginTop: "20px",
            padding: "16px",
            borderRadius: "var(--radius-xs)",
            background: "var(--warning-surface)",
            border: "none",
            color: "var(--warning-dark)"
          }}>
                      <strong>{pendingJobParts.length} part(s)</strong> awaiting stock or action for
                      this VHC. Ensure orders are raised or picked.
                    </div>}
                </> : <div data-dev-section="1" data-dev-section-key="stock-catalogue-find-job-empty" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-find-job" data-dev-text-preview="Find Job empty state" style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-xs)",
          padding: "16px",
          color: "var(--danger)",
          textAlign: "center"
        }}>
                  Search a job to view current parts requirements.
                </div>}
        </div>

        <div data-dev-section="1" data-dev-section-key="stock-catalogue-inventory" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-page" data-dev-text-preview="Stock Catalogue card" style={{
      ...cardStyle,
      backgroundColor: "var(--theme)"
    }} id="stock-catalogue">
          <h2 style={sectionTitleStyle}>Stock Catalogue</h2>

          <div className="tab-api" style={{ height: "auto", minHeight: "44px", flexWrap: "wrap", marginBottom: "var(--layout-card-gap)" }}>
            {QUICK_FILTERS.map((filter) => <button
              key={filter.id}
              type="button"
              className={`tab-api__item${quickFilter === filter.id ? " is-active" : ""}`}
              aria-pressed={quickFilter === filter.id}
              onClick={() => {
                setQuickFilter(filter.id);
                setDisplayLimit(20);
              }}
            >
              {filter.label}
            </button>)}
          </div>

          {/* Search and Filter Controls */}
          <div data-dev-section="1" data-dev-section-key="stock-catalogue-inventory-filters" data-dev-section-type="filter-row" data-dev-section-parent="stock-catalogue-inventory" data-dev-text-preview="Inventory search and filters" style={{
        display: "flex",
        gap: "12px",
        marginBottom: "12px",
        alignItems: "flex-end",
        flexWrap: "wrap"
      }}>
            <SearchBar placeholder="Search part number, description, OEM code" value={inventorySearch} onChange={event => setInventorySearch(event.target.value)} onClear={() => setInventorySearch("")} style={{
          flex: 1
        }} />

            {/* Two-step filter dropdown */}
            <div style={{
          display: "flex",
          gap: "8px"
        }}>
              <select className="app-input" value={filterType} onChange={e => {
            setFilterType(e.target.value);
            setStatusFilter("all");
            setLocationFilter("all");
          }} style={{ minWidth: "140px", width: "auto" }}>
                <option value="status">Filter by Status</option>
                <option value="location">Filter by Location</option>
                <option value="category">Filter by Category</option>
                <option value="supplier">Filter by Supplier</option>
              </select>

              {filterType === "status" && <select className="app-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: "140px", width: "auto" }}>
                  <option value="all">All Status</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="in_stock">Good Stock</option>
                  <option value="high_stock">High Stock</option>
                  <option value="back_order">Back Order</option>
                </select>}

              {filterType === "location" && <div style={{
            position: "relative"
          }}>
                  <input className="app-input" type="text" placeholder="Search location..." value={locationSearchTerm} onChange={e => setLocationSearchTerm(e.target.value)} onFocus={() => {
              document.getElementById('location-dropdown').style.display = 'block';
            }} style={{ minWidth: "140px", width: "auto" }} />
                  <div id="location-dropdown" style={{
              display: "none",
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: "4px",
              background: "var(--surface)",
              border: "none",
              borderRadius: "var(--radius-xs)",
              maxHeight: "300px",
              overflowY: "auto",
              zIndex: "var(--z-dropdown)",
              boxShadow: "var(--shadow-md)"
            }}>
                    <div onClick={() => {
                setLocationFilter("all");
                setLocationSearchTerm("");
                document.getElementById('location-dropdown').style.display = 'none';
              }} style={{
                padding: "10px 12px",
                cursor: "pointer",
                borderBottom: "var(--separating-line)",
                fontWeight: locationFilter === "all" ? 600 : 400,
                background: locationFilter === "all" ? "var(--surface)" : "transparent"
              }} onMouseEnter={e => {
                e.currentTarget.style.background = "var(--surface)";
              }} onMouseLeave={e => {
                e.currentTarget.style.background = locationFilter === "all" ? "var(--surface)" : "transparent";
              }}>
                      All Locations
                    </div>
                    {STORAGE_LOCATION_CODES.filter(code => code.toLowerCase().includes(locationSearchTerm.toLowerCase())).map(code => <div key={code} onClick={() => {
                setLocationFilter(code);
                setLocationSearchTerm(code);
                document.getElementById('location-dropdown').style.display = 'none';
              }} style={{
                padding: "10px 12px",
                cursor: "pointer",
                fontWeight: locationFilter === code ? 600 : 400,
                background: locationFilter === code ? "var(--surface)" : "transparent"
              }} onMouseEnter={e => {
                e.currentTarget.style.background = "var(--surface)";
              }} onMouseLeave={e => {
                e.currentTarget.style.background = locationFilter === code ? "var(--surface)" : "transparent";
              }}>
                          {code}
                        </div>)}
                  </div>
                </div>}
              {filterType === "category" && <DropdownField
                ariaLabel="Filter catalogue by category"
                value={categoryFilter}
                options={[{ value: "all", label: "All categories" }, ...categories.map(category => ({ value: category, label: category }))]}
                onChange={event => {
                  setCategoryFilter(event.target.value);
                  setDisplayLimit(20);
                }}
              />}
              {filterType === "supplier" && <DropdownField
                ariaLabel="Filter catalogue by supplier"
                value={supplierFilter}
                options={[{ value: "all", label: "All suppliers" }, ...suppliers.map(supplier => ({ value: supplier, label: supplier }))]}
                onChange={event => {
                  setSupplierFilter(event.target.value);
                  setDisplayLimit(20);
                }}
              />}
            </div>
          </div>

          {inventoryError && <div style={{
        color: "var(--danger)",
        marginBottom: "12px",
        fontWeight: 600
      }}>
              {inventoryError}
            </div>}

          <div data-dev-section="1" data-dev-section-key="stock-catalogue-inventory-scroll" data-dev-section-type="data-table" data-dev-section-parent="stock-catalogue-inventory" data-dev-text-preview="Inventory results scroll area" style={{
        maxHeight: "min(58dvh, 620px)",
        overflowY: "auto",
        overflowX: "auto"
      }}>
            {inventoryLoading ? <div data-dev-section="1" data-dev-section-key="stock-catalogue-inventory-loading" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-inventory-scroll" data-dev-text-preview="Inventory loading state" style={{
          color: "var(--grey-accent-light)"
        }}>Loading inventory...</div> : inventory.length === 0 ? <div data-dev-section="1" data-dev-section-key="stock-catalogue-inventory-empty" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-inventory-scroll" data-dev-text-preview="Inventory empty state" style={{
          color: "var(--grey-accent-light)"
        }}>No parts found. Refine your search.</div> : <>
                <table className="app-data-table app-data-table--rounded" data-dev-section="1" data-dev-section-key="stock-catalogue-inventory-table" data-dev-section-type="data-table" data-dev-section-parent="stock-catalogue-inventory-scroll" data-dev-text-preview="Inventory results table" style={{
            ...tableStyle,
            fontSize: "var(--text-body)",
            tableLayout: "fixed",
            minWidth: "960px"
          }}>
                  <colgroup>
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "19%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                  </colgroup>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr style={{
                background: "var(--surface)",
                color: "var(--danger)"
              }}>
                      <th>Part Number</th>
                      <th>Part details</th>
                      <th>Category / supplier</th>
                      <th style={{ whiteSpace: "nowrap" }}>Bin</th>
                      <th>Stock</th>
                      <th>Unit cost</th>
                      <th style={{ whiteSpace: "nowrap" }}>Reorder</th>
                      <th style={{ whiteSpace: "nowrap" }}>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.slice(0, displayLimit).map(part => <tr key={part.id} onClick={() => {
                setSelectedPart(part);
                setIsPartModalOpen(true);
              }} style={{
                borderBottom: "var(--separating-line)",
                cursor: "pointer",
                transition: "background 0.15s ease"
              }} onMouseEnter={e => {
                e.currentTarget.style.background = "var(--surface)";
              }} onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
              }}>
                          <td data-label="Part number" style={{
                  fontWeight: 600,
                  color: "var(--primary)",
                  overflowWrap: "anywhere"
                }}>
                            {part.part_number}
                          </td>
                          <td data-label="Part details" style={{ overflow: "hidden" }}>
                            <div title={part.name} style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{part.name}</div>
                            <div style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>
                              OEM {part.oem_reference || "—"}
                            </div>
                          </td>
                          <td data-label="Category / supplier">
                            <div>{part.category || "Uncategorised"}</div>
                            <div style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>{part.supplier || "No supplier"}</div>
                          </td>
                          <td data-label="Bin" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{part.storage_location || "—"}</td>
                          <td data-label="Stock">
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(48px, 1fr))", gap: "var(--space-sm)", fontVariantNumeric: "tabular-nums" }}>
                              <span><small style={{ display: "block", color: "var(--text-1)" }}>Hand</small><strong>{numberValue(part.qty_in_stock)}</strong></span>
                              <span><small style={{ display: "block", color: "var(--text-1)" }}>Reserved</small><strong>{numberValue(part.qty_reserved)}</strong></span>
                              <span><small style={{ display: "block", color: "var(--text-1)" }}>Available</small><strong style={{ color: availableStock(part) <= numberValue(part.reorder_level) ? "var(--danger)" : "var(--success-dark)" }}>{availableStock(part)}</strong></span>
                            </div>
                            {numberValue(part.open_job_count) > 0 ? <div style={{ marginTop: "var(--space-1)", color: "var(--text-1)", fontSize: "var(--text-caption)" }}>
                              Required by open jobs: {numberValue(part.open_job_count)}
                            </div> : null}
                          </td>
                          <td data-label="Unit cost" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(part.unit_cost)}</td>
                          <td data-label="Reorder" style={{ fontVariantNumeric: "tabular-nums" }}>
                            <strong>{numberValue(part.reorder_level)}</strong>
                            {availableStock(part) < numberValue(part.reorder_level) ? <div style={{ color: "var(--danger)", fontSize: "var(--text-caption)" }}>
                              {numberValue(part.reorder_level) - availableStock(part)} below
                            </div> : null}
                            {numberValue(part.qty_on_order) > 0 ? <div style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>
                              {numberValue(part.qty_on_order)} expected soon
                            </div> : null}
                          </td>
                          <td data-label="Status">
                            <span className={`app-badge ${stockStatusBadgeTone(part.stock_status)}`}>
                              {(part.stock_status || "in_stock").replace(/_/g, " ")}
                            </span>
                          </td>
                          <td data-label="Actions">
                            <button type="button" className="app-table-action-btn app-table-action-btn--primary" onClick={event => {
                              event.stopPropagation();
                              setSelectedPart(part);
                              setIsPartModalOpen(true);
                            }}>
                              View
                            </button>
                          </td>
                        </tr>)}
                  </tbody>
                </table>

                {/* Load More Button */}
                {(() => {
            return filteredInventory.length > displayLimit && <div style={{
              textAlign: "center",
              marginTop: "16px"
            }}>
                      <button onClick={() => setDisplayLimit(prev => prev + 20)} style={{
                ...buttonStyle,
                padding: "10px 24px"
              }}>
                        Load More ({filteredInventory.length - displayLimit} remaining)
                      </button>
                    </div>;
          })()}
              </>}
          </div>
        </div>

        {/* Part Details Modal */}
        {isPartModalOpen && selectedPart && <PopupModal
          onClose={() => {
            setIsPartModalOpen(false);
            setIsEditMode(false);
            setEditedPart(null);
          }}
          ariaLabel={`Part details for ${selectedPart.part_number}`}
          cardStyle={{ width: "min(100%, 1180px)" }}
        >
            <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--layout-card-gap)",
        padding: "var(--section-card-padding)"
      }}>
              {/* Header */}
              <header className="app-popup-compact-header">
                <div style={{ minWidth: 0 }}>
                  <h2 style={{
              margin: 0,
              color: "var(--accentText)",
              fontSize: "var(--text-h2)"
            }}>
                    {selectedPart.part_number}
                  </h2>
                  <p style={{
              margin: "var(--space-1) 0 0",
              color: "var(--text-1)",
              fontSize: "var(--text-body-sm)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
                    {selectedPart.name}
                  </p>
                </div>
                <div className="app-popup-compact-header__actions">
                  {!isEditMode ? <Button type="button" variant="primary" onClick={handleEditPart}>
                      Edit
                    </Button> : <>
                      <Button type="button" variant="primary" busy={isSavingPart} onClick={handleSavePart}>
                        Save
                      </Button>
                      <Button type="button" variant="secondary" onClick={handleCancelEdit} disabled={isSavingPart}>
                        Cancel
                      </Button>
                    </>}
                  <Button type="button" variant="secondary" onClick={() => {
              setIsPartModalOpen(false);
              setIsEditMode(false);
              setEditedPart(null);
            }}>
                    Close
                  </Button>
              </div>
              </header>

              {/* Scrollable Content */}
              <div style={{ minWidth: 0 }}>
                {/* Two Column Layout */}
                <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "var(--layout-card-gap)",
            marginBottom: "var(--layout-card-gap)",
            alignItems: "start"
          }}>
                  {/* Left Column - Stock & Pricing */}
                  <div>
                    {/* Stock Overview Card */}
                    <LayerTheme
                      as="section"
                      padding="var(--space-3)"
                      radius="var(--radius-sm)"
                      gap="var(--space-2)"
                      style={{ marginBottom: "var(--layout-card-gap)" }}
                    >
                      <h3 style={{
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  color: "var(--accentText)",
                  margin: 0
                }}>
                        Stock Overview
                      </h3>
                      <div className="app-summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))" }}>
                        <div>
                          <div className="app-summary-label">On Hand</div>
                          {isEditMode ? <input className="app-input" type="number" value={editedPart?.qty_in_stock ?? selectedPart.qty_in_stock} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      qty_in_stock: parseInt(e.target.value) || 0
                    }))} /> : <strong className="app-summary-value">{selectedPart.qty_in_stock}</strong>}
                        </div>
                        <div>
                          <div className="app-summary-label">Reserved</div>
                          {isEditMode ? <input className="app-input" type="number" value={editedPart?.qty_reserved ?? selectedPart.qty_reserved ?? 0} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      qty_reserved: parseInt(e.target.value) || 0
                    }))} /> : <strong className="app-summary-value">{selectedPart.qty_reserved || 0}</strong>}
                        </div>
                        <div>
                          <div className="app-summary-label">On Order</div>
                          {isEditMode ? <input className="app-input" type="number" value={editedPart?.qty_on_order ?? selectedPart.qty_on_order ?? 0} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      qty_on_order: parseInt(e.target.value) || 0
                    }))} /> : <strong className="app-summary-value">{selectedPart.qty_on_order || 0}</strong>}
                        </div>
                        <div>
                          <div className="app-summary-label">Min Level</div>
                          {isEditMode ? <input className="app-input" type="number" value={editedPart?.reorder_level ?? selectedPart.reorder_level ?? 0} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      reorder_level: parseInt(e.target.value) || 0
                    }))} /> : <strong className="app-summary-value">{selectedPart.reorder_level || 0}</strong>}
                        </div>
                        <div>
                          <div className="app-summary-label">Available</div>
                          <strong className="app-summary-value" style={{
                            color: availableStock(isEditMode ? { ...selectedPart, ...editedPart } : selectedPart) <= numberValue(isEditMode ? editedPart?.reorder_level ?? selectedPart.reorder_level : selectedPart.reorder_level) ? "var(--danger)" : "var(--success-dark)"
                          }}>
                            {availableStock(isEditMode ? { ...selectedPart, ...editedPart } : selectedPart)}
                          </strong>
                        </div>
                        <div>
                          <div className="app-summary-label">Back order</div>
                          <strong className="app-summary-value">
                            {selectedPart.stock_status === "back_order" ? numberValue(selectedPart.qty_on_order) : 0}
                          </strong>
                        </div>
                      </div>
                      <div style={{
                  marginTop: "12px",
                  paddingTop: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                        <div>
                          <div className="app-summary-label">Linked Jobs</div>
                          <strong className="app-summary-value">{selectedPart.open_job_count || 0}</strong>
                        </div>
                        <span className={`app-badge ${stockStatusBadgeTone(selectedPart.stock_status)}`}>
                          {(selectedPart.stock_status || "in_stock").replace(/_/g, " ")}
                        </span>
                      </div>
                    </LayerTheme>

                    {/* Pricing Card */}
                    <LayerTheme as="section" padding="var(--space-3)" radius="var(--radius-sm)" gap="var(--space-2)">
                      <h3 style={{
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  color: "var(--accentText)",
                  margin: 0
                }}>
                        Pricing
                      </h3>
                      <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                        <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                          <span style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--text-1)"
                    }}>Cost Price</span>
                          {isEditMode ? <input className="app-input" type="number" step="0.01" value={editedPart?.unit_cost ?? selectedPart.unit_cost} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      unit_cost: parseFloat(e.target.value) || 0
                    }))} /> : <span style={{
                      fontSize: "var(--text-h3)",
                      fontWeight: 700
                    }}>{formatCurrency(selectedPart.unit_cost)}</span>}
                        </div>
                        <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                          <span style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--text-1)"
                    }}>Sell Price</span>
                          {isEditMode ? <input className="app-input" type="number" step="0.01" value={editedPart?.unit_price ?? selectedPart.unit_price} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      unit_price: parseFloat(e.target.value) || 0
                    }))} /> : <span style={{
                      fontSize: "var(--text-h3)",
                      fontWeight: 700,
                      color: "var(--primary)"
                    }}>{formatCurrency(selectedPart.unit_price)}</span>}
                        </div>
                        <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "8px"
                  }}>
                          <span style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--text-1)"
                    }}>Margin</span>
                          <span style={{
                      fontSize: "var(--text-h3)",
                      fontWeight: 700,
                      color: "var(--success-dark)"
                    }}>
                            {isEditMode ? formatMargin(editedPart?.unit_cost ?? selectedPart.unit_cost, editedPart?.unit_price ?? selectedPart.unit_price) : formatMargin(selectedPart.unit_cost, selectedPart.unit_price)}
                          </span>
                        </div>
                      </div>
                    </LayerTheme>
                  </div>

                  {/* Right Column - Part Info */}
                  <div>
                    <LayerTheme
                      as="section"
                      sectionKey="stock-catalogue-part-information"
                      parentKey="shared-popup-card"
                      padding="var(--space-3)"
                      radius="var(--radius-sm)"
                      gap="var(--space-2)"
                      style={{ height: "100%" }}
                    >
                      <h3 style={{
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  color: "var(--accentText)",
                  margin: 0
                }}>
                        Part Information
                      </h3>
                      <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "var(--layout-card-gap)",
                  fontSize: "var(--text-body)"
                }}>
                        <div>
                          <div className="app-summary-label">Name</div>
                          {isEditMode ? <input className="app-input" type="text" value={editedPart?.name ?? selectedPart.name ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      name: e.target.value
                    }))} /> : <div style={{
                      color: "var(--text-1)"
                    }}>{selectedPart.name || "—"}</div>}
                        </div>
                        <div>
                          <div className="app-summary-label">Description</div>
                          {isEditMode ? <textarea className="app-input" rows={2} value={editedPart?.description ?? selectedPart.description ?? ""} onChange={event => setEditedPart(prev => ({ ...prev, description: event.target.value }))} /> : <div style={{ color: "var(--text-1)" }}>{selectedPart.description || "—"}</div>}
                        </div>
                        <div>
                          <div className="app-summary-label">OEM code</div>
                          <div style={{ color: "var(--text-1)", fontWeight: 600 }}>{selectedPart.oem_reference || "—"}</div>
                        </div>
                        <div>
                          <div className="app-summary-label">Storage location</div>
                          {isEditMode ? <input className="app-input" type="text" value={editedPart?.storage_location ?? selectedPart.storage_location ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      storage_location: e.target.value
                    }))} /> : <div style={{
                      color: "var(--text-1)",
                      fontWeight: 600,
                      fontSize: "var(--text-h4)"
                    }}>{selectedPart.storage_location || "—"}</div>}
                        </div>
                        <div>
                          <div className="app-summary-label">Service default</div>
                          {isEditMode ? <input className="app-input" type="text" value={editedPart?.service_default_zone ?? selectedPart.service_default_zone ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      service_default_zone: e.target.value
                    }))} /> : <div style={{
                      color: "var(--text-1)"
                    }}>{selectedPart.service_default_zone || "—"}</div>}
                        </div>
                        <div>
                          <div className="app-summary-label">Supplier</div>
                          {isEditMode ? <input className="app-input" type="text" value={editedPart?.supplier ?? selectedPart.supplier ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      supplier: e.target.value
                    }))} /> : <div style={{
                      color: "var(--text-1)"
                    }}>{selectedPart.supplier || "Unknown"}</div>}
                        </div>
                        <div>
                          <div className="app-summary-label">Category</div>
                          {isEditMode ? (
                            <input className="app-input" type="text" value={editedPart?.category ?? selectedPart.category ?? ""} onChange={e => setEditedPart(prev => ({
                              ...prev,
                              category: e.target.value
                            }))} />
                          ) : (
                            <div style={{ color: "var(--text-1)" }}>{selectedPart.category || "Uncategorised"}</div>
                          )}
                        </div>
                        <div>
                          <div className="app-summary-label">Notes</div>
                          {isEditMode ? (
                            <textarea className="app-input" rows={3} value={editedPart?.notes ?? selectedPart.notes ?? ""} onChange={event => setEditedPart(prev => ({ ...prev, notes: event.target.value }))} />
                          ) : (
                            <div style={{ color: "var(--text-1)", whiteSpace: "pre-wrap" }}>{selectedPart.notes || "—"}</div>
                          )}
                        </div>
                      </div>
                    </LayerTheme>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "var(--layout-card-gap)", alignItems: "start" }}>
                <LayerTheme as="section" padding="var(--space-3)" radius="var(--radius-sm)" gap="var(--space-2)">
                  <div className="app-layout-header-row">
                    <h3 style={{ margin: 0, color: "var(--accentText)", fontSize: "var(--text-body)" }}>Recent receipts</h3>
                    {numberValue(selectedPart.qty_on_order) > 0 ? <Link className="app-btn app-btn--secondary" href={`/goods-in?part=${encodeURIComponent(selectedPart.id)}`}>
                      Inspect Goods In
                    </Link> : null}
                  </div>
                  {recentReceiptsError ? <div className="app-status-message app-status-message--warning">Receipt history is currently unavailable.</div> : recentReceipts.length > 0 ? <div style={{ overflowX: "auto" }}>
                    <table className="app-data-table app-data-table--rounded" style={{ minWidth: "520px", fontSize: "var(--text-body-sm)" }}>
                      <thead><tr><th>Date</th><th>Movement</th><th>Supplier</th><th>Reference</th><th>Unit cost</th></tr></thead>
                      <tbody>{recentReceipts.map(receipt => <tr key={receipt.id}>
                        <td>{formatDateTime(receipt.delivery_date || receipt.created_at)}</td>
                        <td style={{ color: "var(--success-dark)", fontWeight: 700 }}>Goods In +{numberValue(receipt.qty_received)}</td>
                        <td>{receipt.supplier || "—"}</td>
                        <td>{receipt.order_reference || "—"}</td>
                        <td>{receipt.unit_cost === null || receipt.unit_cost === undefined ? "—" : formatCurrency(receipt.unit_cost)}</td>
                      </tr>)}</tbody>
                    </table>
                  </div> : <div style={{ color: "var(--text-1)", fontSize: "var(--text-body-sm)" }}>No completed delivery log is recorded for this part.</div>}
                </LayerTheme>

                {/* Linked Jobs Table */}
                <LayerTheme as="section" padding="var(--space-3)" radius="var(--radius-sm)" gap="var(--space-2)">
                   <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--layout-card-gap)"
            }}>
                    <h3 style={{
                fontSize: "var(--text-body)",
                fontWeight: 600,
                color: "var(--accentText)",
                margin: 0
              }}>
                      Linked Jobs {selectedPart.linked_jobs && selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 0 && `(${selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length})`}
                    </h3>
                    <Button variant="secondary" type="button" onClick={() => {
                setShowAddToJobModal(true);
                resetAddToJobModal();
              }}>
                      Add part to job
                    </Button>
                  </div>
                  {selectedPart.linked_jobs && selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 0 ? <div style={{
              overflowX: "auto",
              overflowY: selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 4 ? "auto" : "visible",
              maxHeight: selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 4 ? "240px" : "none"
            }}>
                      <table className="app-data-table app-data-table--rounded" style={{
                ...tableStyle,
                fontSize: "var(--text-body-sm)",
                tableLayout: "fixed"
              }}>
                        <thead>
                          <tr>
                            <th>Job Number</th>
                            <th style={{ textAlign: "right" }}>Qty</th>
                            <th>Source</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).map(link => {
                    return <tr key={`${link.type}-${link.job_id}-${link.request_id || ""}-${link.status}`} style={{
                      borderBottom: "var(--separating-line)",
                      transition: "background 0.15s ease"
                    }} onMouseEnter={e => {
                      e.currentTarget.style.background = "var(--surface)";
                    }} onMouseLeave={e => {
                      e.currentTarget.style.background = "transparent";
                    }}>
                                  <td style={{ fontWeight: 600 }}>
                                    <a href={`/job-cards/${link.job_number}`} target="_blank" rel="noopener noreferrer" style={{
                          color: "var(--primary)",
                          textDecoration: "none",
                          fontWeight: 700,
                          transition: "color 0.2s ease"
                        }} onMouseEnter={e => {
                          e.currentTarget.style.textDecoration = "underline";
                        }} onMouseLeave={e => {
                          e.currentTarget.style.textDecoration = "none";
                        }}>
                                      {link.job_number}
                                    </a>
                                  </td>
                                  <td style={{ textAlign: "right", fontWeight: 600 }}>{link.quantity || 1}</td>
                                  <td>
                                    <span className="app-badge app-badge--neutral">{formatStatusLabel(link.source || "Manual")}</span>
                                  </td>
                                  <td>
                                    <span className={`app-badge ${linkedJobStatusBadgeTone(link.status)}`}>{formatStatusLabel(link.status)}</span>
                                  </td>
                                </tr>;
                  })}
                        </tbody>
                      </table>
                    </div> : <LayerSurface padding="var(--space-3)" radius="var(--radius-sm)" style={{ textAlign: "center", color: "var(--text-1)", fontSize: "var(--text-body)" }}>
                      No linked jobs for this part
                    </LayerSurface>}
                </LayerTheme>
                </div>
              </div>
            </div>
          </PopupModal>}

        {renderAddToJobModal()}
        {renderDeliveryModal()}
        {/* Keep the dense nine-column inventory table compact on wider layouts;
            its modest minimum width introduces horizontal scrolling only once
            the available area can no longer keep the content legible. */}
        <style jsx global>{`
          [data-dev-section-key="stock-catalogue-inventory-table"] th,
          [data-dev-section-key="stock-catalogue-inventory-table"] td {
            padding: 10px 8px;
            vertical-align: middle;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }

          [data-dev-section-key="stock-catalogue-part-information"] > div > div {
            display: grid;
            gap: var(--space-xs);
            min-width: 0;
          }
        `}</style>
      <ConfirmationDialog isOpen={!!confirmDialog} message={confirmDialog?.message} cancelLabel="Cancel" confirmLabel="Yes" onCancel={() => setConfirmDialog(null)} onConfirm={confirmDialog?.onConfirm} />
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
