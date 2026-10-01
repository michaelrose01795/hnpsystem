// file location: src/features/stockAccess/StockAccessManager.js
//
// /access/<store>/manage — a store's stock table and everything around it, for Parts,
// managers and admin (capability: manage). Tabs:
//
//   Stock        every item: current / available / checked out, holder,
//                location, low-stock state, open restock, last movement.
//                Search, filter, sort; a row opens the item's full record
//                and timeline.
//   Checked out  who has what, overdue and missing first
//   Restock      process requests: order, receive (full or partial), cancel
//   Warranty     parts in warranty storage and their outcome
//   Activity     the ledger across every item

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { SectionGridSkeleton } from "@/components/ui/LoadingSkeleton";
import { Button, DataTableShell, EmptyState, InputField, LayerTheme, StatusMessage } from "@/components/ui";
import {
  CATEGORY_BY_VALUE,
  MANAGE_FILTERS,
  MANAGE_SORTS,
  OPEN_RESTOCK_STATUSES,
  RESTOCK_STATUS_BY_VALUE,
  STOCK_ACCESS_CATEGORIES,
  availableQuantity,
  compareRows,
  deriveItemStatus,
  formatMoney,
  formatQuantity,
  formatRelative,
  isLowStock,
  isOpenCheckout,
  matchesManageFilter,
  matchesSearch,
  toNumber,
} from "@/features/stockAccess/stockAccessModel";
import { loadManage } from "@/features/stockAccess/stockAccessClient";
import { StatusBadge } from "@/features/stockAccess/AccessBits";
import ItemEditorModal from "@/features/stockAccess/ItemEditorModal";
import ItemDetailModal from "@/features/stockAccess/ItemDetailModal";
import StockMovementModal from "@/features/stockAccess/StockMovementModal";
import LocationsModal from "@/features/stockAccess/LocationsModal";
import { ActivityTab, CheckoutsTab, RestockTab, WarrantyTab } from "@/features/stockAccess/ManageTabs";
import styles from "@/features/stockAccess/stockAccess.module.css";
import { storeHref } from "@/config/stockAccessStores";

const NONE = [];

function Stat({ label, value }) {
  return (
    <div className="app-summary-item">
      <span className="app-summary-label">{label}</span>
      <strong className="app-summary-value">{value}</strong>
    </div>
  );
}

export default function StockAccessManager({ store }) {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [tab, setTab] = useState("stock");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("low_first");
  const [detailId, setDetailId] = useState(null);
  const [editor, setEditor] = useState(null); // { item } — item null = create
  const [movement, setMovement] = useState(null); // { item, mode, restockId }
  const [showLocations, setShowLocations] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await loadManage(store.key);
      setState({ loading: false, error: null, data });
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setState((prev) => ({ loading: false, error: error.message, data: prev.data }));
    }
  }, [store.key]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const data = state.data;
  const items = data?.items || NONE;
  const capabilities = data?.capabilities || {};
  const checkouts = useMemo(() => (data?.checkouts || NONE).filter(isOpenCheckout), [data]);
  const restock = data?.restock || NONE;
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const locationNames = useMemo(() => new Map((data?.locations || NONE).map((entry) => [entry.id, entry.name])), [data]);

  const rows = useMemo(() => {
    const checkoutsByItem = new Map();
    checkouts.forEach((checkout) => {
      if (!checkoutsByItem.has(checkout.itemId)) checkoutsByItem.set(checkout.itemId, []);
      checkoutsByItem.get(checkout.itemId).push(checkout);
    });
    const openRestockByItem = new Map(restock.filter((entry) => OPEN_RESTOCK_STATUSES.includes(entry.status)).map((entry) => [entry.itemId, entry]));
    return items.map((item) => {
      const openCheckouts = checkoutsByItem.get(item.id) || NONE;
      return { item, openCheckouts, status: deriveItemStatus(item, openCheckouts), openRestock: openRestockByItem.get(item.id) || null };
    });
  }, [checkouts, items, restock]);

  const visible = useMemo(
    () =>
      rows
        .filter((row) => matchesManageFilter(row, filter))
        .filter((row) => !category || row.item.category === category)
        .filter((row) => matchesSearch({ ...row.item, locationName: locationNames.get(row.item.locationId) }, search))
        .sort(compareRows(sort)),
    [category, filter, locationNames, rows, search, sort]
  );

  const summary = useMemo(() => {
    const active = rows.filter((row) => row.item.isActive);
    return {
      items: active.length,
      low: active.filter((row) => isLowStock(row.item)).length,
      out: checkouts.filter((entry) => entry.status === "out").length,
      overdue: active.reduce((count, row) => count + row.status.overdueCount, 0),
      missing: active.reduce((count, row) => count + row.status.missingCount, 0),
      restock: restock.filter((entry) => OPEN_RESTOCK_STATUSES.includes(entry.status)).length,
      warranty: (data?.warranty || NONE).filter((entry) => entry.status === "stored" || entry.status === "awaiting_return").length,
      value: active.reduce((total, row) => total + (toNumber(row.item.unitCost) || 0) * (toNumber(row.item.currentQuantity) || 0), 0),
    };
  }, [checkouts, data, restock, rows]);

  const tabs = [
    { label: "Stock", value: "stock" },
    { label: `Checked out (${summary.out + summary.missing})`, value: "checkouts" },
    { label: `Restock (${summary.restock})`, value: "restock" },
    { label: `Warranty (${summary.warranty})`, value: "warranty" },
    { label: "Activity", value: "activity" },
  ];

  if (state.loading) return <SectionGridSkeleton cards={6} />;
  if (state.error && !data) {
    return (
      <EmptyState
        variant="page"
        role="alert"
        title="Stock management could not load"
        description={state.error}
        action={<Button type="button" variant="primary" symbol={false} onClick={refresh}>Try again</Button>}
      />
    );
  }

  return (
    <div className={styles.screen}>
      {data?.migrationPending && (
        <StatusMessage tone="warning">Stock Access needs its database migration (20260928130000_stock_access.sql, 20260928140000_stock_access_stores.sql) before items can be added.</StatusMessage>
      )}
      {state.error && <StatusMessage tone="danger">{state.error}</StatusMessage>}

      {/* Stock summary: headline counts, buttons to add an item, manage locations or open the quick screen, and the tab switcher. */}
      <LayerTheme>
        <div className={styles.summaryGrid}>
          <Stat label="Active items" value={summary.items} />
          <Stat label="Low / out of stock" value={summary.low} />
          <Stat label="Checked out" value={summary.out} />
          <Stat label="Overdue" value={summary.overdue} />
          <Stat label="Missing" value={summary.missing} />
          <Stat label="Open restock" value={summary.restock} />
          {capabilities.viewCosts && <Stat label="Stock value" value={formatMoney(summary.value)} />}
        </div>
        <div className={styles.toolbar}>
          <Button type="button" variant="primary" symbol={false} onClick={() => setEditor({ item: null })} disabled={data?.migrationPending}>
            Add item
          </Button>
          <Button type="button" variant="secondary" symbol={false} onClick={() => setShowLocations(true)} disabled={data?.migrationPending}>
            Locations
          </Button>
          <Button type="button" variant="secondary" symbol={false} onClick={() => router.push(storeHref(store))}>
            Quick screen
          </Button>
        </div>
        <TabGroup items={tabs} value={tab} onChange={setTab} ariaLabel="Stock management" />
      </LayerTheme>

      {/* Active tab content: the stock table with search and filters, checked-out items, restock requests, warranty parts or the activity log. */}
      <LayerTheme>
        {tab === "stock" && (
          <>
            <div className={styles.toolbar}>
              <div className={styles.searchField}>
                <InputField label="Search" type="search" phoneCollapse={false} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, SKU, barcode, bin, supplier" />
              </div>
              <div className={styles.toolbarFilter}>
                <DropdownField label="Show" options={MANAGE_FILTERS} value={filter} onValueChange={(value) => setFilter(value || "all")} />
              </div>
              <div className={styles.toolbarFilter}>
                <DropdownField
                  label="Category"
                  options={[{ value: "", label: "All categories" }, ...STOCK_ACCESS_CATEGORIES.map((entry) => ({ value: entry.value, label: entry.label }))]}
                  value={category}
                  onValueChange={(value) => setCategory(value || "")}
                />
              </div>
              <div className={styles.toolbarFilter}>
                <DropdownField label="Sort" options={MANAGE_SORTS} value={sort} onValueChange={(value) => setSort(value || "name")} />
              </div>
            </div>
            {!visible.length ? (
              <EmptyState title={items.length ? "No items match" : "No stock items yet"} description={items.length ? "Change the search or filters." : "Add the first item to start logging movements on /access."} />
            ) : (
              <DataTableShell stack visibleRows={15}>
                <table className="app-data-table app-data-table--clickable">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Location</th>
                      <th scope="col" data-table-cell="nowrap">Current</th>
                      <th scope="col" data-table-cell="nowrap">Available</th>
                      <th scope="col">Checked out</th>
                      <th scope="col" data-table-cell="nowrap">Min / reorder</th>
                      <th scope="col">Status</th>
                      <th scope="col">Restock</th>
                      <th scope="col" data-table-cell="nowrap">Last movement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(({ item, openCheckouts, status, openRestock }) => (
                      <tr
                        key={item.id}
                        tabIndex={0}
                        onClick={() => setDetailId(item.id)}
                        onKeyDown={(event) => {
                          if (event.target === event.currentTarget && event.key === "Enter") setDetailId(item.id);
                        }}
                      >
                        <td>
                          <span className={styles.cellTitle}>{item.name}</span>
                          <span className={styles.cellSub}>
                            {[CATEGORY_BY_VALUE[item.category]?.label, item.subcategory, item.sku].filter(Boolean).join(" · ")}
                          </span>
                        </td>
                        <td>{[locationNames.get(item.locationId), item.bin].filter(Boolean).join(" · ") || "—"}</td>
                        <td data-table-cell="nowrap">{formatQuantity(item.currentQuantity, item)}</td>
                        <td data-table-cell="nowrap">{formatQuantity(availableQuantity(item), item)}</td>
                        <td>
                          {item.checkedOutQuantity > 0 ? formatQuantity(item.checkedOutQuantity, item) : "—"}
                          {openCheckouts.length > 0 && (
                            <span className={styles.cellSub}>{Array.from(new Set(openCheckouts.map((entry) => entry.holderName))).join(", ")}</span>
                          )}
                        </td>
                        <td data-table-cell="nowrap">
                          {formatQuantity(item.minQuantity, item)} / {formatQuantity(item.reorderQuantity, item)}
                        </td>
                        <td><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                        <td>
                          {openRestock ? (
                            <StatusBadge tone={RESTOCK_STATUS_BY_VALUE[openRestock.status]?.tone}>
                              {RESTOCK_STATUS_BY_VALUE[openRestock.status]?.label} · {formatQuantity(openRestock.quantityRequested, item)}
                            </StatusBadge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td data-table-cell="nowrap">{formatRelative(item.lastMovementAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableShell>
            )}
          </>
        )}

        {tab === "checkouts" && <CheckoutsTab checkouts={checkouts} itemsById={itemsById} onOpenItem={setDetailId} />}
        {tab === "restock" && (
          <RestockTab
            restock={restock}
            itemsById={itemsById}
            capabilities={capabilities}
            onOpenItem={setDetailId}
            onChanged={refresh}
            onReceive={(request) => {
              const item = itemsById.get(request.itemId);
              if (item) setMovement({ item, mode: "receive", restockId: request.id });
            }}
          />
        )}
        {tab === "warranty" && <WarrantyTab warranty={data?.warranty || NONE} locationNames={locationNames} capabilities={capabilities} onChanged={refresh} />}
        {tab === "activity" && <ActivityTab storeKey={store.key} itemsById={itemsById} onOpenItem={setDetailId} refreshKey={refreshKey} />}
      </LayerTheme>

      {detailId && !editor && !movement && (
        <ItemDetailModal
          itemId={detailId}
          capabilities={capabilities}
          onClose={() => setDetailId(null)}
          onEdit={(item) => setEditor({ item })}
          onMovement={(item) => setMovement({ item, mode: "receive", restockId: null })}
          onChanged={refresh}
        />
      )}
      {editor && (
        <ItemEditorModal
          storeKey={store.key}
          item={editor.item}
          locations={data?.locations || NONE}
          capabilities={capabilities}
          onClose={() => setEditor(null)}
          onSaved={(saved) => {
            setEditor(null);
            if (saved?.id) setDetailId(saved.id);
            refresh();
          }}
        />
      )}
      {movement && (
        <StockMovementModal
          item={itemsById.get(movement.item.id) || movement.item}
          restock={restock}
          capabilities={capabilities}
          initialMode={movement.mode}
          initialRestockId={movement.restockId}
          onClose={() => setMovement(null)}
          onSaved={() => {
            setMovement(null);
            refresh();
          }}
        />
      )}
      {showLocations && <LocationsModal storeKey={store.key} locations={data?.locations || NONE} onClose={() => setShowLocations(false)} onChanged={refresh} />}
    </div>
  );
}
