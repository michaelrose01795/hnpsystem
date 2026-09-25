// file location: src/components/page-ui/tracking/tracking-ui.js
//
// The shared header row (search, filters, page actions) and body slot of the
// four tracker pages: /tracking/Key-Parking, /tracking/Loan-car,
// /tracking/Equipment-Tools and /tracking/Oil-Stock. `activeTab` names the page
// ("tracker" | "loan-cars" | "equipment" | "oil-stock"). There is no tab strip —
// each page is reached from its own sidebar button. The location modals and the
// route skeleton belong to Key/Parking and are only rendered when supplied.

import { FilterButton, FilterField } from "@/components/ui/filterAPI";
import SymbolButton from "@/components/ui/SymbolButton";

export default function TrackingDashboardUi(props) {
  const {
    Button,
    CAR_LOCATIONS,
    DevLayoutSection,
    DropdownField,
    KEY_LOCATIONS,
    LocationEntryModal,
    LocationSearchModal,
    SearchBar,
    SimplifiedTrackingModal,
    StatusMessage,
    activeTab,
    closeEntryModal,
    closeSearchModal,
    entries,
    entryModal,
    canManageEquipment,
    equipmentFilterSlotRef,
    equipmentViewSlotRef,


    error,
    handleLocationSelect,
    handleSave,
    isMobileView,
    loading,
    loanCarCapabilities,
    loanCarFilterSlotRef,
    loanCarMonthPicker,
    requestLoanCarView,
    onStockCommand,
    openEntryModal,
    renderActiveTabContent,
    searchModal,
    onAddEquipment,

    stockCapabilities,
    stockFilterSlotRef,
    setSimplifiedModal,
    setSharedSearchValue,
    setTrackerLocationFilter,
    simplifiedModal,
    sharedSearchControls,
    sharedSearchPlaceholder,
    sharedSearchResultsSlotRef,
    sharedSearchValue,
    trackerLocationFilter,
    trackerLocationFilters,
    trackerQuickFilter,
    trackerQuickFilters,
    setTrackerQuickFilter,
    trackerView,
    setTrackerView,
    TrackingRouteSkeleton,
  } = props; // receive page logic props.

  // Phones no longer stack the header into full-width rows: the search folds
  // to an icon there, so search, filter and page actions share one line and
  // only wrap when they genuinely do not fit.
  const wrapHeaderControls = isMobileView;
  const compactSearchTabs = activeTab === "tracker" || activeTab === "equipment" || activeTab === "oil-stock";

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <DevLayoutSection sectionKey="tracking-page" parentKey="app-layout-page-card" sectionType="section-shell" backgroundToken="surface" className="app-page-stack" style={{
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    padding: "8px 0"
  }}>
        <DevLayoutSection sectionKey="tracking-page-body" parentKey="tracking-page" sectionType="section-shell" style={{
      display: "flex",
      flexDirection: "column",
      gap: isMobileView ? "16px" : "18px",
      width: "100%",
      maxWidth: "100%",
      minWidth: 0
    }}>
          <div style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        flexWrap: wrapHeaderControls ? "wrap" : "nowrap",
        // Phone: anchors the Map view's find results to the whole row (see
        // .tracking-shared-find in trackingMap.css).
        position: wrapHeaderControls ? "relative" : undefined,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: wrapHeaderControls ? "visible" : "auto",
        overflowY: "visible",
        scrollbarWidth: "thin"
      }}>
              <DevLayoutSection sectionKey="tracking-page-shared-search" parentKey="tracking-page-body" sectionType="toolbar" style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: wrapHeaderControls ? "wrap" : "nowrap",
          alignItems: "center",
          flex: "1 1 auto",
          minWidth: 0,
          maxWidth: "100%",
          // Leads the row now that there is no tab strip before it.
          justifyContent: "flex-start"
        }}>
                  {sharedSearchResultsSlotRef ? (
                  // Key/Parking: the one search on the page. The Map view portals
                  // its "find a vehicle" results into the slot below, so they
                  // drop down under this bar (TrackingSiteMap `findResultsSlot`).
                  <div className="tracking-shared-find" style={{
              // Phone: the search is a single icon button, so the wrapper
              // hugs it instead of claiming the whole row.
              flex: wrapHeaderControls ? "0 0 auto" : compactSearchTabs ? "1 1 clamp(180px, 26vw, 360px)" : "1 1 clamp(180px, 34vw, 520px)",
              minWidth: wrapHeaderControls ? 0 : "160px"
            }}>
                    <SearchBar
              value={sharedSearchValue}
              onChange={(event) => setSharedSearchValue(event.target.value)}
              onClear={() => setSharedSearchValue("")}
              placeholder={sharedSearchPlaceholder}
              ariaLabel={sharedSearchPlaceholder}
              aria-controls={sharedSearchControls || undefined}
              style={{ width: "100%" }} />
                    <div ref={sharedSearchResultsSlotRef} />
                  </div>
                  ) : (
                  <SearchBar
            value={sharedSearchValue}
            onChange={(event) => setSharedSearchValue(event.target.value)}
            onClear={() => setSharedSearchValue("")}
            placeholder={sharedSearchPlaceholder}
            ariaLabel={sharedSearchPlaceholder}
            style={{
              flex: wrapHeaderControls ? "0 0 auto" : compactSearchTabs ? "1 1 clamp(180px, 26vw, 360px)" : "1 1 clamp(180px, 34vw, 520px)",
              minWidth: wrapHeaderControls ? 0 : "160px"
            }} />
                  )}
                  {activeTab === "tracker" && DropdownField && (
                  <FilterButton
              activeCount={(trackerLocationFilter !== "all" ? 1 : 0) + (trackerQuickFilter !== "all" ? 1 : 0)}
              onClear={() => {
                setTrackerLocationFilter("all");
                setTrackerQuickFilter("all");
              }}>
                    <FilterField label="Location" htmlFor="tracking-filter-location">
                      <DropdownField
                  id="tracking-filter-location"
                  value={trackerLocationFilter}
                  onValueChange={setTrackerLocationFilter}
                  options={trackerLocationFilters}
                  ariaLabel="Filter tracker by location"
                  placeholder="All locations" />
                    </FilterField>
                    <FilterField label="Status" htmlFor="tracking-filter-status">
                      <DropdownField
                  id="tracking-filter-status"
                  value={trackerQuickFilter}
                  onValueChange={setTrackerQuickFilter}
                  options={trackerQuickFilters}
                  ariaLabel="Filter tracker by status"
                  placeholder="All" />
                    </FilterField>
                  </FilterButton>
                  )}
                  {/* Oil/Stock portals its filter and Categories & Locations buttons in here
                      (StockControlPanel `filterSlot`), keeping it on this row. */}
                  {activeTab === "oil-stock" && stockFilterSlotRef && <div ref={stockFilterSlotRef} className="stock-header-filters" />}
                  {/* Loan cars (larger screens) portals its Available / Out /
                      Due today / Overdue filters in here, beside the search. */}
                  {activeTab === "loan-cars" && loanCarFilterSlotRef && <div ref={loanCarFilterSlotRef} style={{ display: "flex", flex: "0 0 auto" }} />}
              </DevLayoutSection>
              <div style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: wrapHeaderControls ? "wrap" : "nowrap",
          alignItems: "center",
          justifyContent: "flex-end",
          flex: wrapHeaderControls ? "0 1 auto" : "0 0 auto",
          marginLeft: "auto",
          minWidth: wrapHeaderControls ? 0 : "max-content",
          whiteSpace: "nowrap"
        }}>
                  {activeTab === "tracker" && setTrackerView && (
                  <div className="tracking-viewswitch" role="group" aria-label="Tracking view">
                    <Button
              variant={trackerView === "grid" ? "primary" : "secondary"}
              size="sm"
              aria-pressed={trackerView === "grid"}
              onClick={() => setTrackerView("grid")}>
                      Grid
                    </Button>
                    <Button
              variant={trackerView === "map" ? "primary" : "secondary"}
              size="sm"
              aria-pressed={trackerView === "map"}
              onClick={() => setTrackerView("map")}>
                      Map
                    </Button>
                  </div>
                  )}
                  {activeTab === "tracker" && (
                  <Button variant="primary" size="sm" onClick={() => openEntryModal("car")}>
                    Add location
                  </Button>
                  )}
                  {activeTab === "loan-cars" && loanCarMonthPicker}
                  {activeTab === "loan-cars" && requestLoanCarView && loanCarCapabilities?.manageFleet && (
                  <Button variant="secondary" size="sm" onClick={() => requestLoanCarView("fleet")}>
                    Manage fleet
                  </Button>
                  )}
                  {activeTab === "loan-cars" && requestLoanCarView && loanCarCapabilities?.book && (
                  <Button variant="primary" size="sm" symbol="add" onClick={() => requestLoanCarView("new")}>
                    New loan booking
                  </Button>
                  )}
                  {/* Equipment portals its view controls (Bulk check,
                      Checklists) and filter button in here, ahead of the Add
                      button. */}
                  {activeTab === "equipment" && equipmentViewSlotRef && <div ref={equipmentViewSlotRef} style={{ display: "flex", flex: "0 0 auto" }} />}
                  {activeTab === "equipment" && equipmentFilterSlotRef && <div ref={equipmentFilterSlotRef} style={{ display: "flex", flex: "0 0 auto" }} />}
                  {activeTab === "equipment" && canManageEquipment && (
                  <Button variant="primary" size="sm" onClick={onAddEquipment}>
                    Add Equipment/tools
                  </Button>
                  )}
                  {/* Oil/Stock filters, sort and settings sit beside the search;
                      the header keeps the whole-tab actions. */}
                  {activeTab === "oil-stock" && onStockCommand && stockCapabilities?.stocktake && (
                  <Button variant="secondary" size="sm" symbol={false} onClick={() => onStockCommand("stocktake")}>
                    Stocktake
                  </Button>
                  )}
                  {activeTab === "oil-stock" && onStockCommand && stockCapabilities?.manage && (
                  <SymbolButton symbol="add" label="Add stock item" onClick={() => onStockCommand("create")} />
                  )}
                </div>
            </div>
          {error && <DevLayoutSection sectionKey="tracking-page-error" parentKey="tracking-page-body" sectionType="banner">
              <StatusMessage tone="danger">{error}</StatusMessage>
            </DevLayoutSection>}
          {/* The skeleton waits on the Key/Parking snapshot only; the other
              pages' panels load their own data behind their own skeletons. */}
          {activeTab === "tracker" && loading && entries?.length === 0 && TrackingRouteSkeleton ? <TrackingRouteSkeleton /> : renderActiveTabContent()}
        </DevLayoutSection>
      </DevLayoutSection>

      {searchModal?.open && LocationSearchModal && <LocationSearchModal type={searchModal.type} options={searchModal.type === "car" ? CAR_LOCATIONS : KEY_LOCATIONS} onClose={closeSearchModal} onSelect={handleLocationSelect} />}

      {entryModal?.open && LocationEntryModal && <LocationEntryModal context={entryModal.type} entry={entryModal.entry} onClose={closeEntryModal} onSave={handleSave} existingEntries={entries} />}

      {simplifiedModal?.open && SimplifiedTrackingModal && <SimplifiedTrackingModal initialData={simplifiedModal.initialData} onClose={() => setSimplifiedModal({
    open: false,
    initialData: null
  })} onSave={handleSave} />}


    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
