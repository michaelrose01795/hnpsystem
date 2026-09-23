// file location: src/components/page-ui/tracking/tracking-ui.js
//
// The shared header row (search, filters, page actions) and body slot of the
// four tracker pages: /tracking/Key-Parking, /tracking/Loan-car,
// /tracking/Equipment-Tools and /tracking/Oil-Stock. `activeTab` names the page
// ("tracker" | "loan-cars" | "equipment" | "oil-stock"). There is no tab strip —
// each page is reached from its own sidebar button. The location modals and the
// route skeleton belong to Key/Parking and are only rendered when supplied.

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
    equipmentTypeFilter,
    equipmentTypeFilters,
    error,
    handleLocationSelect,
    handleSave,
    isMobileView,
    loading,
    loanCarCapabilities,
    loanCarMonthPicker,
    requestLoanCarView,
    onStockCommand,
    openEntryModal,
    renderActiveTabContent,
    searchModal,
    onAddEquipment,
    setEquipmentTypeFilter,
    stockCapabilities,
    stockFilterSlotRef,
    setSimplifiedModal,
    setSharedSearchValue,
    setTrackerLocationFilter,
    simplifiedModal,
    sharedSearchPlaceholder,
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

  const shouldStackHeaderControls = isMobileView;
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
        flexDirection: shouldStackHeaderControls ? "column" : "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        flexWrap: shouldStackHeaderControls ? "wrap" : "nowrap",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: shouldStackHeaderControls ? "visible" : "auto",
        overflowY: "visible",
        scrollbarWidth: "thin"
      }}>
              <DevLayoutSection sectionKey="tracking-page-shared-search" parentKey="tracking-page-body" sectionType="toolbar" style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: shouldStackHeaderControls ? "wrap" : "nowrap",
          alignItems: "center",
          flex: shouldStackHeaderControls ? "1 1 100%" : "1 1 auto",
          minWidth: 0,
          maxWidth: "100%",
          // Leads the row now that there is no tab strip before it.
          justifyContent: shouldStackHeaderControls ? "stretch" : "flex-start"
        }}>
                  <SearchBar
            value={sharedSearchValue}
            onChange={(event) => setSharedSearchValue(event.target.value)}
            onClear={() => setSharedSearchValue("")}
            placeholder={sharedSearchPlaceholder}
            ariaLabel={sharedSearchPlaceholder}
            style={{
              flex: shouldStackHeaderControls ? "1 1 100%" : compactSearchTabs ? "1 1 clamp(180px, 26vw, 360px)" : "1 1 clamp(180px, 34vw, 520px)",
              minWidth: shouldStackHeaderControls ? "100%" : "160px",
              maxWidth: shouldStackHeaderControls ? "100%" : compactSearchTabs ? "360px" : "520px"
            }} />
                  {activeTab === "tracker" && DropdownField && (
                  <DropdownField
              value={trackerLocationFilter}
              onValueChange={setTrackerLocationFilter}
              options={trackerLocationFilters}
              ariaLabel="Filter tracker by location"
              placeholder="All locations"
              size="sm"
              style={{
                flex: shouldStackHeaderControls ? "1 1 100%" : "0 1 190px",
                minWidth: shouldStackHeaderControls ? "100%" : "160px",
                maxWidth: shouldStackHeaderControls ? "100%" : "210px"
              }} />
                  )}
                  {activeTab === "tracker" && DropdownField && (
                  <DropdownField
              value={trackerQuickFilter}
              onValueChange={setTrackerQuickFilter}
              options={trackerQuickFilters}
              ariaLabel="Filter tracker by status"
              placeholder="All"
              size="sm"
              style={{
                flex: shouldStackHeaderControls ? "1 1 100%" : "0 1 190px",
                minWidth: shouldStackHeaderControls ? "100%" : "160px",
                maxWidth: shouldStackHeaderControls ? "100%" : "210px"
              }} />
                  )}
                  {activeTab === "equipment" && DropdownField && (
                  <DropdownField
              value={equipmentTypeFilter}
              onValueChange={setEquipmentTypeFilter}
              options={equipmentTypeFilters}
              ariaLabel="Filter equipment by type"
              placeholder="All equipment"
              size="sm"
              style={{
                flex: shouldStackHeaderControls ? "1 1 100%" : "0 1 190px",
                minWidth: shouldStackHeaderControls ? "100%" : "160px",
                maxWidth: shouldStackHeaderControls ? "100%" : "210px"
              }} />
                  )}
                  {/* Oil/Stock portals its filter and sort dropdowns in here
                      (StockControlPanel `filterSlot`), keeping them on this row. */}
                  {activeTab === "oil-stock" && stockFilterSlotRef && <div ref={stockFilterSlotRef} className="stock-header-filters" />}
              </DevLayoutSection>
              <div style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: shouldStackHeaderControls ? "wrap" : "nowrap",
          alignItems: "center",
          justifyContent: shouldStackHeaderControls ? "stretch" : "flex-end",
          flex: shouldStackHeaderControls ? "1 1 100%" : "0 0 auto",
          marginLeft: shouldStackHeaderControls ? 0 : "auto",
          minWidth: shouldStackHeaderControls ? "100%" : "max-content",
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
                  <Button variant="secondary" size="sm" onClick={() => requestLoanCarView("quick")}>
                    Quick add
                  </Button>
                  )}
                  {activeTab === "loan-cars" && requestLoanCarView && loanCarCapabilities?.book && (
                  <Button variant="primary" size="sm" onClick={() => requestLoanCarView("new")}>
                    New loan booking
                  </Button>
                  )}
                  {activeTab === "equipment" && canManageEquipment && (
                  <Button variant="primary" size="sm" onClick={onAddEquipment}>
                    Add Equipment/tools
                  </Button>
                  )}
                  {/* Oil/Stock filters, sort and view live in the stock panel toolbar;
                      the header keeps the whole-tab actions. */}
                  {activeTab === "oil-stock" && onStockCommand && stockCapabilities?.stocktake && (
                  <Button variant="secondary" size="sm" symbol={false} onClick={() => onStockCommand("stocktake")}>
                    Stocktake
                  </Button>
                  )}
                  {activeTab === "oil-stock" && onStockCommand && stockCapabilities?.manage && (
                  <Button variant="primary" size="sm" symbol={false} onClick={() => onStockCommand("create")}>
                    Add stock item
                  </Button>
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
