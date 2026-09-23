// file location: src/features/stockControl/StockControlPanel.js
//
// /tracking -> Oil/Stock. The operational stock screen: summary tiles that
// double as filters, a filter / sort toolbar, the card grid, and every stock
// workflow as a popup.
//
// The page owns only the shared search box and the header buttons; it passes
// the search term, a `command` ({ type, at }) for the header buttons, any
// QR deep-link focus ({ itemId, action }) and `filterSlot` — a header element
// the filter button (holding the filter / sort dropdowns) and the Categories &
// Locations button are portalled into so they share the search row (without one
// they stay in the toolbar). Everything else lives here. All
// business rules come from stockModel.js; all requests from stockClient.js.

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { FilterButton, FilterField } from "@/components/ui/filterAPI";
import { SectionGridSkeleton } from "@/components/ui/LoadingSkeleton";
import { Button, EmptyState, StatusMessage } from "@/components/ui";
import { logFailure } from "@/lib/utils/logFailure";
import useIdleWarm from "@/hooks/useIdleWarm";
import {
  SORT_OPTIONS,
  STATUS_FILTER_OPTIONS,
  filterRows,
  findByScan,
  indexSiblingRows,
  resolveRows,
  sortRows,
  summaryCounts,
} from "@/features/stockControl/stockModel";
import {
  createStockItem,
  loadStock,
  prefetchStock,
  recordStockAction,
  setStockItemArchived,
  updateStockItem,
} from "@/features/stockControl/stockClient";
import { StockItemCard } from "@/features/stockControl/StockItemCard";

// Every workflow popup (~1,500 lines, plus the calendar, tab group and QR
// generator they pull in) renders only after a click or a QR deep link, so they
// are split out of the first-load chunk. The check / use popup — the one a QR
// label and most card clicks open — is warmed once the browser is idle.
const loadActionModal = () => import("@/features/stockControl/StockActionModal");
const StockActionModal = dynamic(loadActionModal, { ssr: false });
const StockItemEditor = dynamic(() => import("@/features/stockControl/StockItemEditor"), { ssr: false });
const loadOrderModal = () => import("@/features/stockControl/StockOrderModal");
const StockOrderModal = dynamic(loadOrderModal, { ssr: false });
const StockHistoryDrawer = dynamic(() => import("@/features/stockControl/StockHistoryDrawer"), { ssr: false });
const StocktakeModal = dynamic(() => import("@/features/stockControl/StocktakeModal"), { ssr: false });
const StockQrModal = dynamic(() => import("@/features/stockControl/StockQrModal"), { ssr: false });
const StockSettingsModal = dynamic(() => import("@/features/stockControl/StockSettingsModal"), { ssr: false });
const WARM_MODALS = [loadActionModal];

const ALERT_SUMMARIES = ["action", "critical", "out"];
const NO_SIBLINGS = [];

const GROUPS = [
  { id: "action", label: "Action Required", match: (row) => ["out_of_stock", "critical", "low", "order_required"].includes(row.status.key) || (row.checkDue && row.status.priority >= 7) },
  { id: "incoming", label: "Ordered / Incoming", match: (row) => ["ordered", "awaiting_delivery", "partially_received"].includes(row.status.key) },
  { id: "stocked", label: "In Stock", match: () => true },
];

const EMPTY_DATA = {
  items: [],
  orders: [],
  categories: [],
  locations: [],
  suppliers: [],
  capabilities: {},
  migrationPending: false,
};

export default function StockControlPanel({ searchTerm = "", command = null, focus = null, onFocusHandled, filterSlot = null }) {
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [filters, setFilters] = useState({ categoryId: "all", locationId: "all", status: "all", supplier: "all" });
  const [summary, setSummary] = useState(null);
  const [sort, setSort] = useState("action");
  const [modal, setModal] = useState(null);
  const lastCommand = useRef(null);
  const capabilities = data.capabilities;

  useIdleWarm(WARM_MODALS);

  // A QR deep link opens the check / use or order popup as soon as the list is
  // in: fetch those chunks now, alongside the list, rather than after it.
  const hasFocus = Boolean(focus?.itemId);
  useEffect(() => {
    if (!hasFocus) return;
    loadActionModal().catch(() => {});
    loadOrderModal().catch(() => {});
  }, [hasFocus]);

  // The first load reuses the request /tracking/Oil-Stock started on mount (in
  // parallel with this chunk); every later refresh fetches afresh.
  const refresh = useCallback(async ({ quiet = false, initial = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const next = await (initial ? prefetchStock() : loadStock());
      setData({ ...EMPTY_DATA, ...next });
      setLoadError(null);
    } catch (error) {
      logFailure("Stock control load failed", error);
      setLoadError(error.message || "Unable to load stock.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh({ initial: true });
  }, [refresh]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const rows = useMemo(
    () => resolveRows(data.items, data.orders, { now: new Date(), categories: data.categories, locations: data.locations }),
    [data]
  );
  const activeRows = useMemo(() => rows.filter((row) => !row.archived), [rows]);
  const counts = useMemo(() => summaryCounts(rows), [rows]);
  // The search box stays responsive while the grid catches up: filtering and
  // re-rendering every card runs at the deferred (interruptible) priority.
  const deferredSearch = useDeferredValue(searchTerm);
  const visibleRows = useMemo(
    () => sortRows(filterRows(rows, { search: deferredSearch, ...filters, summary }), sort),
    [filters, rows, deferredSearch, sort, summary]
  );
  const siblingsByRow = useMemo(() => indexSiblingRows(rows), [rows]);
  const scanned = useMemo(() => (searchTerm.trim().length >= 4 ? findByScan(rows, searchTerm) : null), [rows, searchTerm]);
  const rowById = useMemo(() => new Map(rows.map((row) => [row.item.id, row])), [rows]);

  const groups = useMemo(() => {
    if (sort !== "action") return [{ id: "all", label: null, rows: visibleRows }];
    const remaining = [...visibleRows];
    return GROUPS.map((group) => {
      const matched = remaining.filter(group.match);
      matched.forEach((row) => remaining.splice(remaining.indexOf(row), 1));
      return { ...group, rows: matched };
    }).filter((group) => group.rows.length);
  }, [sort, visibleRows]);

  // ---- mutations -----------------------------------------------------------
  const mergeItem = useCallback((item) => {
    if (!item) return;
    setData((previous) => ({
      ...previous,
      items: previous.items.some((existing) => existing.id === item.id)
        ? previous.items.map((existing) => (existing.id === item.id ? { ...existing, ...item } : existing))
        : [...previous.items, item],
    }));
  }, []);

  const afterChange = useCallback(
    (message, item) => {
      if (item) mergeItem(item);
      setModal(null);
      if (message) setNotice(message);
      refresh({ quiet: true });
    },
    [mergeItem, refresh]
  );

  const openRow = useCallback(
    (row, action = "check") => {
      if (capabilities.manage) setModal({ type: "edit", row });
      else if (capabilities.check || capabilities.use) setModal({ type: "action", row, action });
      else setModal({ type: "history", row });
    },
    [capabilities]
  );

  const handleAction = useCallback(
    async (actionId, row) => {
      if (actionId === "check") setModal({ type: "action", row, action: "check" });
      else if (actionId === "order") setModal({ type: "order", row, mode: "order" });
      else if (actionId === "receive") setModal({ type: "order", row, mode: "receive" });
      else if (actionId === "order-info") setModal({ type: "order", row, mode: capabilities.order ? "order" : "view" });
      else if (actionId === "request-order") {
        try {
          await recordStockAction({ type: "request_order", itemId: row.item.id });
          afterChange(`Order requested for ${row.item.title}. Parts have been notified.`);
        } catch (error) {
          setNotice({ tone: "danger", text: error.message });
        }
      } else if (actionId === "restore") {
        try {
          const item = await setStockItemArchived(row.item.id, false);
          afterChange(`${row.item.title} restored.`, item);
        } catch (error) {
          setNotice({ tone: "danger", text: error.message });
        }
      }
    },
    [afterChange, capabilities.order]
  );

  const saveItem = useCallback(
    async (payload) => {
      const editing = modal?.type === "edit" ? modal.row.item : null;
      const item = editing ? await updateStockItem(editing.id, payload) : await createStockItem(payload);
      afterChange(`${item.title} ${editing ? "saved" : "added"}.`, item);
    },
    [afterChange, modal]
  );

  const archiveItem = useCallback(
    async (item, archived) => {
      try {
        const updated = await setStockItemArchived(item.id, archived);
        afterChange(`${item.title} ${archived ? "archived — history kept" : "restored"}.`, updated);
      } catch (error) {
        setNotice({ tone: "danger", text: error.message });
      }
    },
    [afterChange]
  );

  // ---- header buttons and QR deep links ------------------------------------
  useEffect(() => {
    if (!command || command.at === lastCommand.current) return;
    lastCommand.current = command.at;
    if (data.migrationPending) {
      setNotice({ tone: "warning", text: "Stock control needs its database update before items can be added or counted." });
      return;
    }
    if (command.type === "create" && capabilities.manage) setModal({ type: "create" });
    if (command.type === "stocktake" && capabilities.stocktake) setModal({ type: "stocktake" });
    if (command.type === "settings" && capabilities.configure) setModal({ type: "settings" });
  }, [capabilities, command, data.migrationPending]);

  useEffect(() => {
    if (!focus?.itemId || loading) return;
    const row = rowById.get(focus.itemId);
    if (!row) {
      setNotice({ tone: "warning", text: "That stock label points to an item that no longer exists." });
    } else if (focus.action === "receive" && row.openOrder && capabilities.receive) {
      setModal({ type: "order", row, mode: "receive" });
    } else {
      const action = focus.action === "use" ? "use" : focus.action === "receive" ? "in" : "check";
      setModal({ type: "action", row, action });
    }
    onFocusHandled?.();
  }, [capabilities.receive, focus, loading, onFocusHandled, rowById]);

  // ---- render --------------------------------------------------------------
  const setFilter = (key, value) => setFilters((previous) => ({ ...previous, [key]: value || "all" }));
  const categoryOptions = [{ value: "all", label: "All categories" }, ...data.categories.map((c) => ({ value: c.id, label: c.isActive ? c.name : `${c.name} (retired)` }))];
  const locationOptions = [{ value: "all", label: "All locations" }, ...data.locations.map((l) => ({ value: l.id, label: l.isActive ? l.name : `${l.name} (retired)`, description: l.department || undefined }))];
  const supplierOptions = [{ value: "all", label: "All suppliers" }, ...data.suppliers.map((name) => ({ value: name, label: name }))];
  const filtersActive = summary || Object.values(filters).some((value) => value !== "all") || searchTerm.trim();
  const noticeTone = typeof notice === "string" ? "success" : notice?.tone;
  const noticeText = typeof notice === "string" ? notice : notice?.text;

  const cardHandlers = {
    capabilities,
    onOpen: (row) => openRow(row),
    onAction: handleAction,
    onHistory: (row) => setModal({ type: "history", row }),
    onStockAction: (row) => setModal({ type: "action", row, action: capabilities.check ? "check" : "use" }),
  };

  // The filter and sort dropdowns live in the filter button's floating card.
  const activeFilterCount = Object.values(filters).filter((value) => value !== "all").length + (sort !== "action" ? 1 : 0);
  const filterControls = (
    <>
    <FilterButton
      activeCount={activeFilterCount}
      onClear={() => {
        setFilters({ categoryId: "all", locationId: "all", status: "all", supplier: "all" });
        setSort("action");
      }}
    >
      <FilterField label="Category" htmlFor="stock-filter-category">
        <DropdownField id="stock-filter-category" ariaLabel="Filter by category" options={categoryOptions} value={filters.categoryId} onValueChange={(value) => setFilter("categoryId", value)} />
      </FilterField>
      <FilterField label="Location" htmlFor="stock-filter-location">
        <DropdownField id="stock-filter-location" ariaLabel="Filter by location" options={locationOptions} value={filters.locationId} onValueChange={(value) => setFilter("locationId", value)} />
      </FilterField>
      <FilterField label="Status" htmlFor="stock-filter-status">
        <DropdownField id="stock-filter-status" ariaLabel="Filter by status" options={STATUS_FILTER_OPTIONS} value={filters.status} onValueChange={(value) => setFilter("status", value)} />
      </FilterField>
      {data.suppliers.length > 0 && (
        <FilterField label="Supplier" htmlFor="stock-filter-supplier">
          <DropdownField id="stock-filter-supplier" ariaLabel="Filter by supplier" options={supplierOptions} value={filters.supplier} onValueChange={(value) => setFilter("supplier", value)} />
        </FilterField>
      )}
      <FilterField label="Sort" htmlFor="stock-filter-sort">
        <DropdownField id="stock-filter-sort" ariaLabel="Sort by" options={SORT_OPTIONS.filter((option) => option.value !== "value" || capabilities.viewCosts)} value={sort} onValueChange={(value) => setSort(value || "action")} />
      </FilterField>
    </FilterButton>
    {capabilities.configure && (
      <Button type="button" variant="secondary" size="sm" symbol={false} onClick={() => setModal({ type: "settings" })}>
        Categories & Locations
      </Button>
    )}
    </>
  );

  // Keep the popup's row fresh after a background refresh.
  const modalRow = modal?.row ? rowById.get(modal.row.item.id) || modal.row : null;

  return (
    <div className="stock-panel">
      {data.migrationPending && (
        <StatusMessage tone="warning">
          Stock control is waiting for its database update (supabase/migrations/20260922140000_stock_control.sql). Existing items are shown read-only until it is applied.
        </StatusMessage>
      )}
      {loadError && (
        <StatusMessage tone="danger">
          {loadError}{" "}
          <Button type="button" variant="secondary" size="xs" symbol={false} onClick={() => refresh()}>
            Retry
          </Button>
        </StatusMessage>
      )}
      {noticeText && <StatusMessage tone={noticeTone}>{noticeText}</StatusMessage>}

      <div className="app-summary-section">
        <div className="app-summary-grid">
          {counts.map((tile) => {
            const active = summary === tile.key || (tile.key === "total" && !summary);
            return (
              <div
                key={tile.key}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                className={`app-summary-item app-summary-item--theme stock-summary-tile${active ? " is-active" : ""}${ALERT_SUMMARIES.includes(tile.key) && tile.value > 0 ? " is-alert" : ""}`}
                onClick={() => setSummary(tile.key === "total" || summary === tile.key ? null : tile.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSummary(tile.key === "total" || summary === tile.key ? null : tile.key);
                  }
                }}
              >
                <span className="app-summary-label">{tile.label}</span>
                <strong className="app-summary-value">{tile.value}</strong>
              </div>
            );
          })}
        </div>
      </div>

      {filterSlot && createPortal(filterControls, filterSlot)}
      {(!filterSlot || filtersActive) && (
      <div className="stock-toolbar">
        {filterSlot ? null : filterControls}
        <div className="stock-toolbar__end">
          {filtersActive && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              symbol={false}
              onClick={() => {
                setFilters({ categoryId: "all", locationId: "all", status: "all", supplier: "all" });
                setSummary(null);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>
      )}

      {scanned && (
        <StatusMessage tone="info">
          Scanned: <strong>{scanned.item.title}</strong> ({scanned.location?.name || "no location"}){" "}
          {capabilities.check && !scanned.archived && (
            <Button type="button" variant="primary" size="xs" symbol={false} onClick={() => setModal({ type: "action", row: scanned, action: "check" })}>
              Check Level
            </Button>
          )}{" "}
          <Button type="button" variant="secondary" size="xs" symbol={false} onClick={() => setModal({ type: "history", row: scanned })}>
            History
          </Button>
        </StatusMessage>
      )}

      {loading && data.items.length === 0 && <SectionGridSkeleton cards={6} />}

      {!loading && activeRows.length === 0 && filters.status !== "archived" && !loadError && (
        <EmptyState
          title="No stock items yet"
          description="Add the oils, fluids and consumables you want to keep track of. Each product at each location is one item."
          action={
            capabilities.manage && !data.migrationPending ? (
              <Button type="button" variant="primary" size="sm" symbol={false} onClick={() => setModal({ type: "create" })}>
                Add stock item
              </Button>
            ) : null
          }
        />
      )}

      {!loading && activeRows.length > 0 && visibleRows.length === 0 && (
        <EmptyState title="Nothing matches" description="No stock items match your search or filters." />
      )}

      {groups.map((group) => (
          // Layout-only region: a section inherits global card padding and narrows the grid.
          <div key={group.id} className="stock-group" role="region" aria-label={group.label || "Stock items"}>
            {group.label && (
              <div className="stock-group__head">
                <h2 className="stock-group__title">{group.label}</h2>
                <span className="stock-group__count">{group.rows.length}</span>
              </div>
            )}
            <div className="stock-grid">
              {group.rows.map((row) => (
                <StockItemCard key={row.item.id} row={row} siblings={siblingsByRow.get(row) || NO_SIBLINGS} {...cardHandlers} />
              ))}
            </div>
          </div>
        ))}

      {(modal?.type === "create" || modal?.type === "edit") && (
        <StockItemEditor
          item={modal.type === "edit" ? modalRow.item : null}
          categories={data.categories}
          locations={data.locations}
          capabilities={capabilities}
          onClose={() => setModal(null)}
          onSave={saveItem}
          onArchive={archiveItem}
          onShowQr={() => setModal({ type: "qr", row: modalRow })}
          onOpenExisting={(id) => {
            const existing = rowById.get(id);
            if (existing) setModal({ type: "edit", row: existing });
          }}
        />
      )}
      {modal?.type === "action" && (
        <StockActionModal
          row={modalRow}
          initialAction={modal.action}
          capabilities={capabilities}
          onClose={() => setModal(null)}
          onSaved={(result) => afterChange(`${modalRow.item.title} updated.`, result.item)}
        />
      )}
      {modal?.type === "order" && (
        <StockOrderModal
          row={modalRow}
          mode={modal.mode}
          capabilities={capabilities}
          onClose={() => setModal(null)}
          onSaved={(result) => afterChange(modal.mode === "receive" ? `Delivery booked in for ${modalRow.item.title}.` : `Order saved for ${modalRow.item.title}.`, result?.item)}
        />
      )}
      {modal?.type === "history" && <StockHistoryDrawer row={modalRow} capabilities={capabilities} onClose={() => setModal(null)} />}
      {modal?.type === "qr" && <StockQrModal row={modalRow} onClose={() => setModal(null)} />}
      {modal?.type === "stocktake" && (
        <StocktakeModal
          rows={rows}
          categories={data.categories}
          locations={data.locations}
          capabilities={capabilities}
          onItemUpdated={mergeItem}
          onClose={() => {
            setModal(null);
            refresh({ quiet: true });
          }}
        />
      )}
      {modal?.type === "settings" && (
        <StockSettingsModal
          categories={data.categories}
          locations={data.locations}
          onClose={() => setModal(null)}
          onSaved={(kind, entry) =>
            setData((previous) => {
              const key = kind === "category" ? "categories" : "locations";
              const list = previous[key];
              return {
                ...previous,
                [key]: list.some((existing) => existing.id === entry.id) ? list.map((existing) => (existing.id === entry.id ? entry : existing)) : [...list, entry],
              };
            })
          }
        />
      )}
    </div>
  );
}
