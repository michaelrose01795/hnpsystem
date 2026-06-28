// file location: src/pages/dev/dms-ui-pattern-audit.js
// Temporary DMS styling audit page for validating common dealership UI patterns against the shared staff design system.
import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import Section from "@/components/Section";
import { Button, InputField, LayerSurface, LayerTheme, StatusMessage } from "@/components/ui";
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
  { value: "cust-hughes", label: "Olivia Hughes", description: "HN24 ABC · ASX 2.0" },
  { value: "cust-evans", label: "Mark Evans", description: "HN19 DMS · Vitara" },
  { value: "cust-fleet", label: "Parks Fleet Account", description: "12 active vehicles" },
];

const departments = ["Workshop", "Parts", "Service reception", "Warranty", "Sales", "Accounts"];

const auditRows = [
  ["Tabs", "Supported", "TabGroup and StaffTabs use the tab-api/app-btn family; some older tab rows still duplicate local tab CSS."],
  ["Cards / panels", "Supported", "LayerSurface, LayerTheme, Section and Card provide global borderless surfaces; duplicated page cards remain in legacy files."],
  ["Tables", "Supported", "app-data-table centralises row height, sticky headers and row separators via --separating-line."],
  ["Forms", "Mostly supported", "Inputs/selects/textareas receive global staff-scope styles; labels/layout are still assembled page-by-page."],
  ["Dropdowns", "Supported", "DropdownField and MultiSelectDropdown provide themed custom controls; native select use remains mixed."],
  ["Search / filters", "Mostly supported", "SearchBar and control tokens exist; filter toolbars are not fully standardised across modules."],
  ["Date / time pickers", "Supported", "CalendarField, MonthPickerField and TimePickerField share control tokens and dimensions."],
  ["Modals / drawers", "Inconsistent", "Modal body-lock and z-index tokens exist, but modal/drawer chrome is implemented per feature."],
  ["Status chips", "Supported", "app-badge tone modifiers cover common states; some feature-specific chip classes still exist."],
  ["Alerts", "Mostly supported", "StatusMessage exists; inline alert panels and page-specific status banners still appear."],
  ["Empty / loading states", "Partly supported", "Skeleton primitives exist; empty-state cards are not a single global staff primitive."],
  ["Pagination", "Missing", "No obvious shared Pagination component/class; pages tend to build local controls with app-btn."],
  ["DMS domain rows", "Inconsistent", "VHC rows, parts requests and job summaries often use local composition despite shared badges/buttons/tables."],
];

const partsRequests = [
  { part: "Front brake pads", qty: 1, status: "Awaiting authorisation", tone: "warning", owner: "Parts" },
  { part: "Oil filter", qty: 2, status: "Picked", tone: "success", owner: "Workshop" },
  { part: "Rear wiper blade", qty: 1, status: "Back order", tone: "danger", owner: "Supplier" },
];

const vhcRows = [
  { area: "Tyres", result: "Amber", note: "Front nearside 3.2mm", tone: "warning" },
  { area: "Brakes", result: "Red", note: "Rear pads below limit", tone: "danger" },
  { area: "Lights", result: "Green", note: "All lamps operating", tone: "success" },
];

function AuditBadge({ children, tone = "neutral" }) {
  return <span className={`app-badge app-badge--control app-badge--${tone}`}>{children}</span>;
}

export default function DmsUiPatternAuditPage() {
  const [activeTab, setActiveTab] = useState("workshop");
  const [search, setSearch] = useState("HN24");
  const [status, setStatus] = useState("open");
  const [selectedDepartments, setSelectedDepartments] = useState(["Workshop", "Parts"]);
  const [selectedTechnician, setSelectedTechnician] = useState("tech-amy");
  const [selectedCustomer, setSelectedCustomer] = useState("cust-hughes");
  const [bookingDate, setBookingDate] = useState("2026-07-01");
  const [bookingTime, setBookingTime] = useState("08:30");
  const [showModal, setShowModal] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const supportedCount = useMemo(() => auditRows.filter((row) => row[1] === "Supported").length, []);

  return (
    <Layout>
      <main className="app-page-shell" style={{ padding: "8px 8px 32px" }}>
        <LayerSurface as="section" radius="var(--page-card-radius)" padding="var(--page-card-padding)">
          <div className="app-page-stack">
            <Section title="Temporary DMS UI pattern audit" subtitle="A static dealership interface pattern board for checking global staff/customer styling coverage without touching live data.">
              <LayerTheme>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--layout-card-gap)" }}>
                  <LayerSurface><strong>{supportedCount}</strong><span>Patterns clearly supported globally</span></LayerSurface>
                  <LayerSurface><strong>4</strong><span>Patterns partly supported or inconsistent</span></LayerSurface>
                  <LayerSurface><strong>1</strong><span>Pattern missing a shared primitive</span></LayerSurface>
                </div>
              </LayerTheme>
            </Section>

            <Section title="Controls, filters and selectors" subtitle="Tabs, search, dropdowns, multi-selects, forms, date/time pickers and action buttons.">
              <TabGroup
                ariaLabel="DMS pattern tabs"
                value={activeTab}
                onChange={setActiveTab}
                items={[{ value: "workshop", label: "Workshop" }, { value: "parts", label: "Parts" }, { value: "customer", label: "Customer" }]}
              />
              <LayerTheme>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--layout-card-gap)" }}>
                  <SearchBar value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} placeholder="Search job, reg or customer" ariaLabel="Search audit jobs" />
                  <DropdownField label="Status filter" value={status} onChange={(event) => setStatus(event.target.value)} options={["open", "awaiting parts", "complete"]} />
                  <MultiSelectDropdown label="Departments" value={selectedDepartments} onChange={setSelectedDepartments} options={departments} />
                  <CalendarField label="Booking date" value={bookingDate} onChange={setBookingDate} />
                  <TimePickerField label="Arrival time" value={bookingTime} onChange={setBookingTime} />
                  <InputField label="Job number" value="JOB-10482" readOnly />
                  <DropdownField label="Technician selector" value={selectedTechnician} onChange={(event) => setSelectedTechnician(event.target.value)} options={technicians} />
                  <DropdownField label="Customer selector" value={selectedCustomer} onChange={(event) => setSelectedCustomer(event.target.value)} options={customers} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
                  <Button type="button">Create job card</Button>
                  <Button type="button" variant="secondary">Save draft</Button>
                  <Button type="button" variant="ghost">More actions</Button>
                  <Button type="button" variant="danger">Cancel booking</Button>
                </div>
              </LayerTheme>
            </Section>

            <Section title="Tables, status chips and DMS rows" subtitle="Tables, VHC rows, parts requests, pagination and job summary panels.">
              <LayerTheme>
                <table className="app-data-table app-data-table--rounded">
                  <thead><tr><th>Pattern</th><th>Status</th><th>Audit finding</th></tr></thead>
                  <tbody>
                    {auditRows.map(([pattern, state, finding]) => (
                      <tr key={pattern}><td>{pattern}</td><td><AuditBadge tone={state === "Supported" ? "success" : state === "Missing" ? "danger" : "warning"}>{state}</AuditBadge></td><td>{finding}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--layout-card-gap)" }}>
                  <LayerSurface>
                    <strong>VHC rows</strong>
                    {vhcRows.map((row) => <div key={row.area} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)" }}><span>{row.area} · {row.note}</span><AuditBadge tone={row.tone}>{row.result}</AuditBadge></div>)}
                  </LayerSurface>
                  <LayerSurface>
                    <strong>Parts requests</strong>
                    {partsRequests.map((row) => <div key={row.part} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)" }}><span>{row.qty}× {row.part} · {row.owner}</span><AuditBadge tone={row.tone}>{row.status}</AuditBadge></div>)}
                  </LayerSurface>
                  <LayerSurface>
                    <strong>Job summary panel</strong>
                    <span>JOB-10482 · HN24 ABC · 18,420 miles</span>
                    <span>Customer: Olivia Hughes · Advisor: Chris</span>
                    <StatusMessage tone="info">Warranty check pending before customer authorisation.</StatusMessage>
                  </LayerSurface>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                  <span>Pagination check: no shared Pagination component found; this row uses local app-btn composition.</span>
                  <span style={{ display: "flex", gap: "var(--space-xs)" }}><Button type="button" size="sm" variant="secondary">Previous</Button><Button type="button" size="sm">1</Button><Button type="button" size="sm" variant="secondary">Next</Button></span>
                </div>
              </LayerTheme>
            </Section>

            <Section title="Feedback, overlays and states" subtitle="Alerts, empty states, loading states, modals and drawers.">
              <LayerTheme>
                <StatusMessage tone="success">Success alert: global StatusMessage covers simple feedback.</StatusMessage>
                <StatusMessage tone="warning">Warning alert: teams still create page-specific banners for richer layouts.</StatusMessage>
                <LayerSurface><strong>Empty state</strong><span>No matching jobs for the selected filters. Empty-state composition is still local.</span><Button type="button" variant="secondary" size="sm">Clear filters</Button></LayerSurface>
                <LayerSurface><strong>Loading state</strong><SkeletonBlock height="18px" /><SkeletonBlock width="75%" height="18px" /><InlineLoading label="Loading matching jobs" /></LayerSurface>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}><Button type="button" onClick={() => setShowModal(true)}>Open modal</Button><Button type="button" variant="secondary" onClick={() => setShowDrawer(true)}>Open drawer</Button></div>
              </LayerTheme>
            </Section>
          </div>
        </LayerSurface>
      </main>

      {showModal && (
        <div aria-modal="true" role="dialog" data-modal-portal="true" style={{ position: "fixed", inset: 0, zIndex: "var(--z-modal)", background: "var(--overlay)", display: "grid", placeItems: "center", padding: "var(--page-card-padding-mobile)" }}>
          <LayerSurface style={{ width: "min(520px, 100%)" }}><h2 style={{ margin: 0, color: "var(--accentText)" }}>Modal audit</h2><p style={{ margin: 0 }}>There is body-lock support, but no single global staff Modal component.</p><Button type="button" onClick={() => setShowModal(false)}>Close modal</Button></LayerSurface>
        </div>
      )}

      {showDrawer && (
        <div aria-modal="true" role="dialog" data-modal-portal="true" style={{ position: "fixed", inset: 0, zIndex: "var(--z-modal)", background: "var(--overlay)", display: "flex", justifyContent: "flex-end", padding: "var(--page-card-padding-mobile)" }}>
          <LayerSurface style={{ width: "min(420px, 100%)", height: "100%" }}><h2 style={{ margin: 0, color: "var(--accentText)" }}>Drawer audit</h2><p style={{ margin: 0 }}>Drawer styling is commonly page-specific; this uses layer primitives only.</p><Button type="button" onClick={() => setShowDrawer(false)}>Close drawer</Button></LayerSurface>
        </div>
      )}
    </Layout>
  );
}
