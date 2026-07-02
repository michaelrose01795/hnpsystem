// file location: src/pages/dev/staff-ui-showcase.js
// Reusable staff UI showcase for canonical HNPSystem interface primitives.
import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import {
  Button,
  InputField,
  LayerSurface,
  LayerTheme,
  StaffAlert,
  StaffDrawer,
  StaffEmptyState,
  StaffFilterBar,
  StaffJobSummaryPanel,
  StaffModal,
  StaffPageHeader,
  StaffPagination,
  StaffPartsRequestRow,
  StaffVhcItemRow,
} from "@/components/ui";
import { DropdownField, MultiSelectDropdown } from "@/components/ui/dropdownAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { SkeletonBlock, InlineLoading } from "@/components/ui/LoadingSkeleton";

const technicians = [
  { value: "tech-amy", label: "Amy Ward", description: "Mitsubishi master technician" },
  { value: "tech-ben", label: "Ben Carter", description: "Suzuki service technician" },
  { value: "tech-sam", label: "Sam Patel", description: "VHC and diagnostics" },
];

const customers = [
  { value: "cust-hughes", label: "Olivia Hughes", description: "HN24 ABC / ASX 2.0" },
  { value: "cust-evans", label: "Mark Evans", description: "HN19 DMS / Vitara" },
  { value: "cust-fleet", label: "Parks Fleet Account", description: "12 active vehicles" },
];

const departments = ["Workshop", "Parts", "Service reception", "Warranty", "Sales", "Accounts"];

const auditRows = [
  ["Tabs", "Supported", "TabGroup and StaffTabs use the tab-api/app-btn family; some older tab rows still duplicate local tab CSS."],
  ["Cards / panels", "Supported", "LayerSurface, LayerTheme, Section and Card provide global borderless surfaces; duplicated page cards remain in legacy files."],
  ["Tables", "Supported", "app-data-table centralises row height, sticky headers and row separators via --separating-line."],
  ["Forms", "Mostly supported", "Inputs/selects/textareas receive global staff-scope styles; labels/layout are still assembled page-by-page."],
  ["Dropdowns", "Supported", "DropdownField and MultiSelectDropdown now keep trigger and opened menu styling attached to staff/customer global CSS."],
  ["Search / filters", "Supported", "StaffFilterBar gives filters a reusable themed toolbar instead of page-local rows."],
  ["Date / time pickers", "Supported", "CalendarField, MonthPickerField and TimePickerField share control tokens and dimensions."],
  ["Modals / drawers", "Supported", "StaffModal and StaffDrawer provide shared overlay, body-lock portal, panel, header, body and footer chrome."],
  ["Status chips", "Supported", "app-badge tone modifiers cover common states; some feature-specific chip classes still exist."],
  ["Alerts", "Supported", "StaffAlert provides richer inline feedback while StatusMessage remains the simple message primitive."],
  ["Empty / loading states", "Supported", "StaffEmptyState and LoadingSkeleton cover the common empty/loading page states."],
  ["Pagination", "Supported", "StaffPagination standardises previous/page/next controls with app-btn sizing."],
  ["DMS domain rows", "Supported", "StaffVhcItemRow, StaffPartsRequestRow and StaffJobSummaryPanel cover common dealership row/panel composition."],
];

const remainingPatterns = [
  ["Page-specific modal shells", "Examples remain in VHC, tracking, workshop consumables and some invoice/account flows. They were not migrated because this task must not change live feature behaviour."],
  ["Duplicated card/panel composition", "Legacy page-ui files still build local card sections with inline layout and feature-specific classes."],
  ["Native/default browser controls", "Raw select usage remains in older pages and will still use browser menu limitations outside the custom dropdown API."],
  ["Third-party or detached styling risk", "Any component that portals without app-scope classes can still detach from staff/customer CSS; Dropdown API is now covered."],
  ["Non-global filter rows", "Some feature pages still assemble search/filter/action toolbars manually instead of using StaffFilterBar."],
  ["Domain row duplication", "Live VHC, parts and job-card pages still have page-specific rows until they opt into the new primitives."],
];

const partsRequests = [
  { part: "Front brake pads", quantity: 1, status: "Awaiting authorisation", tone: "warning", owner: "Parts" },
  { part: "Oil filter", quantity: 2, status: "Picked", tone: "success", owner: "Workshop" },
  { part: "Rear wiper blade", quantity: 1, status: "Back order", tone: "danger", owner: "Supplier" },
];

const vhcRows = [
  { area: "Tyres", result: "Amber", note: "Front nearside 3.2mm", tone: "warning", meta: "Customer approval required" },
  { area: "Brakes", result: "Red", note: "Rear pads below limit", tone: "danger", meta: "Do not release without review" },
  { area: "Lights", result: "Green", note: "All lamps operating", tone: "success", meta: "No action needed" },
];

function AuditBadge({ children, tone = "neutral" }) {
  return <span className={`app-badge app-badge--control app-badge--${tone}`}>{children}</span>;
}

function Grid({ children, min = "240px" }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))`, gap: "var(--layout-card-gap)" }}>
      {children}
    </div>
  );
}

export default function StaffUiShowcasePage() {
  const [activeTab, setActiveTab] = useState("workshop");
  const [search, setSearch] = useState("HN24");
  const [status, setStatus] = useState("open");
  const [selectedDepartments, setSelectedDepartments] = useState(["Workshop", "Parts"]);
  const [selectedTechnician, setSelectedTechnician] = useState("tech-amy");
  const [selectedCustomer, setSelectedCustomer] = useState("cust-hughes");
  const [bookingDate, setBookingDate] = useState("2026-07-01");
  const [bookingTime, setBookingTime] = useState("08:30");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const supportedCount = useMemo(() => auditRows.filter((row) => row[1] === "Supported").length, []);

  return (
    <Layout>
      <main className="app-page-shell" style={{ padding: "8px 8px 32px" }}>
        <LayerSurface as="section" radius="var(--page-card-radius)" padding="var(--page-card-padding)">
          <div className="app-page-stack">
            <StaffPageHeader
              title="Staff UI showcase"
              subtitle="Reusable staff and customer UI primitives for DMS pages."
              actions={<Button type="button" variant="secondary" onClick={() => setShowDrawer(true)}>Open drawer</Button>}
            />

            <LayerTheme>
              <Grid min="180px">
                <LayerSurface>
                  <strong>{supportedCount}</strong>
                  <span>Patterns supported by shared primitives</span>
                </LayerSurface>
                <LayerSurface>
                  <strong>{remainingPatterns.length}</strong>
                  <span>Remaining duplicated or page-specific patterns to migrate later</span>
                </LayerSurface>
                <LayerSurface>
                  <strong>0</strong>
                  <span>Live feature behaviour changes in this showcase pass</span>
                </LayerSurface>
              </Grid>
              <StaffAlert tone="info" title="Main card uses --theme">
                This first showcase panel intentionally uses the LayerTheme treatment so the reference starts from the tinted theme layer.
              </StaffAlert>
            </LayerTheme>

            <StaffFilterBar
              actions={<Button type="button" variant="ghost" onClick={() => setSearch("")}>Reset filters</Button>}
            >
              <SearchBar value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} placeholder="Search job, reg or customer" ariaLabel="Search showcase jobs" />
              <DropdownField label="Status filter" value={status} onChange={(event) => setStatus(event.target.value)} options={["open", "awaiting parts", "complete"]} />
              <MultiSelectDropdown label="Departments" value={selectedDepartments} onChange={setSelectedDepartments} options={departments} />
            </StaffFilterBar>

            <LayerTheme>
              <TabGroup
                ariaLabel="Staff showcase tabs"
                value={activeTab}
                onChange={setActiveTab}
                items={[{ value: "workshop", label: "Workshop" }, { value: "parts", label: "Parts" }, { value: "customer", label: "Customer" }]}
              />
              <Grid min="220px">
                <CalendarField label="Booking date" value={bookingDate} onChange={setBookingDate} />
                <TimePickerField label="Arrival time" value={bookingTime} onChange={setBookingTime} />
                <InputField label="Job number" value="JOB-10482" readOnly />
                <DropdownField label="Technician selector" value={selectedTechnician} onChange={(event) => setSelectedTechnician(event.target.value)} options={technicians} />
                <DropdownField label="Customer selector" value={selectedCustomer} onChange={(event) => setSelectedCustomer(event.target.value)} options={customers} />
              </Grid>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
                <Button type="button">Create job card</Button>
                <Button type="button" variant="secondary">Save draft</Button>
                <Button type="button" variant="ghost">More actions</Button>
                <Button type="button" variant="danger">Cancel booking</Button>
              </div>
            </LayerTheme>

            <Grid min="420px">
              <LayerTheme>
                <table className="app-data-table app-data-table--rounded">
                  <thead><tr><th>Pattern</th><th>Status</th><th>Finding</th></tr></thead>
                  <tbody>
                    {auditRows.map(([pattern, state, finding]) => (
                      <tr key={pattern}>
                        <td>{pattern}</td>
                        <td><AuditBadge tone={state === "Supported" ? "success" : state === "Missing" ? "danger" : "warning"}>{state}</AuditBadge></td>
                        <td>{finding}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <StaffPagination
                  page={page}
                  pageCount={3}
                  onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                  onNext={() => setPage((current) => Math.min(3, current + 1))}
                  onPageChange={setPage}
                />
              </LayerTheme>

              <LayerTheme>
                <StaffAlert tone="warning" title="Remaining non-global patterns">
                  These are audit findings only. No live feature pages were migrated in this pass.
                </StaffAlert>
                <table className="app-data-table app-data-table--rounded">
                  <thead><tr><th>Pattern</th><th>Report</th></tr></thead>
                  <tbody>
                    {remainingPatterns.map(([pattern, finding]) => (
                      <tr key={pattern}><td>{pattern}</td><td>{finding}</td></tr>
                    ))}
                  </tbody>
                </table>
              </LayerTheme>
            </Grid>

            <Grid min="300px">
              <LayerTheme>
                <strong>VHC item rows</strong>
                {vhcRows.map((row) => <StaffVhcItemRow key={row.area} {...row} />)}
              </LayerTheme>
              <LayerTheme>
                <strong>Parts request rows</strong>
                {partsRequests.map((row) => <StaffPartsRequestRow key={row.part} {...row} />)}
              </LayerTheme>
            </Grid>

            <StaffJobSummaryPanel
              title="JOB-10482 / HN24 ABC"
              subtitle="Olivia Hughes / ASX 2.0 / 18,420 miles"
              action={<Button type="button" size="sm" variant="secondary">Open job</Button>}
              meta={[
                { label: "Advisor", value: "Chris" },
                { label: "Technician", value: "Amy Ward" },
                { label: "Stage", value: "Awaiting authorisation" },
              ]}
              stats={[
                { label: "VHC total", value: "GBP 426" },
                { label: "Parts rows", value: "3" },
                { label: "ETA", value: "16:30" },
              ]}
            >
              <StaffAlert tone="warning" title="Warranty check pending">
                Confirm warranty coverage before customer authorisation.
              </StaffAlert>
            </StaffJobSummaryPanel>

            <LayerTheme>
              <Grid min="260px">
                <StaffEmptyState
                  title="No matching jobs"
                  description="The selected filters have no matching workshop jobs."
                  action={<Button type="button" variant="secondary" size="sm">Clear filters</Button>}
                />
                <LayerSurface>
                  <strong>Loading state</strong>
                  <SkeletonBlock height="18px" />
                  <SkeletonBlock width="75%" height="18px" />
                  <InlineLoading label="Loading matching jobs" />
                </LayerSurface>
                <LayerSurface>
                  <strong>Overlay primitives</strong>
                  <span>Modal and drawer chrome now comes from shared staff primitives.</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
                    <Button type="button" onClick={() => setShowModal(true)}>Open modal</Button>
                    <Button type="button" variant="secondary" onClick={() => setShowDrawer(true)}>Open drawer</Button>
                  </div>
                </LayerSurface>
              </Grid>
            </LayerTheme>
          </div>
        </LayerSurface>
      </main>

      <StaffModal
        open={showModal}
        title="Shared modal primitive"
        description="Panel, overlay, body lock and footer actions are canonical."
        onClose={() => setShowModal(false)}
        footer={<Button type="button" onClick={() => setShowModal(false)}>Close modal</Button>}
      >
        <StaffAlert tone="success" title="Modal chrome is global">
          Feature pages can opt into this wrapper without changing their data flow.
        </StaffAlert>
      </StaffModal>

      <StaffDrawer
        open={showDrawer}
        title="Shared drawer primitive"
        description="Use this for side-panel inspections, filters and contextual details."
        onClose={() => setShowDrawer(false)}
        footer={<Button type="button" onClick={() => setShowDrawer(false)}>Close drawer</Button>}
      >
        <StaffVhcItemRow area="Example row" note="Drawer body keeps the same row primitives" result="Ready" tone="success" />
      </StaffDrawer>
    </Layout>
  );
}

