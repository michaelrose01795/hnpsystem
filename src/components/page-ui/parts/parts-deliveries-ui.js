// file location: src/components/page-ui/parts/parts-deliveries-ui.js
//
// Presentation layer for /deliveries. All state and data handling live in
// src/pages/deliveries/index.js; this file only arranges shared staff
// components — LayerSurface / LayerTheme, Button, DropdownField, CalendarField,
// SearchBar, EmptyState, the .app-summary-* strip and the
// .app-badge--* / .app-status-message families.
//
// The `data-presentation` anchors the parts-deliveries slide points at
// (deliveries-day-controls, deliveries-list) are preserved, so the guided
// presentation still finds its tooltips.

import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { CalendarField } from "@/components/ui/calendarAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import DeliveryRow from "@/components/Deliveries/DeliveryRow";
import DeliveryDetailPanel from "@/components/Deliveries/DeliveryDetailPanel";
import DeliveryWeekPanel from "@/components/Deliveries/DeliveryWeekPanel";
import DeliveryProofModal from "@/components/Deliveries/DeliveryProofModal";
import DeliveryFailureModal from "@/components/Deliveries/DeliveryFailureModal";
import { deliveryStyles, deliveryText } from "@/components/Deliveries/deliveryStyles";
import {
  formatCurrency,
  formatIsoDate,
} from "@/features/deliveries/deliveryFormatting";

const RouteSkeleton = () => (
  <div style={deliveryStyles.listScroll}>
    <SkeletonKeyframes />
    {Array.from({ length: 5 }).map((_, index) => (
      <LayerSurface
        key={index}
        padding="var(--space-3)"
        gap="var(--space-sm)"
        radius="var(--radius-sm)"
        style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: "var(--space-sm)" }}
      >
        <SkeletonBlock width="32px" height="32px" borderRadius="var(--radius-sm)" />
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <SkeletonBlock width="46%" height="12px" />
          <SkeletonBlock width="68%" height="10px" />
        </div>
        <SkeletonBlock width="88px" height="24px" />
      </LayerSurface>
    ))}
  </div>
);

export default function PartsDeliveriesPageUi(props) {
  const {
    busy,
    capabilities,
    changeDate,
    clearFilters,
    confirmFailure,
    confirmProof,
    deliveries,
    draggingId,
    driverFilter,
    driverOptions,
    drivers,
    dropTargetId,
    error,
    events,
    failureTarget,
    filtersActive,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    handleDrop,
    handleKeyboardMove,
    isMobile,
    loading,
    map,
    mapError,
    mapLoading,
    migrationPending,
    modalError,
    modalSaving,
    onCloseFailure,
    onCloseProof,
    onOpenProof,
    patchDelivery,
    proofTarget,
    refreshing,
    reorderEnabled,
    routeAnnouncement,
    runAction,
    searchTerm,
    selectDelivery,
    selectedDate,
    selectedDelivery,
    selectedId,
    setDriverFilter,
    setSearchTerm,
    setStatusFilter,
    setVehicleFilter,
    statusFilter,
    statusOptions,
    summary,
    summaryTiles,
    todayIso,
    totalStops,
    vehicleFilter,
    vehicleOptions,
    vehicles,
    weekOpen,
    toggleWeek,
    week,
  } = props;

  if (props.view === undefined) return null;

  if (props.view === "no-access") {
    return (
      <div style={deliveryStyles.page}>
        <LayerTheme as="section" sectionKey="parts-deliveries-no-access" sectionType="content-card">
          <EmptyState
            variant="page"
            icon="🔒"
            title="Delivery planning is not available to your role"
            description="Parts staff, parts managers and delivery drivers can open the delivery diary. Ask a manager if you need access."
          />
        </LayerTheme>
      </div>
    );
  }

  const detailStacked = isMobile;

  // Which action, if any, is mid-flight on a given row. Written as an explicit
  // guard rather than `busy?.id === row?.id` — with nothing selected and nothing
  // busy that comparison is undefined === undefined, i.e. true, and then reads
  // `.action` off null.
  const busyActionFor = (deliveryId) =>
    busy && deliveryId && busy.id === deliveryId ? busy.action : null;

  const detailPanel = (
    <DeliveryDetailPanel
      capabilities={capabilities}
      delivery={selectedDelivery}
      drivers={drivers}
      map={map}
      mapError={mapError}
      mapLoading={mapLoading}
      onSelectStopId={(id) => {
        const stop = deliveries.find((row) => row.id === id);
        if (stop) selectDelivery(stop);
      }}
      events={selectedDelivery ? events?.[selectedDelivery.id] || [] : []}
      stacked={detailStacked}
      busy={busyActionFor(selectedDelivery?.id)}
      onAction={runAction}
      onClose={() => selectedDelivery && selectDelivery(selectedDelivery)}
      onOpenProof={onOpenProof}
      onPatch={patchDelivery}
      vehicles={vehicles}
    />
  );

  const routeList = (
    <LayerTheme
      as="section"
      sectionKey="parts-deliveries-list"
      sectionType="content-card"
      data-presentation="deliveries-list"
      data-dev-text-preview="Delivery route"
      style={deliveryStyles.listCard}
    >
      <div style={deliveryStyles.headerTopRow}>
        <div style={deliveryStyles.cell}>
          <span style={deliveryText.label}>Route</span>
          <span style={deliveryText.muted}>
            {reorderEnabled
              ? "Drag a stop number to change the drive order, or focus it and use the arrow keys. The order saves itself."
              : filtersActive
              ? "Clear the filters to change the drive order."
              : "Showing the saved drive order."}
          </span>
        </div>
        <span style={deliveryText.caption}>
          {deliveries.length === totalStops
            ? `${totalStops} stop${totalStops === 1 ? "" : "s"}`
            : `${deliveries.length} of ${totalStops} stops`}
          {refreshing ? " · refreshing" : ""}
        </span>
      </div>

      {/* Route reordering announces itself for screen readers, since the visual
          change (the numbers shifting) is not conveyed by focus alone. */}
      <span aria-live="polite" style={deliveryText.caption}>
        {routeAnnouncement}
      </span>

      {error ? <div className="app-status-message app-status-message--danger">{error}</div> : null}

      {migrationPending ? (
        <div className="app-status-message app-status-message--warning">
          The delivery diary migration has not been applied to this database yet, so the route is
          showing without drivers, vehicles, delivery times or workflow states. Apply
          supabase/migrations/20260828120000_parts_delivery_diary.sql to switch the full diary on.
        </div>
      ) : null}

      {loading ? <RouteSkeleton /> : null}

      {!loading && deliveries.length === 0 ? (
        <EmptyState
          variant="inline"
          role="status"
          icon="🚚"
          title={filtersActive ? "No stops match these filters" : "No deliveries booked for this day"}
          description={
            filtersActive
              ? "Clear the filters to see the whole route for this day."
              : "Deliveries scheduled from an invoice on the delivery planner appear here on their delivery date."
          }
          action={
            filtersActive ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : null}

      {!loading && deliveries.length > 0 ? (
        <div style={deliveryStyles.listScroll}>
          {deliveries.map((delivery, index) => (
            <DeliveryRow
              key={delivery.id}
              busy={busyActionFor(delivery.id)}
              capabilities={{ ...capabilities, reorder: reorderEnabled }}
              delivery={delivery}
              index={index}
              isDragging={draggingId === delivery.id}
              isDropTarget={dropTargetId === delivery.id}
              onAction={runAction}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onKeyboardMove={handleKeyboardMove}
              onSelect={selectDelivery}
              selected={selectedId === delivery.id}
              stacked={isMobile}
              total={deliveries.length}
            />
          ))}
        </div>
      ) : null}
    </LayerTheme>
  );

  return (
    <>
      <div style={deliveryStyles.page}>
        {/* ---------------------------------------------------------------- */}
        {/* Day header: date controls, view switch, summary strip            */}
        {/* ---------------------------------------------------------------- */}
        <LayerTheme
          as="section"
          sectionKey="parts-deliveries-header"
          sectionType="content-card"
          data-dev-text-preview="Delivery day header"
          style={deliveryStyles.headerCard}
        >
          <LayerSurface
            data-presentation="deliveries-day-controls"
            sectionKey="parts-deliveries-controls"
            parentKey="parts-deliveries-header"
            sectionType="toolbar"
            data-dev-text-preview="Day picker controls"
            padding="var(--space-3)"
            gap="var(--space-sm)"
            radius="var(--radius-sm)"
            style={deliveryStyles.headerTopRow}
          >
            <div style={deliveryStyles.dayLabel}>
              <span style={deliveryText.label}>Delivery day</span>
              <strong style={deliveryText.valueStrong}>{formatIsoDate(selectedDate)}</strong>
            </div>

            {/* Day stepper removed — the month picker is now the only way to
                change day, so the row layout lives in the shared class. */}
            <div className="app-delivery-day-controls">
              <CalendarField
                className="app-delivery-month-picker"
                name="selectedDate"
                value={selectedDate}
                onValueChange={(value) => changeDate(value)}
              />
            </div>

            {/* Today jumps the diary to the current day; Week opens the
                Mon–Sun strip below. The route map is no longer a view you
                switch to — it lives permanently in the detail panel — so
                these two are the only mode controls left. */}
            <div style={deliveryStyles.viewControls}>
              <Button variant="primary" onClick={() => changeDate(todayIso())}>
                Today
              </Button>
              <Button
                variant="secondary"
                aria-pressed={weekOpen}
                onClick={toggleWeek}
              >
                Week
              </Button>
            </div>
          </LayerSurface>

          {/* Summary strip — the shared .app-summary-* family, so it reads the
              same as the stock and jobs summaries. Each tile filters the list. */}
          <LayerSurface
            sectionKey="parts-deliveries-summary"
            parentKey="parts-deliveries-header"
            sectionType="stat-card"
            data-dev-text-preview="Delivery day totals"
            padding="var(--space-3)"
            gap="var(--space-sm)"
            radius="var(--radius-sm)"
          >
            {/* A group, not a list: each tile is a status filter toggle, so it
                carries aria-pressed rather than list semantics. */}
            <div
              className="app-summary-grid"
              role="group"
              aria-label="Delivery day summary and status filters"
              style={{
                // .app-summary-grid carries `flex: 1 1 320px` for use inside a
                // row. Its parent here is a LayerSurface, which is a flex
                // COLUMN, so that basis would reserve 320px of height. The grid
                // is sized by its own rows instead.
                flex: "0 0 auto",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              }}
            >
              {summaryTiles.map((tile) => {
                const active = statusFilter === tile.key;
                return (
                  <LayerTheme
                    key={tile.key}
                    as="button"
                    type="button"
                    className="app-summary-item"
                    padding="8px 10px"
                    radius="var(--radius-sm)"
                    gap="2px var(--space-sm)"
                    aria-pressed={active}
                    aria-label={`${tile.label} deliveries — filter the route`}
                    onClick={() => setStatusFilter(active ? "all" : tile.key)}
                    style={{
                      flexDirection: "row",
                      cursor: "pointer",
                      outline: active ? "2px solid var(--accent-strong)" : "none",
                      outlineOffset: "2px",
                    }}
                  >
                    <span className="app-summary-label">{tile.label}</span>
                    <strong className="app-summary-value">
                      {loading ? "…" : summary?.counts?.[tile.key] ?? 0}
                    </strong>
                  </LayerTheme>
                );
              })}
              <LayerTheme
                className="app-summary-item"
                padding="8px 10px"
                radius="var(--radius-sm)"
                gap="2px var(--space-sm)"
                style={{ flexDirection: "row" }}
              >
                <span className="app-summary-label">Value</span>
                <strong className="app-summary-value">
                  {loading ? "…" : formatCurrency(summary?.totalValue)}
                </strong>
              </LayerTheme>
            </div>
            {!loading && summary?.unpaidValue > 0 ? (
              <div className="app-status-message app-status-message--warning">
                {formatCurrency(summary.unpaidValue)} of today&apos;s deliveries is unpaid — the
                driver needs to collect payment on those stops.
              </div>
            ) : null}
          </LayerSurface>

          {/* Filters */}
          <LayerSurface
            sectionKey="parts-deliveries-filters"
            parentKey="parts-deliveries-header"
            sectionType="toolbar"
            data-dev-text-preview="Delivery filters"
            padding="var(--space-3)"
            gap="var(--space-sm)"
            radius="var(--radius-sm)"
          >
            <div style={isMobile ? deliveryStyles.filterRowMobile : deliveryStyles.filterRow}>
              <SearchBar
                ariaLabel="Search deliveries"
                onChange={(event) => setSearchTerm(event.target.value)}
                onClear={() => setSearchTerm("")}
                placeholder="Customer, invoice, job, postcode, part…"
                value={searchTerm}
              />
              <DropdownField
                name="statusFilter"
                options={statusOptions}
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value)}
                aria-label="Filter by status"
              />
              <DropdownField
                name="driverFilter"
                options={driverOptions}
                value={driverFilter}
                onValueChange={(value) => setDriverFilter(value)}
                aria-label="Filter by driver"
              />
              <DropdownField
                name="vehicleFilter"
                options={vehicleOptions}
                value={vehicleFilter}
                onValueChange={(value) => setVehicleFilter(value)}
                aria-label="Filter by delivery vehicle"
              />
              <Button variant="ghost" onClick={clearFilters} disabled={!filtersActive}>
                Clear
              </Button>
            </div>
          </LayerSurface>
        </LayerTheme>

        {/* ---------------------------------------------------------------- */}
        {/* Body: the route, with the detail panel (and its map) alongside    */}
        {/* ---------------------------------------------------------------- */}
        {weekOpen ? (
          <DeliveryWeekPanel onSelectDate={changeDate} selectedDate={selectedDate} week={week} />
        ) : null}

        <div style={isMobile ? deliveryStyles.workspaceStacked : deliveryStyles.workspace}>
          {routeList}
          {detailPanel}
        </div>
      </div>

      {proofTarget ? (
        <DeliveryProofModal
          delivery={proofTarget}
          error={modalError}
          onCancel={onCloseProof}
          onConfirm={confirmProof}
          saving={modalSaving}
        />
      ) : null}

      {failureTarget ? (
        <DeliveryFailureModal
          delivery={failureTarget}
          error={modalError}
          onCancel={onCloseFailure}
          onConfirm={confirmFailure}
          saving={modalSaving}
        />
      ) : null}
    </>
  );
}
