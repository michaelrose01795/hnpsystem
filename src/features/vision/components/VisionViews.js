// file location: src/pages/vision/_components/VisionViews.js
// Reusable mock-only Vision views. Interactions update local React state only.

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import {
  featureGroups,
  mockAlerts,
  mockCustomerMessages,
  mockKpis,
  mockManagerSummary,
  mockRecords,
  mockSuggestedActions,
  mockSummaries,
  mockWorkflowEvents,
  roadmapStages,
  roadmapStageDetails,
  futurePlatformDescriptions,
  visionDepartments,
  visionLayers,
} from "../data/visionMockData";

const styles = {
  sectionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--layout-card-gap)" },
  wideGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--layout-card-gap)" },
  row: { display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" },
  between: { display: "flex", justifyContent: "space-between", gap: "var(--space-3)", alignItems: "flex-start", flexWrap: "wrap" },
  h2: { fontSize: "1.35rem", letterSpacing: 0 },
  h3: { fontSize: "1rem", letterSpacing: 0 },
  muted: { color: "var(--surfaceTextMuted)" },
  small: { color: "var(--surfaceTextMuted)", fontSize: "0.88rem" },
  badge: { display: "inline-flex", padding: "var(--control-padding-xs)", borderRadius: "var(--radius-pill)", background: "var(--secondary)", color: "var(--accentText)", fontSize: "0.8rem", fontWeight: 800 },
  flow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)", alignItems: "stretch" },
  connector: { textAlign: "center", color: "var(--accentText)", fontWeight: 800, padding: "var(--space-xs) 0" },
  list: { display: "grid", gap: "var(--space-sm)", paddingLeft: "1rem" },
  input: { width: "100%", minHeight: 120, resize: "vertical", border: "var(--input-ring)", borderRadius: "var(--input-radius)", background: "var(--input-bg)", padding: "var(--control-padding)", color: "var(--surfaceText)" },
};

function KpiStrip() {
  return (
    <div style={styles.sectionGrid}>
      {mockKpis.map((kpi) => (
        <LayerTheme key={kpi.label} padding="var(--section-card-padding-sm)">
          <span style={styles.small}>{kpi.label}</span>
          <strong style={{ fontSize: "1.7rem" }}>{kpi.value}</strong>
          <span style={styles.badge}>{kpi.trend}</span>
        </LayerTheme>
      ))}
    </div>
  );
}

export function VisionHome() {
  return (
    <>
      <LayerSurface>
        <div style={styles.between}>
          <div>
            <h2 style={styles.h2}>Dealership Operating System Overview</h2>
            <p style={styles.muted}>This mock-only area shows how H&P DMS could coordinate departments, workflows, messages, summaries, and management insight without touching production data.</p>
          </div>
          <span style={styles.badge}>Mock data only</span>
        </div>
        <KpiStrip />
      </LayerSurface>
      <LayerSurface>
        <h2 style={styles.h2}>System Map</h2>
        <div style={styles.flow}>
          {visionLayers.map((layer, index) => (
            <React.Fragment key={layer.title}>
              <LayerTheme padding="var(--section-card-padding-sm)">
                <h3 style={styles.h3}>{layer.title}</h3>
                <p style={styles.small}>{layer.description}</p>
                <div style={styles.row}>{layer.items.slice(0, 3).map((item) => <span key={item} style={styles.badge}>{item}</span>)}</div>
              </LayerTheme>
              {index < visionLayers.length - 1 && <div style={styles.connector}>-&gt;</div>}
            </React.Fragment>
          ))}
        </div>
        <Link className="app-btn app-btn--primary" href="/vision/system-map">Open system map</Link>
      </LayerSurface>
      <LayerSurface>
        <h2 style={styles.h2}>Department Cards</h2>
        <div style={styles.sectionGrid}>
          {visionDepartments.map((department) => (
            <Link key={department.slug} href={`/vision/${department.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              <LayerTheme padding="var(--section-card-padding-sm)">
                <div style={styles.between}>
                  <h3 style={styles.h3}>{department.title}</h3>
                  <span style={styles.badge}>{department.pressure}</span>
                </div>
                <strong>{department.metric}</strong>
                <p style={styles.small}>{department.summary}</p>
              </LayerTheme>
            </Link>
          ))}
        </div>
      </LayerSurface>
      <LayerSurface>
        <h2 style={styles.h2}>Layer Cards</h2>
        <div style={styles.wideGrid}>
          {[
            ["Intelligence layer", "Reusable analysis, recommendations, summaries, trends, and memory.", "/vision/operational-intelligence"],
            ["Workflow engine", "Routing, dependencies, task creation, escalations, and recovery.", "/vision/workflow-coordination"],
            ["Communication layer", "Drafts, mentions, importance, trigger messages, and timelines.", "/vision/communication-layer"],
            ["Management layer", "Pressure, capacity, revenue opportunity, forecasts, and daily summary.", "/vision/management"],
          ].map(([title, description, href]) => (
            <LayerTheme key={title}>
              <h3 style={styles.h3}>{title}</h3>
              <p style={styles.small}>{description}</p>
              <Link className="app-btn app-btn--secondary" href={href}>Explore</Link>
            </LayerTheme>
          ))}
        </div>
      </LayerSurface>
    </>
  );
}

export function SystemMapView() {
  return (
    <LayerSurface>
      <h2 style={styles.h2}>Layered Dealership Operating System</h2>
      <div style={styles.wideGrid}>
        {visionLayers.map((layer, index) => (
          <LayerTheme key={layer.title}>
            <div style={styles.between}>
              <h3 style={styles.h3}>{layer.title}</h3>
              <span style={styles.badge}>Live mock {index + 1}</span>
            </div>
            <p style={styles.small}>{layer.description}</p>
            <ul style={styles.list}>{layer.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </LayerTheme>
        ))}
      </div>
    </LayerSurface>
  );
}

export function WorkflowCoordinationView() {
  const [selectedId, setSelectedId] = useState(mockWorkflowEvents[0].id);
  const [status, setStatus] = useState("Reviewing");
  const selected = mockWorkflowEvents.find((event) => event.id === selectedId);
  return (
    <>
      <LayerSurface>
        <h2 style={styles.h2}>Mock Workflow Events</h2>
        <div style={styles.wideGrid}>
          {mockWorkflowEvents.map((event) => (
            <LayerTheme key={event.id}>
              <h3 style={styles.h3}>{event.title}</h3>
              <p style={styles.small}>{event.vehicle}</p>
              <span style={styles.badge}>{event.status}</span>
              <Button type="button" variant={selectedId === event.id ? "primary" : "secondary"} onClick={() => { setSelectedId(event.id); setStatus("Reviewing"); }}>
                Open detail
              </Button>
            </LayerTheme>
          ))}
        </div>
      </LayerSurface>
      <LayerSurface>
        <div style={styles.between}>
          <div>
            <h2 style={styles.h2}>{selected.title}</h2>
            <p style={styles.muted}>{selected.department} - {selected.vehicle}</p>
          </div>
          <span style={styles.badge}>{status}</span>
        </div>
        <div style={styles.sectionGrid}>
          <LayerTheme><h3 style={styles.h3}>Tasks Created</h3><ul style={styles.list}>{selected.created.map((item) => <li key={item}>{item}</li>)}</ul></LayerTheme>
          <LayerTheme><h3 style={styles.h3}>Messages</h3><ul style={styles.list}>{selected.messages.map((item) => <li key={item}>{item}</li>)}</ul></LayerTheme>
          <LayerTheme><h3 style={styles.h3}>Dependency Checks</h3><ul style={styles.list}>{selected.checks.map((item) => <li key={item}>{item}</li>)}</ul></LayerTheme>
        </div>
        <div style={styles.row}>
          {["Reviewing", "Task queued", "Notification drafted", "Resolved in mock"].map((nextStatus) => (
            <Button key={nextStatus} type="button" variant={status === nextStatus ? "primary" : "secondary"} onClick={() => setStatus(nextStatus)}>
              {nextStatus}
            </Button>
          ))}
        </div>
      </LayerSurface>
      <GenericFeatureView slug="workflow-coordination" compact />
    </>
  );
}

export function OperationalArchitectureView() {
  const group = featureGroups["operational-intelligence"];
  return (
    <LayerSurface>
      <h2 style={styles.h2}>Shared Intelligence Architecture</h2>
      <p style={styles.muted}>{group.intro}</p>
      <div style={styles.flow}>
        {group.features.map((feature, index) => (
          <React.Fragment key={feature}>
            <LayerTheme padding="var(--section-card-padding-sm)">
              <h3 style={styles.h3}>{feature}</h3>
              <p style={styles.small}>Mock service boundary with reviewable outputs and stable UI labels.</p>
            </LayerTheme>
            {index < group.features.length - 1 && <div style={styles.connector}>-&gt;</div>}
          </React.Fragment>
        ))}
      </div>
    </LayerSurface>
  );
}

export function CommunicationLayerView() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [draft, setDraft] = useState(mockCustomerMessages[0].draft);
  const selected = mockCustomerMessages[messageIndex];
  return (
    <>
      <LayerSurface>
        <div style={styles.between}>
          <div>
            <h2 style={styles.h2}>Mock Message Composer</h2>
            <p style={styles.muted}>{selected.customer} - {selected.context}</p>
          </div>
          <div style={styles.row}>
            {mockCustomerMessages.map((message, index) => (
              <Button key={message.customer} type="button" size="sm" variant={messageIndex === index ? "primary" : "secondary"} onClick={() => { setMessageIndex(index); setDraft(message.draft); }}>
                {message.customer}
              </Button>
            ))}
          </div>
        </div>
        <textarea aria-label="Mock suggested draft" style={styles.input} value={draft} onChange={(event) => setDraft(event.target.value)} />
        <div style={styles.row}>
          <Button type="button" onClick={() => setDraft(selected.draft)}>Suggested draft</Button>
          <Button type="button" variant="secondary" onClick={() => setDraft(`${draft}\n\nReviewed by advisor.`)}>Review</Button>
          <Button type="button" variant="ghost" onClick={() => setDraft("")}>Clear</Button>
        </div>
      </LayerSurface>
      <GenericFeatureView slug="communication-layer" />
    </>
  );
}

export function GenericFeatureView({ slug, compact = false }) {
  const group = featureGroups[slug];
  const [focusedFeature, setFocusedFeature] = useState(group?.features?.[0] || "");
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState([]);
  const records = useMemo(() => mockRecords.filter((record, index) => compact || index < 2), [compact]);
  const visibleFeatures = group?.features?.slice(0, 6) || [];
  const visibleAlerts = compact ? mockAlerts.slice(0, 2) : mockAlerts;
  const visibleSummaries = compact ? mockSummaries.slice(0, 1) : mockSummaries.slice(0, 2);
  if (!group) return null;
  return (
    <LayerSurface padding={compact ? "var(--section-card-padding-sm)" : "var(--section-card-padding)"}>
      {!compact && (
        <div>
          <h2 style={styles.h2}>{group.title}</h2>
          <p style={styles.muted}>{group.intro}</p>
        </div>
      )}
      <div style={styles.sectionGrid}>
        <LayerTheme padding="var(--section-card-padding-sm)">
          <h3 style={styles.h3}>Features</h3>
          <p style={styles.small}>The planned capability set for this area, shown as short reviewable feature signals.</p>
          <div style={styles.row}>
            {visibleFeatures.map((feature) => (
              <Button
                key={feature}
                type="button"
                size="xs"
                variant={focusedFeature === feature ? "primary" : "secondary"}
                onClick={() => setFocusedFeature(feature)}
              >
                {feature}
              </Button>
            ))}
          </div>
          {group.features.length > visibleFeatures.length && <p style={styles.small}>Showing {visibleFeatures.length} of {group.features.length} planned features in this compact example section.</p>}
          {focusedFeature && <p style={styles.small}>Example: {focusedFeature} would surface as Analysis, Review, and Suggested Actions inside the future workflow.</p>}
        </LayerTheme>

        <LayerTheme padding="var(--section-card-padding-sm)">
          <h3 style={styles.h3}>Mock Records</h3>
          <p style={styles.small}>Example jobs, enquiries, parts, VHC items, or stock records used only for this Vision area.</p>
          {records.map((record) => (
            <LayerSurface key={record.title} padding="var(--space-3)" radius="var(--radius-sm)">
              <div style={styles.between}>
                <strong>{record.title}</strong>
                <span style={styles.badge}>{record.status}</span>
              </div>
              <p style={styles.small}>{record.detail}</p>
            </LayerSurface>
          ))}
        </LayerTheme>

        <LayerTheme padding="var(--section-card-padding-sm)">
          <h3 style={styles.h3}>Alerts</h3>
          <p style={styles.small}>Short operational warnings with a mock acknowledgement state.</p>
          {visibleAlerts.map((alert, index) => {
            const isAcknowledged = acknowledgedAlerts.includes(alert);
            return (
              <LayerSurface key={alert} padding="var(--space-3)" radius="var(--radius-sm)">
                <div style={styles.between}>
                  <strong>Example alert</strong>
                  <span style={styles.badge}>{isAcknowledged ? "Acknowledged" : "Open"}</span>
                </div>
                <p style={styles.small}>{alert}</p>
                <p style={styles.small}>Action: {mockSuggestedActions[index % mockSuggestedActions.length]}</p>
                <Button
                  type="button"
                  size="xs"
                  variant={isAcknowledged ? "primary" : "secondary"}
                  onClick={() => setAcknowledgedAlerts((alerts) => (isAcknowledged ? alerts.filter((item) => item !== alert) : [...alerts, alert]))}
                >
                  {isAcknowledged ? "Reopen mock" : "Acknowledge mock"}
                </Button>
              </LayerSurface>
            );
          })}
        </LayerTheme>

        <LayerTheme padding="var(--section-card-padding-sm)">
          <h3 style={styles.h3}>Summary</h3>
          <p style={styles.small}>Generated mock summaries for managers, advisors, and department leads.</p>
          {visibleSummaries.map((summary) => (
            <LayerSurface key={summary} padding="var(--space-3)" radius="var(--radius-sm)">
              <p style={styles.small}>{summary}</p>
            </LayerSurface>
          ))}
          <LayerSurface padding="var(--space-3)" radius="var(--radius-sm)">
            <strong>{mockManagerSummary.title}</strong>
            <p style={styles.small}>{mockManagerSummary.lines[0]}</p>
          </LayerSurface>
        </LayerTheme>
      </div>
    </LayerSurface>
  );
}

export function FuturePlatformView() {
  return (
    <LayerSurface>
      <h2 style={styles.h2}>Future Architecture Vision Board</h2>
      <p style={styles.muted}>{featureGroups["future-platform"].intro}</p>
      <div style={styles.wideGrid}>
        {featureGroups["future-platform"].features.map((feature, index) => (
          <LayerTheme key={feature}>
            <span style={styles.badge}>Platform concept {index + 1}</span>
            <h3 style={styles.h3}>{feature}</h3>
            <p style={styles.small}>{futurePlatformDescriptions[index]}</p>
          </LayerTheme>
        ))}
      </div>
    </LayerSurface>
  );
}

export function RoadmapView() {
  const [activeStage, setActiveStage] = useState(0);
  return (
    <LayerSurface>
      <h2 style={styles.h2}>Staged Roadmap</h2>
      <div style={styles.wideGrid}>
        {roadmapStages.map((stage, index) => (
          <LayerTheme key={stage}>
            <div style={styles.between}>
              <h3 style={styles.h3}>{stage}</h3>
              <span style={styles.badge}>{index <= activeStage ? "In view" : "Later"}</span>
            </div>
            <p style={styles.small}>{roadmapStageDetails[index]}</p>
            <Button type="button" variant={activeStage === index ? "primary" : "secondary"} onClick={() => setActiveStage(index)}>
              Review stage
            </Button>
          </LayerTheme>
        ))}
      </div>
    </LayerSurface>
  );
}
