// file location: src/pages/hr/disciplinary.js
import React from "react";
import { useHrOperationsData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, InputField, LayerSurface, StatusMessage } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import HrDisciplinaryIncidentsUi from "@/components/page-ui/hr/hr-disciplinary-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { hrPresentationData } from "@/features/presentation/mockData/hr_operations";
import { redirectToHrManagerTab } from "@/lib/hr/hrManagerRoutes";
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import EmptyState from "@/components/ui/EmptyState"; // canonical empty-state primitive
import HrSummaryStrip from "@/components/HR/HrSummaryStrip"; // shared at-a-glance metric strip
import { buildDisciplinarySummary } from "@/lib/hr/hrTabSummaries";

export function getServerSideProps() {
  return redirectToHrManagerTab("disciplinary");
}

function DisciplinaryContent() {
  const showPresentationMock = isPresentationMode();
  // Presentation mode never touches Supabase, so the hook stays disabled there
  // and the slide deck keeps its scripted figures.
  const { data, isLoading, error } = useHrOperationsData(0, { enabled: !showPresentationMock });

  const activeWarnings = showPresentationMock
    ? hrPresentationData.activeWarnings
    : data?.activeWarnings ?? [];
  const incidentLog = showPresentationMock ? hrPresentationData.incidentLog : data?.incidentLog ?? [];

  // Case load at a glance — final warnings first, because those are the ones
  // with an escalation deadline attached.
  const summary = buildDisciplinarySummary({ activeWarnings, incidentLog });

  if (error) {
    return (
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <SectionCard layer="theme"
          sectionKey="hr-disciplinary-error" parentKey="hr-manager-tab-disciplinary"
          title="Unable to load disciplinary data"
          subtitle="The HR datasets could not be fetched.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>
      </div>);

  }

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Log warnings, track follow-ups, and maintain audit trails for workplace incidents.
        </p>
      </header>

      <HrSummaryStrip items={summary} parentKey="hr-manager-tab-disciplinary" />

      <SectionCard layer="theme"
        sectionKey="hr-disciplinary-active-warnings" parentKey="hr-manager-tab-disciplinary"
        title="Active Warnings"
        subtitle="Warnings that still require follow-up or monitoring.">
        
        {activeWarnings.length ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Warning</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {activeWarnings.map((warning) => (
                    <tr key={warning.id}>
                      <td style={{ fontWeight: 600 }}>{warning.employee}</td>
                      <td>{warning.department}</td>
                      <td>{warning.warningLevel}</td>
                      <td>{warning.status}</td>
                      <td>{warning.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </LayerSurface>
        ) : isLoading ? null : (
          <EmptyState
            icon="✅"
            title="No active warnings"
            description="Warnings raised against an employee appear here with their level, review date and case owner."
          />
        )}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-disciplinary-incident-log" parentKey="hr-manager-tab-disciplinary"
        title="Incident Log"
        subtitle="Recent case entries and their current outcome.">
        
        {incidentLog.length ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Job</th>
                    <th>Recorded By</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {incidentLog.map((incident) => (
                    <tr key={incident.id}>
                      <td style={{ fontWeight: 600 }}>{incident.incidentType}</td>
                      <td>{incident.jobNumber}</td>
                      <td>{incident.recordedBy}</td>
                      <td>{incident.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </LayerSurface>
        ) : isLoading ? null : (
          <EmptyState
            icon="📋"
            title="No incidents recorded"
            description="Logged incidents show the type, the job they relate to, who reported them and the outcome."
          />
        )}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-disciplinary-new-incident" parentKey="hr-manager-tab-disciplinary"
        title="New Incident / Warning"
        subtitle="Record the details, attach documentation, and assign a case owner.">
        
        <form
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-md)"
          }}>
          
          <InputField label="Employee Name" type="text" placeholder="Employee involved" />
          <InputField label="Department" type="text" placeholder="Department / team" />
          <CalendarField label="Incident Date" name="incidentDate" id="incidentDate" />
          <DropdownField
            label="Warning Level"
            name="warningLevel"
            placeholder="Choose level"
            defaultValue=""
            options={[
            { value: "Verbal Warning", label: "Verbal Warning" },
            { value: "Written Warning", label: "Written Warning" },
            { value: "Final Warning", label: "Final Warning" },
            { value: "Incident Report", label: "Incident Report" }]
            } />
          
          <label style={labelStyle}>
            <span>Summary</span>
            <textarea
              className="app-input"
              style={{ minHeight: "140px", resize: "vertical" }}
              placeholder="Describe the incident, who was involved, and immediate actions taken." />
            
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "var(--space-3)" }}>
            <Button type="button" variant="primary">
              Save record
            </Button>
            <Button type="button" variant="ghost">
              Attach supporting file
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>);

}

export default function HrDisciplinaryIncidents() {
  return <HrDisciplinaryIncidentsUi view="section1" DisciplinaryContent={DisciplinaryContent} />;
}

// Local textarea label — InputField covers input/select fields, but no global textarea component exists yet.
const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-xs)",
  fontSize: "var(--text-label)",
  color: "var(--text-1)",
  fontWeight: "var(--control-label-weight)",
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-caps)",
  gridColumn: "1 / -1"
};
