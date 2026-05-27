// file location: src/components/page-ui/tracking/tracking-ui.js

export default function TrackingDashboardUi(props) {
  const {
    Button,
    CAR_LOCATIONS,
    DevLayoutSection,
    DropdownField,
    EquipmentToolsModal,
    InlineLoading,
    KEY_LOCATIONS,
    LocationEntryModal,
    LocationSearchModal,
    OilStockModal,
    SearchBar,
    SimplifiedTrackingModal,
    StatusMessage,
    TabGroup,
    TRACKING_FILTER_ALL,
    activeTab,
    closeEntryModal,
    closeSearchModal,
    entries,
    entryModal,
    equipmentLoading,
    equipmentModal,
    error,
    handleDeleteEquipment,
    handleDeleteOilStock,
    handleLocationSelect,
    handleSave,
    handleSaveEquipment,
    handleSaveOilStock,
    isMobileView,
    loadEntries,
    loading,
    oilLoading,
    oilStockModal,
    openEntryModal,
    renderActiveTabContent,
    searchModal,
    setActiveTab,
    setEquipmentModal,
    setOilStockModal,
    setSimplifiedModal,
    setTrackerSearchTerm,
    setTrackerStatusFilter,
    setTrackerVehicleLocationFilter,
    simplifiedModal,
    tabs,
    trackerSearchTerm,
    trackerStatusFilter,
    trackerStatusFilterOptions,
    trackerVehicleLocationFilter,
    trackerVehicleLocationFilterOptions,
    TrackingRouteSkeleton,
  } = props; // receive page logic props.

  // Show the inline tracker filters in the toolbar only when the tab group is
  // visible AND we're not on the narrow portrait-phone layout. When the tab
  // group is hidden or we're on a small screen, the filters render inside
  // renderTrackerContent (their original location) instead.
  const showInlineTrackerFilters =
    activeTab === "tracker" && !isMobileView && tabs.length > 1; // gate inline filter row.

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
          {tabs.length > 1 && <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        width: "100%"
      }}>
              <DevLayoutSection sectionKey="tracking-page-tabs" parentKey="tracking-page-body" sectionType="toolbar" style={{
          display: "inline-flex",
          width: "fit-content",
          maxWidth: "100%",
          background: "transparent",
          padding: 0
        }}>
                <TabGroup items={tabs.map(tab => ({
            label: tab.label,
            value: tab.id
          }))} value={activeTab} onChange={setActiveTab} ariaLabel="Tracker tabs" className="tab-api--inline" />
              </DevLayoutSection>
              {showInlineTrackerFilters && <div style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: "wrap",
          alignItems: "center",
          flex: "1 1 auto",
          minWidth: 0,
          justifyContent: "center"
        }}>
                  <SearchBar
            value={trackerSearchTerm}
            onChange={(event) => setTrackerSearchTerm(event.target.value)}
            onClear={() => setTrackerSearchTerm("")}
            placeholder="Search active jobs"
            ariaLabel="Search active jobs"
            style={{
              flex: "1 1 320px",
              minWidth: "220px"
            }} />

                  <DropdownField
            options={trackerStatusFilterOptions}
            value={trackerStatusFilter}
            onValueChange={(value) => setTrackerStatusFilter(value || TRACKING_FILTER_ALL)}
            size="md"
            style={{
              flex: "0 1 150px",
              minWidth: "130px"
            }} />

                  <DropdownField
            options={trackerVehicleLocationFilterOptions}
            value={trackerVehicleLocationFilter}
            onValueChange={(value) => setTrackerVehicleLocationFilter(value || TRACKING_FILTER_ALL)}
            size="md"
            style={{
              flex: "0 1 160px",
              minWidth: "140px"
            }} />

                </div>}
              {activeTab === "tracker" && <div style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: "wrap",
          alignItems: "center",
          marginLeft: "auto"
        }}>
                  <Button variant="secondary" size="sm" onClick={loadEntries}>
                    Refresh
                  </Button>
                  {loading && <InlineLoading width={100} label="Refreshing" />}
                  <Button variant="primary" size="sm" onClick={() => openEntryModal("car")}>
                    Add location
                  </Button>
                </div>}
              {activeTab === "equipment" && <div style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: "wrap",
          alignItems: "center",
          marginLeft: "auto"
        }}>
                  {equipmentLoading && <InlineLoading width={80} label="Loading" />}
                  <Button variant="primary" size="sm" onClick={() => setEquipmentModal({
            open: true,
            item: null
          })}>
                    Add Equipment/tools
                  </Button>
                </div>}
              {activeTab === "oil-stock" && <div style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: "wrap",
          alignItems: "center",
          marginLeft: "auto"
        }}>
                  {oilLoading && <InlineLoading width={80} label="Loading" />}
                  <Button variant="primary" size="sm" onClick={() => setOilStockModal({
            open: true,
            item: null
          })}>
                    Add Oil / Stock
                  </Button>
                </div>}
            </div>}
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

      {oilStockModal.open && <OilStockModal initialData={oilStockModal.item} onClose={() => setOilStockModal({
    open: false,
    item: null
  })} onSave={handleSaveOilStock} onDelete={handleDeleteOilStock} />}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
