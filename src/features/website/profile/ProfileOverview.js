// file location: src/features/website/profile/ProfileOverview.js
//
// The portal's landing view: "what do I need to know right now?".
//
// Four bands, each of which disappears when it has nothing to say:
//   1. alerts        — MOT, service, unpaid invoice, approval needed, booking
//   2. right now     — the vehicle snapshot and the live workshop visit
//   3. quick actions — the handful of things customers actually come here for
//   4. snapshot      — four figures that each open the view they belong to
//
// Every card and figure is a real button that switches portal view, so nothing
// here is a dead end. All data is passed down from src/pages/website/profile.js
// — this view never fetches.

import {
  PortalCard,
  PortalLinkCard,
  StatTile,
  ViewHeading,
} from "./ProfilePrimitives";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getJobStageLabel,
  getProgressPct,
  getTrackerStages,
  getActiveStageIndex,
  getMotState,
  invoiceRef,
  jobRef,
  vehicleReg,
  vehicleTitle,
} from "./profileUtils";

// One row in the priority strip. Built as a banner rather than a card so an
// alert reads as a notice, not as another dashboard tile.
function AlertBanner({ title, meta, actionLabel, onAction, flash }) {
  return (
    <section className="website-banner ws-portal-banner">
      <div className="ws-portal-flow">
        <span className="ws-portal-banner__title">{title}</span>
        {meta ? <span className="ws-portal-banner__meta">{meta}</span> : null}
      </div>
      {actionLabel ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </section>
  );
}

export default function ProfileOverview({
  vehicles,
  activeJob,
  motSoonest,
  serviceDue,
  outstandingInvoices,
  outstandingTotal,
  nextAppointment,
  pendingApprovals,
  messages,
  selectedVehicle,
  onSelectVehicle,
  openView,
  onBookMot,
  onBookService,
  actionFlash,
}) {
  const vehicleCount = vehicles.length;
  // The card at the top of the "right now" band: the customer's one vehicle,
  // or whichever of several is currently selected in the Vehicles view.
  const focusVehicle = selectedVehicle || vehicles[0] || null;
  const focusMot = focusVehicle ? getMotState(focusVehicle) : null;
  const stages = getTrackerStages(activeJob);
  const stageIndex = getActiveStageIndex(stages);

  const alerts = [];
  if (motSoonest) {
    alerts.push(
      <AlertBanner
        key="mot"
        title={
          motSoonest.days < 0
            ? `MOT overdue on ${vehicleReg(motSoonest.vehicle)}`
            : `MOT due in ${motSoonest.days} day${motSoonest.days === 1 ? "" : "s"} — ${vehicleReg(motSoonest.vehicle)}`
        }
        meta={`Expires ${formatDate(motSoonest.vehicle.mot_due)}`}
        actionLabel="Book MOT"
        onAction={() => onBookMot(motSoonest.vehicle)}
        flash={actionFlash.mot}
      />,
    );
  }
  if (serviceDue) {
    alerts.push(
      <AlertBanner
        key="service"
        title={`Service due — ${vehicleReg(serviceDue.vehicle)}`}
        meta={`Last service ${serviceDue.months} months ago.`}
        actionLabel="Book service"
        onAction={() => onBookService(serviceDue.vehicle)}
        flash={actionFlash.svc}
      />,
    );
  }
  if (outstandingInvoices.length) {
    alerts.push(
      <AlertBanner
        key="money"
        title={`${outstandingInvoices.length} invoice${outstandingInvoices.length === 1 ? "" : "s"} to pay`}
        meta={`${formatCurrency(outstandingTotal)} outstanding · latest ${invoiceRef(outstandingInvoices[0])}`}
        actionLabel="View invoices"
        onAction={() => openView("money")}
      />,
    );
  }
  if (pendingApprovals.length) {
    alerts.push(
      <AlertBanner
        key="vhc"
        title={`${pendingApprovals.length} repair${pendingApprovals.length === 1 ? "" : "s"} waiting for your go-ahead`}
        meta="From your last vehicle health check."
        actionLabel="Review"
        onAction={() => openView("vehicles")}
      />,
    );
  }
  if (nextAppointment) {
    alerts.push(
      <AlertBanner
        key="appointment"
        title="You have a booking coming up"
        meta={formatDateTime(nextAppointment.scheduled_time)}
        actionLabel="View booking"
        onAction={() => openView("workshop")}
      />,
    );
  }

  return (
    <div className="ws-profile-view" data-presentation="website-profile-overview">
      {alerts.length ? (
        <section className="ws-portal-split" data-presentation="website-profile-alerts">
          {alerts.slice(0, 3)}
        </section>
      ) : null}

      {/* Several vehicles: a compact picker decides which one the snapshot
          below shows. The choice is the same selectedVehicleId the Vehicles
          view uses, so switching here carries through. */}
      {vehicleCount > 1 ? (
        <div className="ws-profile-picker" data-presentation="website-profile-overview-picker">
          {vehicles.map((vehicle) => (
            <button
              key={vehicle.vehicle_id || vehicle.reg_number}
              type="button"
              className="ws-profile-chip"
              aria-pressed={Boolean(focusVehicle && vehicle.vehicle_id === focusVehicle.vehicle_id)}
              onClick={() => onSelectVehicle(vehicle)}
            >
              <span className="ws-profile-chip__reg">{vehicleReg(vehicle)}</span>
              <span className="ws-profile-chip__name">{vehicleTitle(vehicle)}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="ws-portal-split">
        {/* Vehicle snapshot — one card for one vehicle, plus a compact picker
            above it when the customer has several. */}
        {focusVehicle ? (
          <PortalLinkCard
            eyebrow={vehicleCount > 1 ? "Your vehicles" : "Your vehicle"}
            title={vehicleTitle(focusVehicle)}
            onClick={() => openView("vehicles")}
            label={`View ${vehicleTitle(focusVehicle)}, ${vehicleReg(focusVehicle)}`}
            presentation="website-profile-vehicle-snapshot"
          >
            <div className="ws-portal-action-row">
              <span className="ws-portal-badge">{vehicleReg(focusVehicle)}</span>
              {focusVehicle.year ? <span className="ws-portal-tag">{focusVehicle.year}</span> : null}
              {focusVehicle.mileage ? (
                <span className="ws-portal-tag">{Number(focusVehicle.mileage).toLocaleString("en-GB")} mi</span>
              ) : null}
            </div>
            <div className="ws-portal-action-row">
              <span className="ws-portal-badge" data-tone={focusMot.tone}>
                {focusMot.label}
              </span>
              {activeJob && activeJob.vehicle_reg === focusVehicle.reg_number ? (
                <span className="ws-portal-badge" data-tone="open">
                  With us now
                </span>
              ) : null}
            </div>
            <span className="ws-portal-hint">View vehicle →</span>
          </PortalLinkCard>
        ) : (
          <PortalCard eyebrow="Your vehicles" title="No vehicle linked yet">
            <p className="ws-portal-empty">
              Add the car you want us to look after and we&apos;ll keep its MOT, service and history here.
            </p>
            <button type="button" className="app-btn ws-portal-action-start" onClick={() => openView("vehicles")}>
              Add a vehicle
            </button>
          </PortalCard>
        )}

        {/* Live workshop visit. Nothing in the workshop means one compact line,
            not a reserved empty panel. */}
        {activeJob ? (
          <PortalLinkCard
            eyebrow="Workshop"
            title={getJobStageLabel(activeJob)}
            onClick={() => openView("workshop")}
            label="View workshop progress"
            presentation="website-profile-workshop-snapshot"
          >
            <span className="ws-portal-hint">
              {[activeJob.vehicle_make_model, activeJob.vehicle_reg, jobRef(activeJob)].filter(Boolean).join(" · ")}
            </span>
            <div className="ws-portal-progress">
              <div
                className="ws-portal-progress__fill"
                style={{ "--ws-portal-pct": `${getProgressPct(activeJob)}%` }}
              />
            </div>
            <span className="ws-portal-item-meta">
              {stages.length ? `Step ${stageIndex + 1} of ${stages.length}` : "Booked"}
            </span>
            <span className="ws-portal-hint">View workshop progress →</span>
          </PortalLinkCard>
        ) : (
          <PortalCard eyebrow="Workshop" title="Nothing with us right now">
            <p className="ws-portal-empty">
              When your car is booked in you&apos;ll be able to follow it through the workshop from here.
            </p>
            <button type="button" className="ws-portal-action-start" onClick={() => openView("services")}>
              Book a visit
            </button>
          </PortalCard>
        )}
      </div>

      {/* Quick actions — the shortcuts, not another set of cards. */}
      <section data-presentation="website-profile-quick-actions">
        <ViewHeading title="Quick actions" />
        <div className="ws-portal-services">
          <button type="button" className="ws-portal-service" onClick={() => openView("services")}>
            <span className="ws-portal-service__title">Book a service</span>
            <span className="ws-portal-service__hint">Servicing, repairs and maintenance.</span>
          </button>
          <button
            type="button"
            className="ws-portal-service"
            onClick={() => (motSoonest ? onBookMot(motSoonest.vehicle) : openView("services"))}
          >
            <span className="ws-portal-service__title">Book an MOT</span>
            <span className="ws-portal-service__hint">We&apos;ll confirm a slot by email.</span>
          </button>
          <button type="button" className="ws-portal-service" onClick={() => openView("messages")}>
            <span className="ws-portal-service__title">Message us</span>
            <span className="ws-portal-service__hint">Ask us anything about your car or account.</span>
          </button>
          <button type="button" className="ws-portal-service" onClick={() => openView("money")}>
            <span className="ws-portal-service__title">Invoices</span>
            <span className="ws-portal-service__hint">Bills, payments and statements.</span>
          </button>
          <button type="button" className="ws-portal-service" onClick={() => openView("messages")}>
            <span className="ws-portal-service__title">Documents</span>
            <span className="ws-portal-service__hint">Invoices and inspection photos.</span>
          </button>
          <button type="button" className="ws-portal-service" onClick={() => openView("services")}>
            <span className="ws-portal-service__title">Sell my car</span>
            <span className="ws-portal-service__hint">Free valuation, no obligation.</span>
          </button>
        </div>
      </section>

      {/* Account snapshot — four figures, each opening the view it belongs to. */}
      <section data-presentation="website-profile-snapshot">
        <ViewHeading title="Your account at a glance" />
        <div className="ws-profile-stats">
          <StatTile
            label={vehicleCount === 1 ? "Vehicle" : "Vehicles"}
            value={vehicleCount}
            onClick={() => openView("vehicles")}
            ariaLabel={`${vehicleCount} vehicles — open Vehicles`}
          />
          <StatTile
            label="Outstanding"
            value={formatCurrency(outstandingTotal)}
            onClick={() => openView("money")}
            ariaLabel={`${formatCurrency(outstandingTotal)} outstanding — open Money`}
          />
          <StatTile
            label="Messages"
            value={messages.length}
            onClick={() => openView("messages")}
            ariaLabel={`${messages.length} messages — open Messages`}
          />
          <StatTile
            label="Next booking"
            value={nextAppointment ? formatDate(nextAppointment.scheduled_time) : "None"}
            onClick={() => openView("workshop")}
            ariaLabel="Next booking — open Workshop"
          />
        </div>
      </section>

      {/* The old standalone Assistant section is now this one line: a route to
          a real person rather than a chat box with nothing behind it. */}
      <PortalCard eyebrow="Help" title="Need a hand?">
        <p className="ws-portal-lead">
          Not sure what your car needs, or something here does not look right? Send us a message and we&apos;ll come
          back to you.
        </p>
        <button type="button" className="app-btn ws-portal-action-start" onClick={() => openView("messages")}>
          Ask Humphries &amp; Parks
        </button>
      </PortalCard>

    </div>
  );
}
