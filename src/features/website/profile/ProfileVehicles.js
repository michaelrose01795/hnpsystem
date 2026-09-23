// file location: src/features/website/profile/ProfileVehicles.js
//
// The Vehicles view. Everything that used to be spread across the separate
// Ownership, Vehicles, History, MOT, Recalls, Inspections and VHC hub sections
// now lives behind one vehicle picker and five subsections:
//
//   Overview | Service history | MOT | Health check | Recalls
//
// The customer picks a vehicle first, then a subsection, so only one slice of
// one car is on screen at a time. All data comes from the page's single
// /api/website/profile payload; the only actions raised from here are
// "approve this advisory" and the two garage tools.

import { useEffect, useMemo, useState } from "react";
import { buildCustomerReportUrl } from "@/lib/vhc/shareCode";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import {
  DetailField,
  DetailFieldGrid,
  ExpandableList,
  NotAvailableYet,
  PortalCard,
  ScoreRing,
  SubNav,
} from "./ProfilePrimitives";
import { AddVehicleRow, UpdateMileageRow } from "./ProfileForms";
import {
  formatCurrency,
  formatDate,
  getHealthScore,
  getMotState,
  isCompletedJob,
  jobRef,
  vehicleReg,
  vehicleTitle,
} from "./profileUtils";

// Presentation-mode stand-ins for the customer VHC routes, so a scripted demo
// walks the same screens without a live share code.
const VHC_PRESENTATION_LINKS = {
  customer: "/presentation/customer/vhc-customer-jobNumber-linkCode/11",
};

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "history", label: "Service history" },
  { id: "mot", label: "MOT" },
  { id: "vhc", label: "Health check" },
  { id: "recalls", label: "Recalls" },
];

export default function ProfileVehicles({
  vehicles,
  selectedVehicle,
  onSelectVehicle,
  section,
  onSectionChange,
  jobs,
  jobHistory,
  invoices,
  vhcByJob,
  vhcDeclinations,
  vhcMedia,
  vhcShareLinks,
  onApproveVhcItem,
  onAddVehicle,
  onMileageSaved,
  actionFlash,
}) {
  const [presentationMode, setPresentationMode] = useState(false);
  useEffect(() => setPresentationMode(isPresentationMode()), []);

  const vehicle = selectedVehicle || vehicles[0] || null;
  const reg = vehicle ? vehicle.reg_number : null;

  // Only this vehicle's jobs, visits and invoices — the rest of the account is
  // reachable from Workshop and Money.
  const vehicleJobs = useMemo(
    () => (reg ? jobs.filter((job) => job.vehicle_reg === reg) : []),
    [jobs, reg],
  );
  const vehicleVisits = useMemo(
    () => (reg ? jobHistory.filter((row) => row.vehicle_reg === reg) : []),
    [jobHistory, reg],
  );
  // Mileage readings for this vehicle, scaled against its own highest figure
  // so the bars compare like with like.
  const mileageRows = useMemo(() => {
    const readings = vehicleVisits.filter((row) => Number(row.mileage_at_service) > 0);
    if (!readings.length) return [];
    const max = Math.max(...readings.map((row) => Number(row.mileage_at_service)));
    return readings.slice(0, 10).map((row) => ({
      ...row,
      pct: Math.min(100, (Number(row.mileage_at_service) / max) * 100),
    }));
  }, [vehicleVisits]);

  const invoiceByJobNumber = useMemo(
    () => new Map(invoices.map((invoice) => [String(invoice.job_number || ""), invoice])),
    [invoices],
  );

  const latestVhcJob = useMemo(
    () => vehicleJobs.find((job) => vhcByJob[job.id] || vhcByJob[job.job_number]) || null,
    [vehicleJobs, vhcByJob],
  );
  const latestVhc = latestVhcJob ? vhcByJob[latestVhcJob.id] || vhcByJob[latestVhcJob.job_number] : null;
  const vehicleDeclinations = useMemo(
    () => (latestVhcJob ? vhcDeclinations.filter((row) => row.job_id === latestVhcJob.id) : vhcDeclinations),
    [vhcDeclinations, latestVhcJob],
  );
  const vehicleMedia = useMemo(
    () =>
      latestVhcJob
        ? vhcMedia.filter((item) => item.job_number === latestVhcJob.job_number)
        : vhcMedia,
    [vhcMedia, latestVhcJob],
  );
  const shareLink = latestVhcJob
    ? vhcShareLinks.find(
        (link) =>
          String(link.job_id || "") === String(latestVhcJob.id || "") ||
          String(link.job_number || "") === String(latestVhcJob.job_number || ""),
      )
    : null;
  const reportUrl = shareLink?.link_code ? buildCustomerReportUrl(shareLink.link_code) : null;

  if (!vehicles.length) {
    return (
      <div className="ws-profile-view" data-presentation="website-profile-vehicles">
        <PortalCard eyebrow="Your garage" title="No vehicle linked yet">
          <p className="ws-portal-empty">
            Add the car you want us to look after and we&apos;ll keep its MOT dates, service history and health checks
            here.
          </p>
          <AddVehicleRow onSubmit={onAddVehicle} flash={actionFlash.addveh} />
        </PortalCard>
      </div>
    );
  }

  const mot = getMotState(vehicle);

  return (
    <div className="ws-profile-view" data-presentation="website-profile-vehicles">
      {/* Vehicle picker. One vehicle still shows its chip, so the header below
          always means the same thing. */}
      <div className="ws-profile-picker" data-presentation="website-profile-vehicle-selector">
        {vehicles.map((item) => (
          <button
            key={item.vehicle_id || item.reg_number}
            type="button"
            className="ws-profile-chip"
            aria-pressed={Boolean(vehicle && item.vehicle_id === vehicle.vehicle_id)}
            onClick={() => onSelectVehicle(item)}
          >
            <span className="ws-profile-chip__reg">{vehicleReg(item)}</span>
            <span className="ws-profile-chip__name">{vehicleTitle(item)}</span>
          </button>
        ))}
      </div>

      {/* Selected vehicle header — the one-line answer before any detail. */}
      <PortalCard
        eyebrow={vehicleReg(vehicle)}
        title={vehicleTitle(vehicle)}
        action={<ScoreRing score={getHealthScore(vehicle)} />}
        presentation="website-profile-vehicle-header"
        wide
      >
        <div className="ws-portal-action-row">
          <span className="ws-portal-badge" data-tone={mot.tone}>
            {mot.label}
          </span>
          {vehicle.service_plan_type ? (
            <span className="ws-portal-tag" data-tone="ok">
              Service plan · {vehicle.service_plan_type}
            </span>
          ) : null}
          {vehicleJobs.some((job) => !isCompletedJob(job)) ? (
            <span className="ws-portal-badge" data-tone="open">
              With us now
            </span>
          ) : null}
        </div>
      </PortalCard>

      <SubNav
        label={`${vehicleTitle(vehicle)} sections`}
        items={SECTIONS}
        value={section}
        onChange={onSectionChange}
        idPrefix="ws-profile-vehicle"
      />

      {/* The full-width cards are siblings of the two-up split, not children:
          a card spanning every column inside the split would stop the split's
          auto-fit collapsing its spare tracks, and the pair would sit in two
          narrow columns with the rest of the row empty. */}
      {section === "overview" ? (
        <>
        <div className="ws-portal-split">
          <PortalCard eyebrow="Details" title="About this vehicle">
            <DetailFieldGrid>
              <DetailField label="Registration" value={vehicleReg(vehicle)} />
              <DetailField label="Year" value={vehicle.year} />
              <DetailField label="Colour" value={vehicle.colour} />
              <DetailField label="Fuel / gearbox" value={[vehicle.fuel_type, vehicle.transmission].filter(Boolean).join(" · ")} />
              <DetailField
                label="Mileage"
                value={vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString("en-GB")} miles` : null}
              />
              <DetailField label="MOT due" value={formatDate(vehicle.mot_due)} />
              <DetailField
                label="Warranty"
                value={[vehicle.warranty_type, vehicle.warranty_expiry ? formatDate(vehicle.warranty_expiry) : null]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <DetailField
                label="Service plan"
                value={[
                  vehicle.service_plan_supplier,
                  vehicle.service_plan_type,
                  vehicle.service_plan_expiry ? formatDate(vehicle.service_plan_expiry) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            </DetailFieldGrid>
            {vehicle.service_history ? (
              <div>
                <h4 className="ws-portal-subhead">Service notes</h4>
                <p className="ws-portal-note">{vehicle.service_history}</p>
              </div>
            ) : null}
          </PortalCard>

          <PortalCard eyebrow="Garage" title="Keep your garage up to date">
            <UpdateMileageRow vehicles={vehicles} onSaved={onMileageSaved} flash={actionFlash.mileage} />
            <AddVehicleRow onSubmit={onAddVehicle} flash={actionFlash.addveh} />
          </PortalCard>
        </div>

          {mileageRows.length ? (
            <PortalCard eyebrow="Mileage" title="How the miles have added up" wide>
              <div className="ws-portal-mileage">
                {mileageRows.map((row) => (
                  <div key={row.history_id || row.recorded_at} className="ws-portal-mileage__row">
                    <span>{formatDate(row.recorded_at)}</span>
                    <span className="ws-portal-mileage__bar">
                      <span className="ws-portal-mileage__fill" style={{ "--ws-portal-pct": `${row.pct}%` }} />
                    </span>
                    <span className="ws-portal-mileage__value">
                      {Number(row.mileage_at_service).toLocaleString("en-GB")} mi
                    </span>
                  </div>
                ))}
              </div>
            </PortalCard>
          ) : null}
        </>
      ) : null}

      {section === "history" ? (
        <PortalCard
          eyebrow="Service log"
          title="Service history"
          count={vehicleVisits.length || vehicleJobs.filter(isCompletedJob).length}
          wide
        >
          <ExpandableList
            items={
              vehicleVisits.length
                ? vehicleVisits
                : vehicleJobs.filter(isCompletedJob).map((job) => ({
                    history_id: job.id,
                    job_id: job.id,
                    job_number: job.job_number,
                    recorded_at: job.completed_at || job.updated_at || job.created_at,
                    status_snapshot: job.description || job.type,
                  }))
            }
            initial={4}
            moreLabel="View full history"
            emptyText="We have not recorded a completed visit for this vehicle yet."
            renderItem={(visit) => {
              const invoice = invoiceByJobNumber.get(String(visit.job_number || ""));
              const vhc = vhcByJob?.[visit.job_id] || {};
              return (
                <li key={visit.history_id || visit.job_id} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">{visit.status_snapshot || "Workshop visit"}</div>
                    <div className="ws-portal-item-meta">
                      {[
                        formatDate(visit.recorded_at),
                        visit.mileage_at_service
                          ? `${Number(visit.mileage_at_service).toLocaleString("en-GB")} miles`
                          : null,
                        invoice?.invoice_number,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="ws-portal-action-row ws-portal-actions-end">
                    {vhc.red ? (
                      <span className="ws-portal-badge" data-tone="open">
                        {vhc.red} urgent
                      </span>
                    ) : null}
                    {vhc.amber ? <span className="ws-portal-badge">{vhc.amber} advisory</span> : null}
                  </div>
                </li>
              );
            }}
          />
        </PortalCard>
      ) : null}

      {section === "mot" ? (
        <PortalCard eyebrow="MOT record" title="MOT" wide>
          <ul className="ws-portal-list">
            <li className="ws-portal-row">
              <div>
                <div className="ws-portal-item-title">Current MOT expiry</div>
                <div className="ws-portal-item-meta">{formatDate(vehicle.mot_due)}</div>
              </div>
              <span className="ws-portal-badge" data-tone={mot.tone}>
                {mot.label}
              </span>
            </li>
          </ul>
          <NotAvailableYet>
            Your full MOT test history, including past advisories, is not available here yet — ask us and we&apos;ll
            send it over.
          </NotAvailableYet>
        </PortalCard>
      ) : null}

      {section === "vhc" ? (
        <>
        <div className="ws-portal-split">
          <PortalCard
            eyebrow="Vehicle health check"
            title="Your last health check"
            action={
              reportUrl || presentationMode ? (
                <a className="app-btn" href={presentationMode ? VHC_PRESENTATION_LINKS.customer : reportUrl}>
                  View full report
                </a>
              ) : null
            }
          >
            <p className="ws-portal-lead">
              A vehicle health check (VHC) is the inspection our technicians carry out while your car is with us.
            </p>
            {!latestVhc ? (
              <p className="ws-portal-empty">We have not carried out a health check on this vehicle yet.</p>
            ) : (
              <>
                <div className="ws-portal-tile">
                  <h4 className="ws-portal-subhead">What we found</h4>
                  <div className="ws-portal-action-row">
                    <span className="ws-portal-light" data-tone="red">
                      <span className="ws-portal-light__dot" />
                      {latestVhc.red || 0} urgent
                    </span>
                    <span className="ws-portal-light" data-tone="amber">
                      <span className="ws-portal-light__dot" />
                      {latestVhc.amber || 0} advisory
                    </span>
                    <span className="ws-portal-light" data-tone="green">
                      <span className="ws-portal-light__dot" />
                      {latestVhc.green || 0} fine
                    </span>
                  </div>
                </div>
                <div className="ws-portal-balance">
                  <span className="ws-portal-label">Approved on this visit</span>
                  <span className="ws-portal-balance__figure">
                    {formatCurrency(latestVhcJob?.vhc_authorized_total || 0)}
                  </span>
                  <span className="ws-portal-hint">{jobRef(latestVhcJob)}</span>
                </div>
              </>
            )}
          </PortalCard>

          <PortalCard eyebrow="Advisories" title="Work you asked us to hold" count={vehicleDeclinations.length}>
            <ExpandableList
              items={vehicleDeclinations}
              initial={4}
              emptyText="Nothing is waiting for your go-ahead."
              renderItem={(item, index) => (
                <li key={item.vhc_id || `${item.job_id}-${index}`} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">{item.issue_title || item.section || "Health check item"}</div>
                    {item.issue_description ? (
                      <div className="ws-portal-item-meta">{item.issue_description}</div>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => onApproveVhcItem(item, index)}>
                    Go ahead
                  </button>
                </li>
              )}
            />
          </PortalCard>
        </div>

          {vehicleMedia.length ? (
            <PortalCard eyebrow="Inspection" title="Photos and video" count={vehicleMedia.length} wide>
              <div className="ws-portal-media-grid">
                {vehicleMedia.slice(0, 12).map((item) => (
                  <a
                    key={item.id}
                    href={item.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ws-portal-media"
                  >
                    {item.media_type === "video" ? (
                      <video src={item.public_url} muted preload="metadata" className="ws-portal-media__fill" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.public_url} alt={item.context_label || ""} className="ws-portal-media__fill" />
                    )}
                    <span className="ws-portal-media__tag">{item.media_type === "video" ? "Video" : "Photo"}</span>
                    {item.context_label ? (
                      <span className="ws-portal-media__caption">{item.context_label}</span>
                    ) : null}
                  </a>
                ))}
              </div>
            </PortalCard>
          ) : null}
        </>
      ) : null}

      {section === "recalls" ? (
        <PortalCard eyebrow="Manufacturer alerts" title="Recalls" wide>
          <DetailFieldGrid>
            <DetailField label="Registration" value={vehicleReg(vehicle)} />
            <DetailField label="VIN" value={vehicle.vin} />
          </DetailFieldGrid>
          <NotAvailableYet>
            We cannot check manufacturer recalls from here yet. If you are worried about a recall, message us and
            we&apos;ll check it for you.
          </NotAvailableYet>
        </PortalCard>
      ) : null}
    </div>
  );
}
