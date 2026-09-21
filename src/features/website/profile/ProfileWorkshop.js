// file location: src/features/website/profile/ProfileWorkshop.js
//
// The Workshop view: what is happening to the customer's car now, what is
// booked next, and what happened before. It absorbs the old Tracker, Repair
// approval timeline, Jobs and Appointments sections.
//
// The stage calculation is the shared one in profileUtils (getTrackerStages),
// so this tracker and the Overview progress card can never disagree. Previous
// visits open at three rows and expand on request.

import {
  DetailField,
  DetailFieldGrid,
  ExpandableList,
  NotificationDot,
  PortalCard,
  ViewHeading,
} from "./ProfilePrimitives";
import { ActiveJobTags } from "./ProfileForms";
import {
  formatDate,
  formatDateTime,
  getActiveStageIndex,
  getJobStageLabel,
  getTrackerStages,
  isCompletedJob,
  jobLastUpdate,
  jobRef,
  jobVehicleLine,
  partTitle,
} from "./profileUtils";
import { normalizeContactPreference } from "@/lib/customers/contactPreference";

export default function ProfileWorkshop({
  customer,
  activeJob,
  jobs,
  appointments,
  bookingRequests,
  jobStatusHistory,
  vhcByJob,
  vhcSendHistory,
  partsJobItems,
  partsOrderCards,
  openView,
}) {
  const stages = getTrackerStages(activeJob);
  const activeIndex = getActiveStageIndex(stages);
  const bookingForJob = activeJob ? bookingRequests.find((r) => r.job_id === activeJob.id) : null;
  const vhcSent = activeJob ? (vhcSendHistory || []).find((s) => s.job_id === activeJob.id) : null;
  const history = activeJob ? jobStatusHistory.filter((row) => row.job_id === activeJob.id) : [];

  const contactPreference = normalizeContactPreference(customer?.contact_preference);
  const smsEnabled = ["sms", "mobile"].includes(contactPreference) || Boolean(customer?.mobile);
  const emailEnabled = contactPreference === "email" || Boolean(customer?.email);

  const upcoming = appointments
    .filter((a) => {
      const t = new Date(a.scheduled_time).getTime();
      return Number.isFinite(t) && t >= Date.now() - 1000 * 60 * 60 * 12;
    })
    .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
  const pendingRequests = bookingRequests.filter(
    (r) => !["cancelled", "rejected"].includes(String(r.status || "").toLowerCase()),
  );
  const previous = jobs.filter(isCompletedJob);
  const openParts = partsJobItems.filter(
    (item) => !String(item.status || "").toLowerCase().includes("fitted"),
  );

  return (
    <div className="ws-profile-view" data-presentation="website-profile-workshop">
      <ViewHeading eyebrow="Workshop" title="Your current visit" />

      {activeJob ? (
        <PortalCard
          eyebrow={jobRef(activeJob)}
          title={getJobStageLabel(activeJob)}
          action={
            <button type="button" onClick={() => openView("messages")}>
              Message us
            </button>
          }
          presentation="website-profile-workshop-tracker"
          wide
        >
          <p className="ws-portal-hint">{jobVehicleLine(activeJob)}</p>
          <ActiveJobTags job={activeJob} bookingRequest={bookingForJob} vhcSent={vhcSent} />

          <div className="ws-portal-tracker" style={{ "--ws-portal-steps": String(stages.length) }}>
            {stages.map((stage, idx) => {
              const state = idx < activeIndex ? "done" : idx === activeIndex && stage.reached ? "active" : "todo";
              return (
                <div key={stage.key} className="ws-portal-step" data-state={state}>
                  <span className="ws-portal-step__dot" />
                  <span>{stage.label}</span>
                </div>
              );
            })}
          </div>

          <DetailFieldGrid>
            <DetailField label="Vehicle" value={activeJob.vehicle_reg || activeJob.vehicle_make_model} />
            <DetailField label="Booked in" value={formatDate(activeJob.created_at)} />
            <DetailField label="What we're doing" value={activeJob.type || activeJob.description} />
            <DetailField label="Last update" value={formatDateTime(jobLastUpdate(activeJob))} />
            {activeJob.service_postcode ? (
              <DetailField label="Mobile visit at" value={activeJob.service_postcode} />
            ) : null}
          </DetailFieldGrid>

          {/* Stage-by-stage times, from the job's own status history. */}
          <ul className="ws-portal-list">
            {stages.map((stage) => {
              const matching = history.find((row) =>
                String(row.to_status || "").toLowerCase().includes(stage.key.replace("_", " ")),
              );
              return (
                <li key={stage.key} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">{stage.label}</div>
                    {matching?.reason ? <div className="ws-portal-item-meta">{matching.reason}</div> : null}
                  </div>
                  <span className="ws-portal-when">
                    {stage.reached ? formatDateTime(matching?.changed_at || jobLastUpdate(activeJob)) : "To come"}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="ws-portal-tile">
            <h4 className="ws-portal-subhead">How we&apos;ll keep you posted</h4>
            <div className="ws-portal-action-row">
              <NotificationDot enabled={smsEnabled} label="Text message" />
              <NotificationDot enabled={emailEnabled} label="Email" />
            </div>
          </div>
        </PortalCard>
      ) : (
        <PortalCard eyebrow="Workshop" title="Nothing with us at the moment">
          <p className="ws-portal-empty">
            When your car is booked in, you&apos;ll be able to follow it through every stage from here.
          </p>
          <button type="button" className="app-btn ws-portal-action-start" onClick={() => openView("services")}>
            Book a visit
          </button>
        </PortalCard>
      )}

      {openParts.length ? (
        <PortalCard eyebrow="Parts" title="Parts on order for your visit" count={openParts.length}>
          <ExpandableList
            items={openParts}
            initial={3}
            emptyText="No parts are on order."
            renderItem={(item) => (
              <li key={item.id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{partTitle(item)}</div>
                  <div className="ws-portal-item-meta">
                    Qty {item.quantity_requested || 1} · expected {formatDate(item.eta_date)}
                  </div>
                </div>
                <span className="ws-portal-badge" data-tone="open">
                  {item.status || "On order"}
                </span>
              </li>
            )}
          />
        </PortalCard>
      ) : null}

      {partsOrderCards.length ? (
        <PortalCard eyebrow="Deliveries" title="Parts deliveries" count={partsOrderCards.length}>
          <ExpandableList
            items={partsOrderCards}
            initial={3}
            emptyText="No deliveries are on their way."
            renderItem={(order) => (
              <li key={order.id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{order.order_number || "Parts order"}</div>
                  <div className="ws-portal-item-meta">
                    {[order.vehicle_reg, `expected ${formatDate(order.delivery_eta)}`, order.delivery_window]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span
                  className="ws-portal-badge"
                  data-tone={String(order.delivery_status || "").includes("delivered") ? "ok" : "open"}
                >
                  {order.delivery_status || order.status || "On the way"}
                </span>
              </li>
            )}
          />
        </PortalCard>
      ) : null}

      <ViewHeading eyebrow="Diary" title="Coming up" />
      <div className="ws-portal-split">
        <PortalCard eyebrow="Bookings" title="Your next visits" count={upcoming.length}>
          <ExpandableList
            items={upcoming}
            initial={3}
            emptyText="You have no bookings in the diary."
            renderItem={(a) => (
              <li key={a.appointment_id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{formatDateTime(a.scheduled_time)}</div>
                  <div className="ws-portal-item-meta">{a.status || "Booked"}</div>
                </div>
              </li>
            )}
          />
        </PortalCard>

        <PortalCard eyebrow="Requests" title="Requests with us" count={pendingRequests.length}>
          <ExpandableList
            items={pendingRequests}
            initial={3}
            emptyText="You have no open requests."
            renderItem={(r) => (
              <li key={r.request_id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{r.description || "Booking request"}</div>
                  <div className="ws-portal-item-meta">
                    {[
                      `Sent ${formatDate(r.submitted_at)}`,
                      r.estimated_completion ? `ready by ${formatDate(r.estimated_completion)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span className="ws-portal-badge">{r.status || "With us"}</span>
              </li>
            )}
          />
        </PortalCard>
      </div>

      <ViewHeading eyebrow="History" title="Previous visits" hint="Your three most recent visits, with the rest a tap away." />
      <PortalCard wide presentation="website-profile-workshop-history">
        <ExpandableList
          items={previous}
          initial={3}
          moreLabel="View all visits"
          emptyText="We have not completed a visit for you yet."
          renderItem={(job) => {
            const vhc = vhcByJob[job.id];
            return (
              <li key={job.id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">
                    {[jobRef(job), job.type || job.description].filter(Boolean).join(" · ")}
                  </div>
                  <div className="ws-portal-item-meta">{jobVehicleLine(job)}</div>
                  <div className="ws-portal-item-meta ws-portal-item-meta--spaced">
                    {formatDate(job.completed_at || job.created_at)}
                  </div>
                  {vhc ? (
                    <div className="ws-portal-action-row ws-portal-spaced">
                      {vhc.red ? (
                        <span className="ws-portal-light" data-tone="red">
                          <span className="ws-portal-light__dot" />
                          {vhc.red}
                        </span>
                      ) : null}
                      {vhc.amber ? (
                        <span className="ws-portal-light" data-tone="amber">
                          <span className="ws-portal-light__dot" />
                          {vhc.amber}
                        </span>
                      ) : null}
                      {vhc.green ? (
                        <span className="ws-portal-light" data-tone="green">
                          <span className="ws-portal-light__dot" />
                          {vhc.green}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <span className="ws-portal-badge" data-tone="ok">
                  Complete
                </span>
              </li>
            );
          }}
        />
      </PortalCard>
    </div>
  );
}
