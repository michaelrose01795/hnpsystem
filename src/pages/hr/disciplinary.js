// file location: src/pages/hr/disciplinary.js
import React from "react";
import { SectionCard } from "@/components/Section";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { Button, InputField } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import HrDisciplinaryIncidentsUi from "@/components/page-ui/hr/hr-disciplinary-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { hrPresentationData } from "@/features/presentation/mockData/hr_operations";

function DisciplinaryContent() {
  const showPresentationMock = isPresentationMode();
  const activeWarnings = showPresentationMock ? hrPresentationData.activeWarnings : [];
  const incidentLog = showPresentationMock ? hrPresentationData.incidentLog : [];

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Log warnings, track follow-ups, and maintain audit trails for workplace incidents.
        </p>
      </header>

      <DevLayoutSection
        as="section"
        sectionKey="hr-disciplinary-row-1"
        parentKey="hr-manager-tab-disciplinary"
        sectionType="section-shell"
        shell
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--layout-card-gap)"
        }}>
        
        <SectionCard
          sectionKey="hr-disciplinary-card-1" parentKey="hr-disciplinary-row-1"
          title="Active Warnings"
          subtitle="Warnings that still require follow-up or monitoring.">
          
          {showPresentationMock ? (
            <div style={{ overflowX: "auto" }}>
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
            </div>
          ) : (
            <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
              TODO: Fetch active warnings from Supabase disciplinary table. Display employee name, department, warning level, reported date, status, and notes for each open case.
            </p>
          )}
        </SectionCard>

        <SectionCard
          sectionKey="hr-disciplinary-card-2" parentKey="hr-disciplinary-row-1"
          title="Incident Log"
          subtitle="Recent case entries and their current outcome.">
          
          {showPresentationMock ? (
            <div style={{ overflowX: "auto" }}>
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
            </div>
          ) : (
            <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
              TODO: Fetch incident log from Supabase. Display incident type, job number, recorded by, outcome status, and export functionality.
            </p>
          )}
        </SectionCard>
      </DevLayoutSection>

      <SectionCard
        sectionKey="hr-disciplinary-card-3" parentKey="hr-manager-tab-disciplinary"
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
        <p
          style={{
            fontSize: "var(--text-caption)",
            color: "var(--text-1)",
            fontStyle: "italic",
            marginTop: "var(--space-5)"
          }}>
          
          TODO: Wire form submission to Supabase incidents table. Save record should persist the incident and refresh the active warnings list.
        </p>
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
