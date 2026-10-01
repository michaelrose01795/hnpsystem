// file location: src/components/page-ui/job-cards/TechnicalInfoPopup.js
//
// Workshop information panel for one job's vehicle. Nothing here paints
// anything: it is the staffglobal.css settings popup convention (fixed compact
// header, independently scrolling panel) with content laid out from the Record
// family (plate, label/value fields, headings, quiet notes). Inline styles are
// layout only. Grouping and de-duplication of vehicle facts live in
// src/lib/technicalInfo/factGroups.js.
import { useEffect, useMemo, useRef, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import EmptyState from "@/components/ui/EmptyState";
import StatusMessage from "@/components/ui/StatusMessage";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import { DropdownField } from "@/components/ui/dropdownAPI";
import useTechnicalInfo from "@/hooks/useTechnicalInfo";
import { TECHNICAL_CATEGORIES, classifyRequest, suggestedQuestions } from "@/lib/technicalInfo/catalogue";
import { formatRetrievedAt, groupVehicleFacts } from "@/lib/technicalInfo/factGroups";

const categoryLabel = (id) => TECHNICAL_CATEGORIES.find((item) => item.id === id)?.label || id;

// Layout-only helpers shared by the sections below.
const wrapRow = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-sm)", minWidth: 0 };
const cardGrid = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: "var(--layout-card-gap)", minWidth: 0 });
const stack = { display: "flex", flexDirection: "column", gap: "var(--space-xs)", minWidth: 0 };

export default function TechnicalInfoPopup({ jobNumber, initialRequest = null, onClose }) {
  const [requestId, setRequestId] = useState(initialRequest?.requestId != null ? String(initialRequest.requestId) : "");
  const [requestText, setRequestText] = useState(initialRequest?.description || "");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("");
  const [browse, setBrowse] = useState(false);
  const [showAllDetails, setShowAllDetails] = useState(false);
  const dialogRef = useRef(null);
  const { data, error, isLoading, isValidating, mutate } = useTechnicalInfo(jobNumber, { requestId, requestText, query, category, browse });
  const description = data?.selectedRequest?.description || requestText;
  const categories = data?.categories || classifyRequest(description);
  const questions = data?.suggestions || suggestedQuestions(description);
  const vehicle = data?.vehicle;
  const vehicleTitle = [vehicle?.makeModel || [vehicle?.make, vehicle?.model].filter(Boolean).join(" "), vehicle?.year].filter(Boolean).join(" · ");
  const items = data?.items || [];
  const { groups, sources } = useMemo(() => groupVehicleFacts(data?.facts || []), [data?.facts]);
  // A search already narrows the facts, so every matching group is shown; otherwise
  // the registration / tax / additional groups stay folded until asked for.
  const hasFoldedGroups = !query && groups.some((group) => !group.primary);
  const visibleGroups = query || showAllDetails ? groups : groups.filter((group) => group.primary);
  // One row per source: where the facts came from, plus any provider that returned nothing.
  const providers = data?.providers || [];
  const sourceRows = [
    ...sources.map((source) => ({ ...source, status: providers.find((provider) => provider.label === source.name)?.status })),
    ...providers.filter((provider) => !sources.some((source) => source.name === provider.label)).map((provider) => ({ name: provider.label, status: provider.status })),
  ];

  useEffect(() => {
    const trigger = document.activeElement;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector("button")?.focus());
    return () => { cancelAnimationFrame(frame); if (trigger?.isConnected) trigger.focus(); };
  }, []);

  const trapFocus = (event) => {
    if (event.key !== "Tab") return;
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]')].filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const search = (value) => { setDraft(value); setQuery(value.trim()); setCategory(""); setBrowse(true); };

  // Technical information: the job's vehicle in the header, request and search controls that stay in view, then scrolling topics, workshop results and grouped vehicle details.
  return (
    // Same settings popup convention as Job Card Settings: the card carries the
    // page-card padding and clips, the header stays put and the panel scrolls.
    <PopupModal
      onClose={onClose}
      ariaLabel={`Technical information for job ${jobNumber}`}
      cardClassName="app-settings-popup-card"
      cardStyle={{ width: "min(1120px, 100%)", padding: "var(--page-card-padding)", overflow: "hidden" }}
    >
      <div
        ref={dialogRef}
        onKeyDown={trapFocus}
        className="app-settings-popup"
        style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)", minWidth: 0 }}
      >
        <header className="app-popup-compact-header">
          <div style={wrapRow}>
            {vehicle?.registration && <span className="app-record-plate app-record-plate--theme">{vehicle.registration}</span>}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>Technical information · Job #{jobNumber}</h2>
              <p className="app-record-note">{vehicleTitle || (data ? "Vehicle details not recorded" : "Loading vehicle details…")}</p>
            </div>
          </div>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Close</Button>
          </div>
        </header>

        {/* Request and search: choose which of the job's requests to look up and search this vehicle's information; stays in view while the results scroll. */}
        <LayerTheme style={{ flex: "0 0 auto" }}>
          <div style={{ ...cardGrid(280), alignItems: "end" }}>
            <DropdownField label="Request" value={requestId} options={[
              { value: "", label: "All information for this vehicle" },
              ...(data?.requests || []).map((request) => ({ value: request.id, label: request.description })),
            ]} onChange={(event) => {
              setRequestId(event.target.value); setRequestText(""); setQuery(""); setDraft(""); setCategory(""); setBrowse(false);
            }} />
            <form onSubmit={(event) => { event.preventDefault(); search(draft); }} style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-sm)", minWidth: 0 }}>
              <InputField id="technical-question" label="Search this vehicle" value={draft} maxLength={200} onChange={(event) => setDraft(event.target.value)} placeholder="e.g. sump plug torque, oil capacity" style={{ flex: "1 1 auto", minWidth: 0 }} />
              <Button type="submit" variant="primary" busy={isLoading}>Search</Button>
            </form>
          </div>
        </LayerTheme>

        <div className="app-settings-popup__panel" aria-busy={isLoading || isValidating}>
          {(data?.warnings || []).map((warning) => <div key={warning} role="status"><StatusMessage tone="warning">{warning}</StatusMessage></div>)}
          {error && <div role="alert"><StatusMessage tone="danger" style={wrapRow}><span>{error.message}</span><Button variant="secondary" size="sm" onClick={() => mutate()}>Retry</Button></StatusMessage></div>}

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "var(--page-stack-gap)", minWidth: 0 }}>
            {/* Workshop information: procedures and specifications from approved sources for this exact vehicle, each with its source reference, or a short notice when none is available. */}
            <LayerTheme style={{ flex: "3 1 420px", minWidth: 0 }}>
              <div style={{ ...wrapRow, justifyContent: "space-between" }}>
                <h3 className="app-record-heading">Workshop information</h3>
                {items.length > 0 && <span className="app-badge app-badge--accent-soft">{items.length} result{items.length === 1 ? "" : "s"}</span>}
              </div>
              {(query || category) && <p className="app-record-note">Showing {[query && `“${query}”`, category && categoryLabel(category)].filter(Boolean).join(" in ")}</p>}
              {isLoading && <InlineLoading width={220} label="Loading information for this vehicle" />}
              {data && !items.length && <EmptyState
                variant="bare"
                role="status"
                title={data.workshopConfigured ? "No matching workshop information" : "No workshop data source connected"}
                description={data.workshopConfigured ? data.emptyReason : "DVLA and VIN decoding identify the vehicle only. No repair specifications have been inferred."}
              />}
              {items.map((item) => (
                // Workshop result: the procedure or specification text with its technical area and a quiet source reference.
                <LayerSurface as="article" key={item.id} gap="var(--space-sm)">
                  <div style={{ ...wrapRow, justifyContent: "space-between" }}>
                    <h4 className="app-record-heading">{item.title}</h4>
                    <span className="app-badge app-badge--neutral">{categoryLabel(item.category)}</span>
                  </div>
                  <p className="app-record-note app-record-note--strong" style={{ whiteSpace: "pre-wrap" }}>{/* Preserve provider procedure line breaks. */}{item.content}</p>
                  <p className="app-record-note">
                    {item.source.provider} · Ref {item.source.documentId} · Retrieved {formatRetrievedAt(item.source.retrievedAt)}
                    {item.source.url && <> · <a href={item.source.url} target="_blank" rel="noopener noreferrer">View source</a></>}
                  </p>
                </LayerSurface>
              ))}
            </LayerTheme>

            {/* Topics: technical areas and common questions suggested by the selected request, with a switch to browse every technical area for the vehicle. */}
            <LayerTheme style={{ flex: "1 1 280px", minWidth: 0 }}>
              <h3 className="app-record-heading">{browse ? "Browse vehicle information" : "Suggested for this request"}</h3>
              {description && <p className="app-record-note"><strong>Request:</strong> {description}</p>}
              {!browse && !categories.length && !questions.length && <p className="app-record-note">Select a request, search, or choose a technical area below.</p>}
              {!browse && categories.length > 0 && <div style={stack}>
                <span className="app-record-field__label">Technical areas</span>
                <div className="app-record-actions">
                  {categories.map((id) => <Button key={id} variant="secondary" size="sm" onClick={() => { setCategory(id); setBrowse(true); }}>{categoryLabel(id)}</Button>)}
                </div>
              </div>}
              {!browse && questions.length > 0 && <div style={stack}>
                <span className="app-record-field__label">Common questions</span>
                <div className="app-record-actions">
                  {questions.map((question) => <Button key={question} variant="secondary" size="sm" onClick={() => search(question)}>{question}</Button>)}
                </div>
              </div>}
              <DropdownField label="Technical area" value={category} options={[{ value: "", label: "All technical areas" }, ...TECHNICAL_CATEGORIES.map(({ id, label }) => ({ value: id, label }))]} onChange={(event) => { setCategory(event.target.value); setBrowse(true); }} />
              <Button variant="secondary" size="sm" onClick={() => { setBrowse(!browse); setCategory(""); setDraft(""); setQuery(""); }}>{browse ? "Show request suggestions" : "Browse all vehicle information"}</Button>
            </LayerTheme>
          </div>

          {/* Vehicle details: identification facts grouped into vehicle, engine, registration/MOT/tax and additional details, with the less-used groups folded away and the data sources listed once at the foot. */}
          <LayerTheme>
            <div style={{ ...wrapRow, justifyContent: "space-between" }}>
              <h3 className="app-record-heading">Vehicle details</h3>
              {hasFoldedGroups && <Button variant="secondary" size="sm" aria-expanded={showAllDetails} onClick={() => setShowAllDetails(!showAllDetails)}>
                {showAllDetails ? "Show fewer details" : "Show registration, tax and other details"}
              </Button>}
            </div>
            {isLoading && !data && <InlineLoading width={220} label="Loading vehicle details" />}
            {data && !groups.length && <p className="app-record-note">No matching vehicle details.</p>}
            {visibleGroups.length > 0 && <div style={cardGrid(300)}>
              {visibleGroups.map((group) => (
                // Detail group: one set of related vehicle facts shown as label and value pairs.
                <LayerSurface key={group.id} as="section" aria-label={group.label}>
                  <h4 className="app-record-heading">{group.label}</h4>
                  <div className="app-record-grid">
                    {group.fields.map((field) => (
                      <div key={field.id} className="app-record-field" title={`Source: ${field.sources.join(", ")}`}>
                        {/* Sources that disagree are named on the field so the difference is not hidden. */}
                        <span className="app-record-field__label">{field.label}{field.conflict ? ` · ${field.sources.join(", ")}` : ""}</span>
                        <span className="app-record-field__value">{field.value}</span>
                      </div>
                    ))}
                  </div>
                </LayerSurface>
              ))}
            </div>}
            {sourceRows.length > 0 && <div style={stack}>
              <span className="app-record-field__label">Sources</span>
              {sourceRows.map((source) => <p key={source.name} className="app-record-note">
                {source.name}
                {source.status ? ` · ${source.status.replaceAll("-", " ")}` : ""}
                {source.retrievedAt ? ` · retrieved ${formatRetrievedAt(source.retrievedAt)}` : sources.some((row) => row.name === source.name) ? " · staff-recorded, not a workshop specification" : ""}
                {source.url && <> · <a href={source.url} target="_blank" rel="noopener noreferrer">View source</a></>}
              </p>)}
            </div>}
          </LayerTheme>
        </div>
      </div>
    </PopupModal>
  );
}
