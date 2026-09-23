// file location: src/features/tracking/equipment/EquipmentTrackerPanel.js
//
// The Equipment/Tools tab on /tracking. Owns the register data, the filters
// below the page's shared search bar, the Cards / Compact views and the one
// popup that is open at a time (record, check, fault, editor, checklists).
//
// The page keeps what it already owned: the shared search box, the category
// dropdown and the "Add Equipment/tools" button in its header row. They arrive
// here as props. Code-split by the page, like the Loan Cars panel.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button, EmptyState, StatusMessage } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { useUser } from "@/context/UserContext";
import useIdleWarm from "@/hooks/useIdleWarm";
import { reportSuccess, reportWarning } from "@/lib/notifications/report";
import { EQUIPMENT_DEPARTMENTS, EQUIPMENT_LOCATIONS } from "@/config/equipmentTracking";
import {
  EQUIPMENT_QUICK_FILTERS,
  EQUIPMENT_SORTS,
  decorateEquipment,
  filterEquipmentEntries,
  groupEquipmentEntries,
  normaliseAssetCode,
  sortEquipmentEntries,
  toOptions,
  summariseEquipment,
} from "@/features/tracking/equipment/equipmentModel";
import { NO_EQUIPMENT_CAPABILITIES } from "@/features/tracking/equipment/equipmentPermissions";
import { fetchEquipmentList } from "@/features/tracking/equipment/equipmentClient";
import {
  EquipmentCard,
  EquipmentCompactTable,
  EquipmentSummaryBar,
} from "@/features/tracking/equipment/EquipmentViews";
import EquipmentPanelSkeleton from "@/features/tracking/equipment/EquipmentPanelSkeleton";

// The drawers (~1,750 lines, plus the calendar, tab group, QR label and popup
// shell they pull in) only render after a click or a QR deep link, so they are
// split out of the register's first-load chunk. The two a user reaches first
// are warmed once the list is on screen, so opening one does not wait.
const loadDetailDrawer = () => import("@/features/tracking/equipment/EquipmentDetailDrawer");
const loadCheckDrawer = () => import("@/features/tracking/equipment/EquipmentCheckDrawer");
const EquipmentDetailDrawer = dynamic(loadDetailDrawer, { ssr: false });
const EquipmentCheckDrawer = dynamic(loadCheckDrawer, { ssr: false });
const loadFaultDrawer = () => import("@/features/tracking/equipment/EquipmentFaultDrawer");
const EquipmentFaultDrawer = dynamic(loadFaultDrawer, { ssr: false });
const EquipmentEditorDrawer = dynamic(() => import("@/features/tracking/equipment/EquipmentEditorDrawer"), { ssr: false });
const EquipmentChecklistDrawer = dynamic(() => import("@/features/tracking/equipment/EquipmentChecklistDrawer"), { ssr: false });
const WARM_DRAWERS = [loadDetailDrawer, loadCheckDrawer];

const VIEW_STORAGE_KEY = "hnp:tracking:equipment-view";
const GROUP_PAGE_SIZE = 12;
const FLAT_PAGE_SIZE = 48;

const readStoredView = () => {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "compact" ? "compact" : "cards";
  } catch {
    return "cards";
  }
};

const storeView = (value) => {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, value);
  } catch {
    // Per-viewer convenience only; the page works without it.
  }
};

export default function EquipmentTrackerPanel({
  searchTerm = "",
  categoryFilter = "all",
  addRequest = 0,
  deepLink = null,
  onDeepLinkHandled,
  onCapabilitiesChange,
}) {
  const { user } = useUser();
  const [assets, setAssets] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [capabilities, setCapabilities] = useState(NO_EQUIPMENT_CAPABILITIES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [quickFilter, setQuickFilter] = useState("active");
  const [department, setDepartment] = useState("all");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState("urgency");
  // Read synchronously (the panel is client-only), so a Compact user never
  // sees the Cards layout first.
  const [view, setView] = useState(readStoredView);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pageSizes, setPageSizes] = useState({});
  const [drawer, setDrawer] = useState(null);
  const [detailRefresh, setDetailRefresh] = useState(0);

  useIdleWarm(WARM_DRAWERS);

  // A QR deep link opens a drawer as soon as the list is in: fetch the drawer
  // chunks now, alongside the list, rather than after it.
  const hasDeepLink = Boolean(deepLink?.asset);
  useEffect(() => {
    if (!hasDeepLink) return;
    [loadDetailDrawer, loadCheckDrawer, loadFaultDrawer].forEach((load) => load().catch(() => {}));
  }, [hasDeepLink]);

  const load = useCallback(async (force = false) => {
    setLoadError("");
    try {
      const payload = await fetchEquipmentList({ force });
      setAssets(Array.isArray(payload.data) ? payload.data : []);
      setChecklists(Array.isArray(payload.checklists) ? payload.checklists : []);
      setCapabilities(payload.capabilities || NO_EQUIPMENT_CAPABILITIES);
    } catch (error) {
      setLoadError(error.message || "Unable to load equipment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    onCapabilitiesChange?.(capabilities);
  }, [capabilities, onCapabilitiesChange]);

  // The header's "Add Equipment/tools" button bumps addRequest.
  useEffect(() => {
    if (addRequest > 0) setDrawer({ type: "edit", asset: null });
  }, [addRequest]);

  // A scanned QR label: /tracking/Equipment-Tools?asset=EQ-0001[&action=check|fault]
  useEffect(() => {
    if (!deepLink?.asset || loading) return;
    const code = normaliseAssetCode(deepLink.asset);
    const asset = assets.find((item) => item.assetCode === code);
    if (asset && deepLink.action === "check" && capabilities.check) {
      setDrawer({ type: "check", assets: [asset], mode: "routine", returnTo: asset.id });
    } else if (asset && deepLink.action === "fault" && capabilities.reportFault) {
      setDrawer({ type: "fault", asset, mode: "report", returnTo: asset.id });
    } else {
      setDrawer({ type: "detail", assetRef: asset?.id || code, tab: "overview" });
    }
    onDeepLinkHandled?.();
  }, [deepLink, loading, assets, capabilities, onDeepLinkHandled]);

  const upsertAssets = useCallback((next = []) => {
    const list = (Array.isArray(next) ? next : [next]).filter(Boolean);
    if (!list.length) return;
    setAssets((previous) => {
      const byId = new Map(previous.map((asset) => [asset.id, asset]));
      for (const asset of list) byId.set(asset.id, asset);
      return [...byId.values()];
    });
  }, []);

  /* ------------------------------------------------------ derived lists */
  const now = useMemo(() => new Date(), [assets]); // eslint-disable-line react-hooks/exhaustive-deps
  const decorated = useMemo(() => decorateEquipment(assets, now), [assets, now]);
  const summary = useMemo(() => summariseEquipment(assets, now), [assets, now]);
  const filtered = useMemo(
    () =>
      filterEquipmentEntries(
        decorated,
        { search: searchTerm, quickFilter, category: categoryFilter, department, location },
        now
      ),
    [decorated, searchTerm, quickFilter, categoryFilter, department, location, now]
  );
  const sorted = useMemo(() => sortEquipmentEntries(filtered, sort), [filtered, sort]);
  const groups = useMemo(() => groupEquipmentEntries(sorted, sort), [sorted, sort]);

  // Reset paging when the question changes.
  useEffect(() => setPageSizes({}), [searchTerm, quickFilter, categoryFilter, department, location, sort]);

  const locationOptions = useMemo(
    () =>
      toOptions(
        department === "all" ? EQUIPMENT_LOCATIONS : EQUIPMENT_LOCATIONS.filter((item) => item.department === department),
        { allLabel: "All locations" }
      ),
    [department]
  );

  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const canSelect = capabilities.bulkCheck;
  const selectedAssets = [...selectedIds].map((id) => assetsById.get(id)).filter(Boolean);

  const toggleSelect = (id) =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleMany = (ids, select) =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  /* ------------------------------------------------------------ actions */
  const openDetail = (asset, tab = "overview") => setDrawer({ type: "detail", assetRef: asset.id, tab });
  const openCheck = (asset) => setDrawer({ type: "check", assets: [asset], mode: "routine" });
  const openFault = (asset) => setDrawer({ type: "fault", asset, mode: "report" });

  const returnOrClose = (current) => {
    if (current?.returnTo) {
      setDetailRefresh((value) => value + 1);
      setDrawer({ type: "detail", assetRef: current.returnTo, tab: "overview" });
    } else {
      setDrawer(null);
    }
  };

  const warnFailures = (failures) => {
    if (failures?.length) reportWarning(`Saved, but some files did not upload: ${failures.join("; ")}`);
  };

  const handleDetailAction = (action) => {
    const returnTo = action.asset?.id;
    if (action.type === "check") setDrawer({ type: "check", assets: [action.asset], mode: action.mode, returnTo });
    if (action.type === "fault") setDrawer({ type: "fault", asset: action.asset, mode: action.mode, fault: action.fault, returnTo });
    if (action.type === "edit") setDrawer({ type: "edit", asset: action.asset, returnTo });
  };

  const actorName = user?.username || user?.name || "";

  /* ------------------------------------------------------------- render */
  const renderEntries = (entries) =>
    view === "compact" ? (
      <EquipmentCompactTable
        entries={entries}
        capabilities={capabilities}
        selectable={selecting}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleAll={toggleMany}
        onOpen={(asset) => openDetail(asset)}
        onCheck={openCheck}
      />
    ) : (
      <div className="equipment-grid">
        {entries.map((entry) => (
          <EquipmentCard
            key={entry.asset.id}
            entry={entry}
            capabilities={capabilities}
            selectable={selecting}
            selected={selectedIds.has(entry.asset.id)}
            onToggleSelect={toggleSelect}
            onOpen={(asset) => openDetail(asset)}
            onHistory={(asset) => openDetail(asset, "history")}
            onCheck={openCheck}
            onFault={openFault}
          />
        ))}
      </div>
    );

  const activeCount = summary.total;

  return (
    <div className="equipment-tracker">
      <EquipmentSummaryBar summary={summary} activeFilter={quickFilter} onSelect={setQuickFilter} />

      <div className="equipment-toolbar" role="group" aria-label="Equipment filters">
        <div className="equipment-toolbar__field">
          <DropdownField
            value={department}
            onValueChange={(value) => {
              setDepartment(value);
              setLocation("all");
            }}
            options={toOptions(EQUIPMENT_DEPARTMENTS, { allLabel: "All areas" })}
            ariaLabel="Filter equipment by area"
            size="sm"
          />
        </div>
        <div className="equipment-toolbar__field">
          <DropdownField value={location} onValueChange={setLocation} options={locationOptions} ariaLabel="Filter equipment by location" size="sm" />
        </div>
        <div className="equipment-toolbar__field">
          <DropdownField
            value={quickFilter}
            onValueChange={setQuickFilter}
            options={toOptions(EQUIPMENT_QUICK_FILTERS)}
            ariaLabel="Filter equipment by status"
            size="sm"
          />
        </div>
        <div className="equipment-toolbar__field">
          <DropdownField
            value={sort}
            onValueChange={setSort}
            options={EQUIPMENT_SORTS.map((option) => ({ key: option.key, value: option.key, label: `Sort: ${option.label}` }))}
            ariaLabel="Sort equipment"
            size="sm"
          />
        </div>
        <div className="equipment-toolbar__end">
          <div className="tracking-viewswitch" role="group" aria-label="Equipment view">
            {[
              ["cards", "Cards"],
              ["compact", "Compact"],
            ].map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={view === value ? "primary" : "secondary"}
                aria-pressed={view === value}
                onClick={() => {
                  setView(value);
                  storeView(value);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          {canSelect && !selecting && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setSelecting(true)}>
              Bulk check
            </Button>
          )}
          {capabilities.manageChecklists && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setDrawer({ type: "checklists" })}>
              Checklists
            </Button>
          )}
        </div>
      </div>

      {selecting && (
        <div className="equipment-toolbar" role="group" aria-label="Bulk check">
          <span className="equipment-toolbar__note">
            {selectedAssets.length} selected — tick equipment, then log one check for all of it. Each asset keeps its own record.
          </span>
          <div className="equipment-toolbar__end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!selectedAssets.length}
              onClick={() => setDrawer({ type: "check", assets: selectedAssets, mode: "routine", bulk: true })}
            >
              Log check for {selectedAssets.length || "…"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={stopSelecting}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loadError && (
        <StatusMessage tone="danger">
          {loadError}{" "}
          <Button type="button" variant="secondary" size="xs" onClick={() => load(true)}>
            Retry
          </Button>
        </StatusMessage>
      )}

      {loading && <EquipmentPanelSkeleton view={view} />}

      {!loading && !loadError && assets.length === 0 && (
        <EmptyState
          variant="bare"
          title="Equipment service list is empty."
          description={capabilities.manage ? "Use Add Equipment/tools to register the first asset." : undefined}
        />
      )}

      {!loading && assets.length > 0 && sorted.length === 0 && (
        <EmptyState
          variant="bare"
          title="No equipment/tools match your search or filters."
          description={activeCount === 0 && quickFilter !== "retired" ? "Every asset on the register is retired." : undefined}
        />
      )}

      {groups.map((group) => {
        const limit = pageSizes[group.key] || (group.key === "all" ? FLAT_PAGE_SIZE : GROUP_PAGE_SIZE);
        const shown = group.entries.slice(0, limit);
        const remaining = group.entries.length - shown.length;
        return (
          // Layout-only region: a section inherits global card padding and narrows the grid.
          <div key={group.key} className="equipment-group" role="region" aria-label={group.label || "Equipment"}>
            {group.label && (
              <div className="equipment-group__head">
                <h2 className="equipment-group__title">{group.label}</h2>
                <span className="equipment-group__count">{group.entries.length}</span>
              </div>
            )}
            {renderEntries(shown)}
            {remaining > 0 && (
              <div className="equipment-group__more">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPageSizes((previous) => ({ ...previous, [group.key]: group.entries.length }))}
                >
                  Show {remaining} more
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {drawer?.type === "detail" && (
        <EquipmentDetailDrawer
          key={drawer.assetRef}
          assetRef={drawer.assetRef}
          initialTab={drawer.tab}
          capabilities={capabilities}
          checklists={checklists}
          refreshToken={detailRefresh}
          onAction={handleDetailAction}
          onAssetChanged={(asset) => upsertAssets(asset)}
          onClose={() => setDrawer(null)}
        />
      )}

      {drawer?.type === "check" && (
        <EquipmentCheckDrawer
          assets={drawer.assets}
          mode={drawer.mode}
          checklists={checklists}
          actorName={actorName}
          onClose={() => returnOrClose(drawer)}
          onSaved={(saved, failures) => {
            upsertAssets(saved.assets);
            reportSuccess(
              saved.assets.length > 1 ? `Check logged for ${saved.assets.length} assets` : "Check logged"
            );
            warnFailures(failures);
            if (drawer.bulk) stopSelecting();
            returnOrClose(drawer);
          }}
        />
      )}

      {drawer?.type === "fault" && (
        <EquipmentFaultDrawer
          asset={drawer.asset}
          fault={drawer.fault}
          mode={drawer.mode}
          actorName={actorName}
          onClose={() => returnOrClose(drawer)}
          onSaved={(saved, failures) => {
            upsertAssets(saved.asset);
            reportSuccess(drawer.mode === "report" ? "Fault reported" : drawer.mode === "resolve" ? "Fault resolved" : "Repair started");
            warnFailures(failures);
            returnOrClose(drawer);
          }}
        />
      )}

      {drawer?.type === "edit" && (
        <EquipmentEditorDrawer
          asset={drawer.asset}
          checklists={checklists}
          onClose={() => returnOrClose(drawer)}
          onSaved={(saved) => {
            upsertAssets(saved);
            reportSuccess(drawer.asset ? "Equipment updated" : `Added as ${saved.assetCode}`);
            returnOrClose(drawer.returnTo ? drawer : { returnTo: saved.id });
          }}
        />
      )}

      {drawer?.type === "checklists" && (
        <EquipmentChecklistDrawer
          checklists={checklists}
          onChecklistSaved={(saved) => {
            setChecklists((previous) => {
              const exists = previous.some((item) => item.id === saved.id);
              return exists ? previous.map((item) => (item.id === saved.id ? saved : item)) : [...previous, saved];
            });
            reportSuccess("Checklist saved");
          }}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
