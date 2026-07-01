// file location: src/components/page-ui/tracking/tracking-ui.js

export default function TrackingDashboardUi(props) {
  const {
    Button,
    CAR_LOCATIONS,
    DevLayoutSection,
    DropdownField,
    EquipmentToolsModal,
    EquipmentHistoryModal,
    KEY_LOCATIONS,
    LocationEntryModal,
    LocationSearchModal,
    OilStockModal,
    OilStockHistoryModal,
    SearchBar,
    SimplifiedTrackingModal,
    StatusMessage,
    TabGroup,
    activeTab,
    closeEntryModal,
    closeSearchModal,
    entries,
    entryModal,
    equipmentModal,
    equipmentHistoryModal,
    equipmentTypeFilter,
    equipmentTypeFilters,
    error,
    handleDeleteEquipment,
    handleDeleteOilStock,
    handleLocationSelect,
    handleSave,
    handleSaveEquipment,
    handleSaveOilStock,
    isMobileView,
    loading,
    loanCarFleetManagerOpen,
    loanCarMonth,
    setLoanCarMonth,
    MonthPickerField,
    oilCategoryFilter,
    oilCategoryFilters,
    oilStockModal,
    oilStockHistoryModal,
    openEntryModal,
    renderActiveTabContent,
    searchModal,
    setActiveTab,
    setEquipmentModal,
    setEquipmentHistoryModal,
    setEquipmentTypeFilter,
    setLoanCarFleetManagerOpen,
    setOilCategoryFilter,
    setOilStockModal,
    setOilStockHistoryModal,
    setSimplifiedModal,
    setSharedSearchValue,
    setTrackerLocationFilter,
    simplifiedModal,
    sharedSearchPlaceholder,
    sharedSearchValue,
    tabs,
    trackerLocationFilter,
    trackerLocationFilters,
    trackerQuickFilter,
    trackerQuickFilters,
    setTrackerQuickFilter,
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
              {tabs.length > 1 && (
              <DevLayoutSection sectionKey="tracking-page-tabs" parentKey="tracking-page-body" sectionType="toolbar" style={{
          display: "inline-flex",
          flex: shouldStackHeaderControls ? "1 1 100%" : "0 0 auto",
          width: shouldStackHeaderControls ? "100%" : "fit-content",
          maxWidth: "100%",
          minWidth: 0,
          background: "transparent",
          padding: 0
        }}>
                <TabGroup items={tabs.map(tab => ({
            label: tab.label,
            value: tab.id
          }))} value={activeTab} onChange={setActiveTab} ariaLabel="Tracker tabs" className="tab-api--wrap" />
              </DevLayoutSection>
              )}
              <DevLayoutSection sectionKey="tracking-page-shared-search" parentKey="tracking-page-body" sectionType="toolbar" style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: shouldStackHeaderControls ? "wrap" : "nowrap",
          alignItems: "center",
          flex: shouldStackHeaderControls ? "1 1 100%" : "1 1 auto",
          minWidth: 0,
          maxWidth: "100%",
          justifyContent: shouldStackHeaderControls ? "stretch" : "center"
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
                  {activeTab === "oil-stock" && DropdownField && (
                  <DropdownField
              value={oilCategoryFilter}
              onValueChange={setOilCategoryFilter}
              options={oilCategoryFilters}
              ariaLabel="Filter oil and stock by category"
              placeholder="All categories"
              size="sm"
              style={{
                flex: shouldStackHeaderControls ? "1 1 100%" : "0 1 190px",
                minWidth: shouldStackHeaderControls ? "100%" : "160px",
                maxWidth: shouldStackHeaderControls ? "100%" : "210px"
              }} />
                  )}
                  {activeTab === "loan-cars" && MonthPickerField && (
                  <div style={{
              flex: shouldStackHeaderControls ? "1 1 100%" : "0 0 auto",
              minWidth: shouldStackHeaderControls ? "100%" : "max-content"
            }}>
                  <MonthPickerField
              value={loanCarMonth}
              onValueChange={(nextValue) => setLoanCarMonth(nextValue)}
              aria-label={`Select loan car month, currently ${loanCarMonth}`} />
                  </div>
                  )}
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
                  {activeTab === "tracker" && (
                  <Button variant="primary" size="sm" onClick={() => openEntryModal("car")}>
                    Add location
                  </Button>
                  )}
                  {activeTab === "loan-cars" && (
                  <Button variant="primary" size="sm" onClick={() => setLoanCarFleetManagerOpen(!loanCarFleetManagerOpen)}>
                    {loanCarFleetManagerOpen ? "Hide loan car" : "Add loan car"}
                  </Button>
                  )}
                  {activeTab === "equipment" && (
                  <Button variant="primary" size="sm" onClick={() => setEquipmentModal({
            open: true,
            item: null
          })}>
                    Add Equipment/tools
                  </Button>
                  )}
                  {activeTab === "oil-stock" && (
                  <Button variant="primary" size="sm" onClick={() => setOilStockModal({
            open: true,
            item: null
          })}>
                    Add Oil / Stock
                  </Button>
                  )}
                </div>
            </div>
          {error && <DevLayoutSection sectionKey="tracking-page-error" parentKey="tracking-page-body" sectionType="banner">
              <StatusMessage tone="danger">{error}</StatusMessage>
            </DevLayoutSection>}
          {loading && entries.length === 0 && TrackingRouteSkeleton ? <TrackingRouteSkeleton /> : renderActiveTabContent()}
        </DevLayoutSection>
      </DevLayoutSection>

      {searchModal.open && <LocationSearchModal type={searchModal.type} options={searchModal.type === "car" ? CAR_LOCATIONS : KEY_LOCATIONS} onClose={closeSearchModal} onSelect={handleLocationSelect} />}

      {entryModal.open && <LocationEntryModal context={entryModal.type} entry={entryModal.entry} onClose={closeEntryModal} onSave={handleSave} existingEntries={entries} />}

      {simplifiedModal.open && <SimplifiedTrackingModal initialData={simplifiedModal.initialData} onClose={() => setSimplifiedModal({
    open: false,
    initialData: null
  })} onSave={handleSave} />}

      {equipmentModal.open && <EquipmentToolsModal initialData={equipmentModal.item} onClose={() => setEquipmentModal({
    open: false,
    item: null
  })} onSave={handleSaveEquipment} onDelete={handleDeleteEquipment} />}

      {equipmentHistoryModal?.open && EquipmentHistoryModal && <EquipmentHistoryModal item={equipmentHistoryModal.item} onClose={() => setEquipmentHistoryModal({
    open: false,
    item: null
  })} />}

      {oilStockModal.open && <OilStockModal initialData={oilStockModal.item} onClose={() => setOilStockModal({
    open: false,
    item: null
  })} onSave={handleSaveOilStock} onDelete={handleDeleteOilStock} />}

      {oilStockHistoryModal?.open && OilStockHistoryModal && <OilStockHistoryModal item={oilStockHistoryModal.item} onClose={() => setOilStockHistoryModal({
    open: false,
    item: null
  })} />}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
