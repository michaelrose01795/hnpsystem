// file location: src/components/page-ui/stock-catalogue-ui.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import { DropdownField } from "@/components/ui/dropdownAPI";

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
const availableStock = (part) =>
  numberValue(part?.qty_in_stock) - numberValue(part?.qty_reserved);

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
    popupCardStyles,
    popupOverlayStyles,
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
        >
          <div className="app-layout-header-row">
            <div>
              <h1 style={{ margin: 0, color: "var(--accentText)", fontSize: "var(--text-h2)", letterSpacing: "-0.02em" }}>
                Parts inventory
              </h1>
              <p style={{ margin: "var(--space-1) 0 0", color: "var(--text-1)", fontSize: "var(--text-body-sm)" }}>
                Stock, incoming supply and open-job demand in one workspace.
              </p>
            </div>
            <span className="app-badge app-badge--accent-soft">
              Available = on hand − reserved
            </span>
          </div>

          {stockSummaryError ? <div className="app-status-message app-status-message--warning">
            Summary unavailable. Catalogue search and stock actions are still available.
          </div> : null}

          <div className="app-summary-grid" role="list" aria-label="Stock catalogue summary">
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
        overflow: "auto"
      }}>
            {inventoryLoading ? <div data-dev-section="1" data-dev-section-key="stock-catalogue-inventory-loading" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-inventory-scroll" data-dev-text-preview="Inventory loading state" style={{
          color: "var(--grey-accent-light)"
        }}>Loading inventory...</div> : inventory.length === 0 ? <div data-dev-section="1" data-dev-section-key="stock-catalogue-inventory-empty" data-dev-section-type="content-card" data-dev-section-parent="stock-catalogue-inventory-scroll" data-dev-text-preview="Inventory empty state" style={{
          color: "var(--grey-accent-light)"
        }}>No parts found. Refine your search.</div> : <>
                <table className="app-data-table app-data-table--rounded" data-dev-section="1" data-dev-section-key="stock-catalogue-inventory-table" data-dev-section-type="data-table" data-dev-section-parent="stock-catalogue-inventory-scroll" data-dev-text-preview="Inventory results table" style={{
            ...tableStyle,
            fontSize: "var(--text-body)",
            minWidth: "1120px"
          }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr style={{
                background: "var(--surface)",
                color: "var(--danger)"
              }}>
                      <th style={{
                  textAlign: "left",
                  padding: "10px"
                }}>Part Number</th>
                      <th>Part details</th>
                      <th>Category / supplier</th>
                      <th>Bin</th>
                      <th>Stock</th>
                      <th>Unit cost</th>
                      <th>Reorder</th>
                      <th>Status</th>
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
                          <td style={{
                  padding: "10px",
                  fontWeight: 600,
                  color: "var(--primary)"
                }}>
                            {part.part_number}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{part.name}</div>
                            <div style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>
                              OEM {part.oem_reference || "—"}
                            </div>
                          </td>
                          <td>
                            <div>{part.category || "Uncategorised"}</div>
                            <div style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>{part.supplier || "No supplier"}</div>
                          </td>
                          <td style={{ fontWeight: 600 }}>{part.storage_location || "—"}</td>
                          <td>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: "var(--space-2)", fontVariantNumeric: "tabular-nums" }}>
                              <span><small style={{ display: "block", color: "var(--text-1)" }}>Hand</small><strong>{numberValue(part.qty_in_stock)}</strong></span>
                              <span><small style={{ display: "block", color: "var(--text-1)" }}>Reserved</small><strong>{numberValue(part.qty_reserved)}</strong></span>
                              <span><small style={{ display: "block", color: "var(--text-1)" }}>Available</small><strong style={{ color: availableStock(part) <= numberValue(part.reorder_level) ? "var(--danger)" : "var(--success-dark)" }}>{availableStock(part)}</strong></span>
                            </div>
                            {numberValue(part.open_job_count) > 0 ? <div style={{ marginTop: "var(--space-1)", color: "var(--text-1)", fontSize: "var(--text-caption)" }}>
                              Required by open jobs: {numberValue(part.open_job_count)}
                            </div> : null}
                          </td>
                          <td style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(part.unit_cost)}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>
                            <strong>{numberValue(part.reorder_level)}</strong>
                            {availableStock(part) < numberValue(part.reorder_level) ? <div style={{ color: "var(--danger)", fontSize: "var(--text-caption)" }}>
                              {numberValue(part.reorder_level) - availableStock(part)} below
                            </div> : null}
                            {numberValue(part.qty_on_order) > 0 ? <div style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>
                              {numberValue(part.qty_on_order)} expected soon
                            </div> : null}
                          </td>
                          <td>
                            <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-pill)",
                    background: part.stock_status === "low_stock" ? "rgba(var(--warning-rgb), 0.2)" : part.stock_status === "back_order" ? "rgba(var(--danger-rgb), 0.2)" : part.stock_status === "high_stock" ? "rgba(var(--success-rgb), 0.2)" : "rgba(var(--info-rgb), 0.18)",
                    color: part.stock_status === "low_stock" ? "var(--danger-dark)" : part.stock_status === "back_order" ? "var(--danger)" : part.stock_status === "high_stock" ? "var(--success-dark)" : "var(--info-dark)",
                    fontSize: "var(--text-caption)",
                    fontWeight: 600
                  }}>
                              {(part.stock_status || "in_stock").replace(/_/g, " ")}
                            </span>
                          </td>
                          <td>
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
        {isPartModalOpen && selectedPart && <div className="popup-backdrop" role="dialog" aria-modal="true" style={popupOverlayStyles} onClick={() => setIsPartModalOpen(false)}>
            <div style={{
        ...popupCardStyles,
        maxWidth: "1000px",
        maxHeight: "90vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "28px"
      }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "16px",
          marginBottom: "20px"
        }}>
                <div style={{
            flex: 1
          }}>
                  <h2 style={{
              margin: 0,
              color: "var(--primary)",
              fontSize: "var(--text-h2)",
              fontWeight: 700
            }}>
                    {selectedPart.part_number}
                  </h2>
                  <p style={{
              margin: "6px 0 0 0",
              color: "var(--text-1)",
              fontSize: "var(--text-body)"
            }}>
                    {selectedPart.name}
                  </p>
                </div>
                <div style={{
            display: "flex",
            gap: "8px"
          }}>
                  {!isEditMode ? <button onClick={handleEditPart} style={{
              background: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-xs)",
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "var(--text-body)"
            }}>
                      Edit
                    </button> : <>
                      <button onClick={handleSavePart} disabled={isSavingPart} style={{
                background: isSavingPart ? "var(--surface)" : "var(--success)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-xs)",
                padding: "8px 16px",
                cursor: isSavingPart ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "var(--text-body)"
              }}>
                        {isSavingPart ? "Saving..." : "Save"}
                      </button>
                      <button onClick={handleCancelEdit} disabled={isSavingPart} style={{
                background: "var(--surface)",
                color: "var(--text-1)",
                border: "none",
                borderRadius: "var(--radius-xs)",
                padding: "8px 16px",
                cursor: isSavingPart ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "var(--text-body)"
              }}>
                        Cancel
                      </button>
                    </>}
                  <button onClick={() => {
              setIsPartModalOpen(false);
              setIsEditMode(false);
              setEditedPart(null);
            }} style={{
              background: "var(--surface)",
              border: "none",
              borderRadius: "var(--radius-xs)",
              fontSize: "var(--text-h2)",
              cursor: "pointer",
              color: "var(--text-1)",
              padding: "8px",
              width: "var(--control-height-xs)",
              height: "var(--control-height-xs)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease"
            }} onMouseEnter={e => {
              e.currentTarget.style.background = "var(--danger-light)";
              e.currentTarget.style.color = "var(--danger)";
            }} onMouseLeave={e => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.color = "var(--text-1)";
            }}>
                  ×
                </button>
              </div>
              </div>

              {/* Scrollable Content */}
              <div style={{
          flex: 1,
          overflow: "auto",
          paddingRight: "12px"
        }}>
                {/* Two Column Layout */}
                <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
            marginBottom: "20px"
          }}>
                  {/* Left Column - Stock & Pricing */}
                  <div>
                    {/* Stock Overview Card */}
                    <div style={{
                background: "var(--surface)",
                borderRadius: "var(--radius-sm)",
                padding: "16px",
                marginBottom: "16px",
                border: "none"
              }}>
                      <h3 style={{
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  color: "var(--text-1)",
                  marginBottom: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                        Stock Overview
                      </h3>
                      <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "10px"
                }}>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-1)",
                      marginBottom: "4px"
                    }}>On Hand</div>
                          {isEditMode ? <input className="app-input" type="number" value={editedPart?.qty_in_stock ?? selectedPart.qty_in_stock} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      qty_in_stock: parseInt(e.target.value) || 0
                    }))} /> : <div style={{
                      fontSize: "var(--text-h2)",
                      fontWeight: 700,
                      color: "var(--primary)"
                    }}>{selectedPart.qty_in_stock}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-1)",
                      marginBottom: "4px"
                    }}>Reserved</div>
                          {isEditMode ? <input type="number" value={editedPart?.qty_reserved ?? selectedPart.qty_reserved ?? 0} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      qty_reserved: parseInt(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      fontSize: "var(--text-h2)",
                      fontWeight: 700
                    }}>{selectedPart.qty_reserved || 0}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-1)",
                      marginBottom: "4px"
                    }}>On Order</div>
                          {isEditMode ? <input type="number" value={editedPart?.qty_on_order ?? selectedPart.qty_on_order ?? 0} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      qty_on_order: parseInt(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      fontSize: "var(--text-h2)",
                      fontWeight: 700
                    }}>{selectedPart.qty_on_order || 0}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-1)",
                      marginBottom: "4px"
                    }}>Min Level</div>
                          {isEditMode ? <input type="number" value={editedPart?.reorder_level ?? selectedPart.reorder_level ?? 0} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      reorder_level: parseInt(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      fontSize: "var(--text-h2)",
                      fontWeight: 700
                    }}>{selectedPart.reorder_level || 0}</div>}
                        </div>
                        <div>
                          <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", marginBottom: "4px" }}>Available</div>
                          <div style={{
                            fontSize: "var(--text-h2)",
                            fontWeight: 700,
                            color: availableStock(isEditMode ? { ...selectedPart, ...editedPart } : selectedPart) <= numberValue(isEditMode ? editedPart?.reorder_level ?? selectedPart.reorder_level : selectedPart.reorder_level) ? "var(--danger)" : "var(--success-dark)"
                          }}>
                            {availableStock(isEditMode ? { ...selectedPart, ...editedPart } : selectedPart)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", marginBottom: "4px" }}>Back order</div>
                          <div style={{ fontSize: "var(--text-h2)", fontWeight: 700 }}>
                            {selectedPart.stock_status === "back_order" ? numberValue(selectedPart.qty_on_order) : 0}
                          </div>
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
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-1)"
                    }}>Linked Jobs</div>
                          <div style={{
                      fontSize: "var(--text-h3)",
                      fontWeight: 600
                    }}>{selectedPart.open_job_count || 0}</div>
                        </div>
                        <span style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-pill)",
                    fontSize: "var(--text-caption)",
                    fontWeight: 600,
                    background: selectedPart.stock_status === "low_stock" ? "rgba(var(--warning-rgb), 0.2)" : selectedPart.stock_status === "back_order" ? "rgba(var(--danger-rgb), 0.2)" : selectedPart.stock_status === "high_stock" ? "rgba(var(--success-rgb), 0.2)" : "rgba(var(--info-rgb), 0.18)",
                    color: selectedPart.stock_status === "low_stock" ? "var(--danger-dark)" : selectedPart.stock_status === "back_order" ? "var(--danger)" : selectedPart.stock_status === "high_stock" ? "var(--success-dark)" : "var(--info-dark)"
                  }}>
                          {(selectedPart.stock_status || "in_stock").replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    {/* Pricing Card */}
                    <div style={{
                background: "var(--surface)",
                borderRadius: "var(--radius-sm)",
                padding: "16px",
                border: "none"
              }}>
                      <h3 style={{
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  color: "var(--text-1)",
                  marginBottom: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
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
                          {isEditMode ? <input type="number" step="0.01" value={editedPart?.unit_cost ?? selectedPart.unit_cost} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      unit_cost: parseFloat(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <span style={{
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
                          {isEditMode ? <input type="number" step="0.01" value={editedPart?.unit_price ?? selectedPart.unit_price} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      unit_price: parseFloat(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <span style={{
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
                    </div>
                  </div>

                  {/* Right Column - Part Info */}
                  <div>
                    <div style={{
                background: "var(--surface)",
                borderRadius: "var(--radius-sm)",
                padding: "16px",
                border: "none",
                height: "100%"
              }}>
                      <h3 style={{
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  color: "var(--text-1)",
                  marginBottom: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                        Part Information
                      </h3>
                      <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  fontSize: "var(--text-body)"
                }}>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-1)",
                      marginBottom: "4px",
                      fontWeight: 600
                    }}>NAME</div>
                          {isEditMode ? <input type="text" value={editedPart?.name ?? selectedPart.name ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      name: e.target.value
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      color: "var(--text-1)"
                    }}>{selectedPart.name || "—"}</div>}
                        </div>
                        <div>
                          <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", marginBottom: "4px", fontWeight: 600 }}>DESCRIPTION</div>
                          {isEditMode ? <textarea className="app-input" rows={2} value={editedPart?.description ?? selectedPart.description ?? ""} onChange={event => setEditedPart(prev => ({ ...prev, description: event.target.value }))} /> : <div style={{ color: "var(--text-1)" }}>{selectedPart.description || "—"}</div>}
                        </div>
                        <div>
                          <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", marginBottom: "4px", fontWeight: 600 }}>OEM CODE</div>
                          <div style={{ color: "var(--text-1)", fontWeight: 600 }}>{selectedPart.oem_reference || "—"}</div>
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-1)",
                      marginBottom: "4px",
                      fontWeight: 600
                    }}>STORAGE LOCATION</div>
                          {isEditMode ? <input type="text" value={editedPart?.storage_location ?? selectedPart.storage_location ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      storage_location: e.target.value
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      color: "var(--text-1)",
                      fontWeight: 600,
                      fontSize: "var(--text-h4)"
                    }}>{selectedPart.storage_location || "—"}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-1)",
                      marginBottom: "4px",
                      fontWeight: 600
                    }}>SERVICE DEFAULT</div>
                          {isEditMode ? <input type="text" value={editedPart?.service_default_zone ?? selectedPart.service_default_zone ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      service_default_zone: e.target.value
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      color: "var(--text-1)"
                    }}>{selectedPart.service_default_zone || "—"}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-1)",
                      marginBottom: "4px",
                      fontWeight: 600
                    }}>SUPPLIER</div>
                          {isEditMode ? <input type="text" value={editedPart?.supplier ?? selectedPart.supplier ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      supplier: e.target.value
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      color: "var(--text-1)"
                    }}>{selectedPart.supplier || "Unknown"}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-1)",
                      marginBottom: "4px",
                      fontWeight: 600
                    }}>CATEGORY</div>
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
                          <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", marginBottom: "4px", fontWeight: 600 }}>NOTES</div>
                          {isEditMode ? (
                            <textarea className="app-input" rows={3} value={editedPart?.notes ?? selectedPart.notes ?? ""} onChange={event => setEditedPart(prev => ({ ...prev, notes: event.target.value }))} />
                          ) : (
                            <div style={{ color: "var(--text-1)", whiteSpace: "pre-wrap" }}>{selectedPart.notes || "—"}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <section style={{ marginBottom: "var(--layout-card-gap)" }}>
                  <div className="app-layout-header-row" style={{ marginBottom: "var(--space-2)" }}>
                    <h3 style={{ margin: 0, color: "var(--accentText)", fontSize: "var(--text-body)" }}>Recent receipts</h3>
                    {numberValue(selectedPart.qty_on_order) > 0 ? <Link className="app-btn app-btn--secondary" href={`/goods-in?part=${encodeURIComponent(selectedPart.id)}`}>
                      Inspect Goods In
                    </Link> : null}
                  </div>
                  {recentReceiptsError ? <div className="app-status-message app-status-message--warning">Receipt history is currently unavailable.</div> : recentReceipts.length > 0 ? <div style={{ overflowX: "auto" }}>
                    <table className="app-data-table app-data-table--rounded" style={{ minWidth: "680px" }}>
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
                </section>

                {/* Linked Jobs Table */}
                <div style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-sm)",
            padding: "16px",
            border: "none"
          }}>
                  <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "12px"
            }}>
                    <h3 style={{
                fontSize: "var(--text-body)",
                fontWeight: 600,
                color: "var(--text-1)",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                      Linked Jobs {selectedPart.linked_jobs && selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 0 && `(${selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length})`}
                    </h3>
                    <button className="app-btn app-btn--secondary" type="button" onClick={() => {
                setShowAddToJobModal(true);
                resetAddToJobModal();
              }}>
                      Add part to job
                    </button>
                  </div>
                  {selectedPart.linked_jobs && selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 0 ? <div style={{
              overflowX: "auto",
              overflowY: selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 4 ? "auto" : "visible",
              maxHeight: selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 4 ? "240px" : "none"
            }}>
                      <table style={{
                ...tableStyle,
                fontSize: "var(--text-body-sm)"
              }}>
                        <thead>
                          <tr style={{
                    background: "var(--surface)",
                    color: "var(--text-1)",
                    fontSize: "var(--text-caption)",
                    textTransform: "uppercase"
                  }}>
                            <th style={{
                      textAlign: "left",
                      padding: "10px",
                      fontWeight: 600
                    }}>Job Number</th>
                            <th style={{
                      textAlign: "right",
                      padding: "10px",
                      fontWeight: 600
                    }}>Qty</th>
                            <th style={{
                      textAlign: "left",
                      padding: "10px",
                      fontWeight: 600
                    }}>Source</th>
                            <th style={{
                      textAlign: "left",
                      padding: "10px",
                      fontWeight: 600
                    }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).map(link => {
                    const sourceMeta = resolveSourceMeta(link.source);
                    const statusMeta = resolveStatusStyles(link.status);
                    return <tr key={`${link.type}-${link.job_id}-${link.request_id || ""}-${link.status}`} style={{
                      borderBottom: "var(--separating-line)",
                      transition: "background 0.15s ease"
                    }} onMouseEnter={e => {
                      e.currentTarget.style.background = "var(--surface)";
                    }} onMouseLeave={e => {
                      e.currentTarget.style.background = "transparent";
                    }}>
                                  <td style={{
                        padding: "10px",
                        fontWeight: 600
                      }}>
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
                                  <td style={{
                        padding: "10px",
                        textAlign: "right",
                        fontWeight: 600
                      }}>{link.quantity || 1}</td>
                                  <td style={{
                        padding: "10px"
                      }}>
                                    <RequirementBadge label={sourceMeta.label} background={sourceMeta.background} color={sourceMeta.color} />
                                  </td>
                                  <td style={{
                        padding: "10px"
                      }}>
                                    <RequirementBadge label={formatStatusLabel(link.status)} background={statusMeta.background} color={statusMeta.color} />
                                  </td>
                                </tr>;
                  })}
                        </tbody>
                      </table>
                    </div> : <div style={{
              padding: "24px",
              textAlign: "center",
              color: "var(--text-1)",
              background: "var(--surface)",
              borderRadius: "var(--radius-xs)",
              fontSize: "var(--text-body)"
            }}>
                      No linked jobs for this part
                    </div>}
                </div>
              </div>
            </div>
          </div>}

        {renderAddToJobModal()}
        {renderDeliveryModal()}
      <ConfirmationDialog isOpen={!!confirmDialog} message={confirmDialog?.message} cancelLabel="Cancel" confirmLabel="Yes" onCancel={() => setConfirmDialog(null)} onConfirm={confirmDialog?.onConfirm} />
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
