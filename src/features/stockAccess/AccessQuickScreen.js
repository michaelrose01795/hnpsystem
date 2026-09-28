// file location: src/features/stockAccess/AccessQuickScreen.js
//
// /access/<store> — a store's quick screen (e.g. /access/back-shed). Every
// store renders this same screen with its own items. Built for a few seconds per visit:
//
//   1. Find the item: type, scan (handheld scanner into the search box + Enter,
//      or the camera where the browser supports it), or tap it in
//      "Items you have" / "Recent" / "Common".
//   2. The action sheet opens with the right action preselected; confirm.
//
// Printed QR labels open /access/<store>?item=<id> and go straight to step 2.
// Everything shown here comes from one request (GET /api/access); the API
// decides what the caller may do.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Button, EmptyState, InputField, LayerTheme, StatusMessage } from "@/components/ui";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { SectionGridSkeleton } from "@/components/ui/LoadingSkeleton";
import {
  STOCK_ACCESS_CATEGORIES,
  availableQuantity,
  deriveItemStatus,
  formatQuantity,
  isOpenCheckout,
  matchScan,
  matchesSearch,
  outstandingOnCheckout,
} from "@/features/stockAccess/stockAccessModel";
import { loadAccess } from "@/features/stockAccess/stockAccessClient";
import { StatusBadge } from "@/features/stockAccess/AccessBits";
import AccessActionSheet from "@/features/stockAccess/AccessActionSheet";
import WarrantyStoreSheet from "@/features/stockAccess/WarrantyStoreSheet";
import BarcodeScanner, { isCameraScanSupported } from "@/features/stockAccess/BarcodeScanner";
import styles from "@/features/stockAccess/stockAccess.module.css";
import { storeHref, storeManageHref } from "@/config/stockAccessStores";

const NONE = [];
const CATEGORY_TABS = [{ label: "All", value: "all" }, ...STOCK_ACCESS_CATEGORIES.map((entry) => ({ label: entry.label, value: entry.value }))];
const UUID_IN_TEXT_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MAX_RESULTS = 60;

function ItemTile({ item, status, detail, onOpen }) {
  return (
    <Button type="button" variant="secondary" symbol={false} className="app-btn--tile" onClick={() => onOpen(item.id)}>
      <span className={styles.tileTitle}>{item.name}</span>
      <span className={styles.tileMeta}>{detail}</span>
      <span className={styles.tileFoot}>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        <span className={styles.qty}>{formatQuantity(availableQuantity(item), item)}</span>
      </span>
    </Button>
  );
}

function TileSection({ title, count, children }) {
  return (
    <LayerTheme>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {count !== undefined && <span className={styles.muted}>{count}</span>}
      </div>
      <div className={styles.tileGrid}>{children}</div>
    </LayerTheme>
  );
}

export default function AccessQuickScreen({ store }) {
  const router = useRouter();
  const searchRef = useRef(null);
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sheet, setSheet] = useState(null); // { itemId, action }
  const [warranty, setWarranty] = useState(null); // { item } | null
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState(null);
  const [canScan, setCanScan] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await loadAccess(store.key);
      setState({ loading: false, error: null, data });
    } catch (error) {
      setState((prev) => ({ loading: false, error: error.message, data: prev.data }));
    }
  }, [store.key]);

  useEffect(() => {
    refresh();
    setCanScan(isCameraScanSupported());
  }, [refresh]);

  const data = state.data;
  const items = data?.items || NONE;
  const capabilities = data?.capabilities || {};
  const userId = data?.userId ?? null;

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const checkoutsByItem = useMemo(() => {
    const map = new Map();
    (data?.checkouts || NONE).filter(isOpenCheckout).forEach((checkout) => {
      if (!map.has(checkout.itemId)) map.set(checkout.itemId, []);
      map.get(checkout.itemId).push(checkout);
    });
    return map;
  }, [data]);
  const restockByItem = useMemo(() => new Map((data?.restock || NONE).map((entry) => [entry.itemId, entry])), [data]);
  const locationNames = useMemo(() => new Map((data?.locations || NONE).map((entry) => [entry.id, entry.name])), [data]);

  const statusFor = useCallback((item) => deriveItemStatus(item, checkoutsByItem.get(item.id) || NONE), [checkoutsByItem]);
  const detailFor = (item) => [locationNames.get(item.locationId), item.bin, item.sku].filter(Boolean).join(" · ") || STOCK_ACCESS_CATEGORIES.find((c) => c.value === item.category)?.label;

  const openItem = useCallback(
    (itemId, action = null) => {
      if (!itemsById.has(itemId)) return false;
      setSheet({ itemId, action });
      return true;
    },
    [itemsById]
  );

  // QR label deep link: /access/<store>?item=<id>&action=<action>
  useEffect(() => {
    if (!router.isReady || !data || typeof router.query.item !== "string") return;
    if (!openItem(router.query.item, typeof router.query.action === "string" ? router.query.action : null)) {
      setNotice("That label's item is not in the active stock list.");
    }
    router.replace(storeHref(store), undefined, { shallow: true });
  }, [data, openItem, router, store]);

  const handleCode = useCallback(
    (raw) => {
      const code = String(raw || "").trim();
      if (!code) return false;
      const fromLabel = code.match(UUID_IN_TEXT_RE)?.[0];
      if (fromLabel && openItem(fromLabel)) return true;
      const match = matchScan(items, code);
      if (match) return openItem(match.id);
      return false;
    },
    [items, openItem]
  );

  const onDetected = useCallback(
    (value) => {
      setScanning(false);
      if (!handleCode(value)) {
        setSearch(value);
        setNotice(`No item uses the code ${value}.`);
      }
    },
    [handleCode]
  );

  const browsing = search.trim().length > 0 || category !== "all";
  const results = useMemo(() => {
    if (!browsing) return NONE;
    return items
      .filter((item) => (category === "all" || item.category === category) && matchesSearch(item, search))
      .slice(0, MAX_RESULTS);
  }, [browsing, category, items, search]);

  const onSearchKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    // A handheld scanner types the code and presses Enter.
    if (handleCode(search)) {
      setSearch("");
      setNotice(null);
    } else if (results.length === 1) {
      openItem(results[0].id);
      setSearch("");
    }
  };

  const myCheckouts = useMemo(
    () => (data?.checkouts || NONE).filter((checkout) => checkout.status === "out" && userId !== null && checkout.holderUserId === userId),
    [data, userId]
  );
  const recent = useMemo(() => (data?.recentItemIds || NONE).map((id) => itemsById.get(id)).filter(Boolean), [data, itemsById]);
  const common = useMemo(() => {
    const recentIds = new Set(recent.map((item) => item.id));
    return (data?.commonItemIds || NONE).filter((id) => !recentIds.has(id)).map((id) => itemsById.get(id)).filter(Boolean);
  }, [data, itemsById, recent]);

  const closeSheet = () => {
    setSheet(null);
    // Straight back to the search box for the next item.
    setTimeout(() => searchRef.current?.focus?.(), 0);
  };

  if (state.loading) return <SectionGridSkeleton cards={6} />;
  if (state.error && !data) {
    return (
      <EmptyState
        variant="page"
        role="alert"
        title="Stock Access could not load"
        description={state.error}
        action={<Button type="button" variant="primary" symbol={false} onClick={refresh}>Try again</Button>}
      />
    );
  }

  const sheetItem = sheet ? itemsById.get(sheet.itemId) : null;

  return (
    <div className={styles.screen}>
      {data?.migrationPending && (
        <StatusMessage tone="warning">Stock Access needs its database migration before items can be recorded. Ask an admin to apply 20260928140000_stock_access_stores.sql.</StatusMessage>
      )}

      <LayerTheme>
        <div className={styles.searchRow}>
          <div className={styles.searchField}>
            <InputField
              ref={searchRef}
              label="Find an item"
              type="search"
              phoneCollapse={false}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setNotice(null);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Name, code or scan a barcode"
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
          {canScan && (
            <Button type="button" variant="primary" onClick={() => setScanning(true)}>
              Scan
            </Button>
          )}
        </div>
        <div className={styles.bigActions}>
          {capabilities.storeWarranty && (
            <Button type="button" variant="secondary" symbol={false} onClick={() => setWarranty({ item: null })}>
              Warranty Store
            </Button>
          )}
          {capabilities.manage && (
            <Button type="button" variant="secondary" symbol={false} onClick={() => router.push(storeManageHref(store))}>
              Manage {store.label}
            </Button>
          )}
        </div>
        <TabGroup items={CATEGORY_TABS} value={category} onChange={setCategory} ariaLabel="Category" />
        {notice && <StatusMessage tone="warning">{notice}</StatusMessage>}
        {state.error && <StatusMessage tone="danger">{state.error}</StatusMessage>}
      </LayerTheme>

      {myCheckouts.length > 0 && !browsing && (
        <TileSection title="Items you have" count={myCheckouts.length}>
          {myCheckouts.map((checkout) => {
            const item = itemsById.get(checkout.itemId);
            if (!item) return null;
            return (
              <ItemTile
                key={checkout.id}
                item={item}
                status={statusFor(item)}
                detail={`You have ${formatQuantity(outstandingOnCheckout(checkout), item)} · tap to return`}
                onOpen={(id) => openItem(id, "return")}
              />
            );
          })}
        </TileSection>
      )}

      {browsing ? (
        <TileSection title={search.trim() ? "Results" : CATEGORY_TABS.find((tab) => tab.value === category)?.label} count={results.length}>
          {results.length ? (
            results.map((item) => <ItemTile key={item.id} item={item} status={statusFor(item)} detail={detailFor(item)} onOpen={openItem} />)
          ) : (
            <EmptyState title="No matching items" description={capabilities.manage ? `Add it from Manage ${store.label}.` : "Ask Parts to add it to the stock list."} />
          )}
        </TileSection>
      ) : (
        <>
          {recent.length > 0 && (
            <TileSection title="Your recent items">
              {recent.map((item) => <ItemTile key={item.id} item={item} status={statusFor(item)} detail={detailFor(item)} onOpen={openItem} />)}
            </TileSection>
          )}
          {common.length > 0 && (
            <TileSection title="Commonly used">
              {common.map((item) => <ItemTile key={item.id} item={item} status={statusFor(item)} detail={detailFor(item)} onOpen={openItem} />)}
            </TileSection>
          )}
          <TileSection title="All items" count={items.length}>
            {items.length ? (
              items.map((item) => <ItemTile key={item.id} item={item} status={statusFor(item)} detail={detailFor(item)} onOpen={openItem} />)
            ) : (
              <EmptyState title="No stock items yet" description={capabilities.manage ? `Add the first item from Manage ${store.label}.` : "Parts has not added any items yet."} />
            )}
          </TileSection>
        </>
      )}

      {sheetItem && (
        <AccessActionSheet
          key={sheetItem.id}
          item={sheetItem}
          status={statusFor(sheetItem)}
          openCheckouts={checkoutsByItem.get(sheetItem.id) || NONE}
          openRestock={restockByItem.get(sheetItem.id) || null}
          userId={userId}
          capabilities={capabilities}
          locationName={locationNames.get(sheetItem.locationId) || ""}
          initialAction={sheet.action}
          onClose={closeSheet}
          onRecorded={refresh}
          onWarranty={(item) => {
            setSheet(null);
            setWarranty({ item });
          }}
        />
      )}
      {warranty && (
        <WarrantyStoreSheet storeKey={store.key} item={warranty.item} locations={data?.locations || NONE} onClose={() => setWarranty(null)} onRecorded={refresh} />
      )}
      {scanning && <BarcodeScanner onDetected={onDetected} onClose={() => setScanning(false)} />}
    </div>
  );
}
