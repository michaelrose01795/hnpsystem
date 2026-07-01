// file location: src/components/page-ui/tracking/tracking-ui.js

export default function TrackingDashboardUi(props) {
  const {
    Button,
    CAR_LOCATIONS,
    DevLayoutSection,
    DropdownField,
    EquipmentToolsModal,
    EquipmentHistoryModal,
    InlineLoading,
    KEY_LOCATIONS,
    LocationEntryModal,
    LocationSearchModal,
    OilStockModal,
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
    loadActiveTab,
    loading,
    loanCarFleetManagerOpen,
    loanCarMonth,
    setLoanCarMonth,
    MonthPickerField,
    refreshLoading,
    oilStockModal,
    openEntryModal,
    renderActiveTabContent,
    searchModal,
    setActiveTab,
    setEquipmentModal,
    setEquipmentHistoryModal,
    setEquipmentTypeFilter,
    setLoanCarFleetManagerOpen,
    setOilStockModal,
    setSimplifiedModal,
    setSharedSearchValue,
    setTrackerLocationFilter,
    simplifiedModal,
    sharedSearchPlaceholder,
    sharedSearchValue,
    tabs,
    trackerLastUpdatedLabel,
    trackerLocationFilter,
    trackerLocationFilters,
    TrackingRouteSkeleton,
  } = props; // receive page logic props.

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
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        width: "100%"
      }}>
              {tabs.length > 1 && (
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
          }))} value={activeTab} onChange={setActiveTab} ariaLabel="Tracker tabs" className="tab-api--wrap" />
              </DevLayoutSection>
              )}
              <DevLayoutSection sectionKey="tracking-page-shared-search" parentKey="tracking-page-body" sectionType="toolbar" style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: "wrap",
          alignItems: "center",
          flex: "1 1 auto",
          minWidth: 0,
          justifyContent: "center"
        }}>
                  <SearchBar
            value={sharedSearchValue}
            onChange={(event) => setSharedSearchValue(event.target.value)}
            onClear={() => setSharedSearchValue("")}
            placeholder={sharedSearchPlaceholder}
            ariaLabel={sharedSearchPlaceholder}
            style={{
              flex: activeTab === "tracker" ? "0 1 clamp(180px, 32vw, 420px)" : "1 1 clamp(180px, 48vw, 720px)",
              minWidth: isMobileView ? "100%" : "180px",
              maxWidth: activeTab === "tracker" ? "420px" : "720px"
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
                flex: "0 1 220px",
                minWidth: isMobileView ? "100%" : "180px",
                maxWidth: isMobileView ? "100%" : "240px"
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
                flex: "0 1 220px",
                minWidth: isMobileView ? "100%" : "180px",
                maxWidth: isMobileView ? "100%" : "240px"
              }} />
                  )}
                  {activeTab === "loan-cars" && MonthPickerField && (
                  <MonthPickerField
              value={loanCarMonth}
              onValueChange={(nextValue) => setLoanCarMonth(nextValue)}
              aria-label={`Select loan car month, currently ${loanCarMonth}`} />
                  )}
              </DevLayoutSection>
              <div style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: "wrap",
          alignItems: "center",
          marginLeft: "auto"
        }}>
                  <Button variant="secondary" size="sm" onClick={loadActiveTab}>
                    Refresh
                  </Button>
                  {activeTab === "tracker" && (
                  <span style={{
            color: "var(--text-1)",
            fontSize: "var(--text-caption)",
            fontWeight: 700,
            whiteSpace: "nowrap"
          }}>
                    Last Updated {trackerLastUpdatedLabel}
                  </span>
                  )}
                  {refreshLoading && <InlineLoading width={100} label="Refreshing" />}
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
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
