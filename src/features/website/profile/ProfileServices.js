// file location: src/features/website/profile/ProfileServices.js
//
// The Services view: a launcher for everything a customer can ask us to do.
// It replaces the old Book / Services / Sell / Showroom / Bodyshop / Valet /
// Parts sections, which each carried a permanent form.
//
// Nothing is a form until it is chosen. Picking a tile reveals that one panel
// underneath and hides the rest, which is what removed most of the page's
// length. Each panel submits through the page's existing action verb — the
// /api/website/actions contract is unchanged.

import Link from "next/link";
import {
  ExpandableList,
  PortalCard,
  ViewHeading,
} from "./ProfilePrimitives";
import { BookServiceForm, SellCarForm, ServiceRequestForm, ShowroomCallbackForm } from "./ProfileForms";
import { formatDate, isBodyshopRequest, isValetRequest } from "./profileUtils";

// The launcher catalogue. `kind` decides which panel opens:
//   booking  → the workshop booking form
//   request  → the generic service request form (its `action` is the verb)
//   sell     → the valuation form
//   showroom → the sales callback form
export const SERVICES = [
  {
    id: "service_mot",
    kind: "booking",
    title: "Service & MOT",
    hint: "Book servicing, maintenance or an MOT.",
  },
  {
    id: "body_repair",
    kind: "request",
    action: "request_body_repair",
    title: "Bodyshop",
    hint: "Dents, scratches and paint repairs.",
  },
  {
    id: "smart_repair",
    kind: "request",
    action: "request_smart_repair",
    title: "SMART repair",
    hint: "Small area repairs, back to you fast.",
  },
  {
    id: "valet",
    kind: "request",
    action: "request_valet",
    title: "Valet",
    hint: "Cleaning and valeting packages.",
  },
  {
    id: "parts",
    kind: "request",
    action: "request_parts_enquiry",
    title: "Parts",
    hint: "Genuine parts and accessories.",
  },
  {
    id: "warranty",
    kind: "request",
    action: "request_warranty_claim",
    title: "Warranty",
    hint: "Open a claim on your warranty.",
  },
  {
    id: "motability",
    kind: "request",
    action: "request_motability",
    title: "Motability",
    hint: "Scheme advice and applications.",
  },
  {
    id: "finance",
    kind: "request",
    action: "request_finance_quote",
    title: "Finance quote",
    hint: "PCP, HP or lease on a vehicle.",
  },
  {
    id: "test_drive",
    kind: "request",
    action: "request_test_drive",
    title: "Test drive",
    hint: "Try a model before you decide.",
  },
  {
    id: "sell",
    kind: "sell",
    title: "Sell your car",
    hint: "Free valuation, no obligation.",
  },
  {
    id: "showroom",
    kind: "showroom",
    title: "New & used cars",
    hint: "Ask about a car in stock.",
  },
];

export const isService = (id) => SERVICES.some((s) => s.id === id);

export default function ProfileServices({
  vehicles,
  bookingRequests,
  selectedService,
  onSelectService,
  onBookService,
  onServiceRequest,
  onSellCar,
  onShowroomCallback,
  actionFlash,
}) {
  const service = SERVICES.find((s) => s.id === selectedService) || null;

  // The requests already in flight for whichever service is open, so a
  // customer can see we have their last one before sending another.
  let relatedRequests = [];
  if (service?.id === "body_repair" || service?.id === "smart_repair") {
    relatedRequests = bookingRequests.filter(isBodyshopRequest);
  } else if (service?.id === "valet") {
    relatedRequests = bookingRequests.filter(isValetRequest);
  } else if (service?.kind === "booking") {
    relatedRequests = bookingRequests;
  }

  return (
    <div className="ws-profile-view" data-presentation="website-profile-services">
      <ViewHeading
        eyebrow="Services"
        title="What can we help with?"
        hint="Pick one and we'll come back to you with a time or a quote."
      />

      <div className="ws-portal-services" data-presentation="website-profile-service-launcher">
        {SERVICES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ws-portal-service"
            aria-pressed={service?.id === item.id}
            onClick={() => onSelectService(service?.id === item.id ? null : item.id)}
          >
            <span className="ws-portal-service__title">{item.title}</span>
            <span className="ws-portal-service__hint">{item.hint}</span>
          </button>
        ))}
      </div>

      {service ? (
        <PortalCard
          eyebrow={service.title}
          title={service.hint}
          action={
            <button type="button" onClick={() => onSelectService(null)}>
              Close
            </button>
          }
          presentation="website-profile-service-panel"
          wide
        >
          {service.kind === "booking" ? (
            <BookServiceForm vehicles={vehicles} onSubmit={onBookService} flash={actionFlash.book} />
          ) : null}
          {service.kind === "request" ? (
            <ServiceRequestForm
              service={service}
              vehicles={vehicles}
              onSubmit={onServiceRequest}
              flash={actionFlash.svcq}
            />
          ) : null}
          {service.kind === "sell" ? <SellCarForm onSubmit={onSellCar} flash={actionFlash.sell} /> : null}
          {service.kind === "showroom" ? (
            <>
              <ShowroomCallbackForm onSubmit={onShowroomCallback} flash={actionFlash.show} />
              <Link className="ws-portal-action-start" href="/website#cars">
                Browse all cars
              </Link>
            </>
          ) : null}

          {relatedRequests.length ? (
            <div className="ws-portal-settings-row">
              <h4 className="ws-portal-subhead">Requests you have already sent</h4>
              <ExpandableList
                items={relatedRequests}
                initial={3}
                emptyText="Nothing sent yet."
                renderItem={(r) => (
                  <li key={r.request_id} className="ws-portal-row">
                    <div>
                      <div className="ws-portal-item-title">{r.description || "Request"}</div>
                      <div className="ws-portal-item-meta">Sent {formatDate(r.submitted_at)}</div>
                    </div>
                    <span className="ws-portal-badge">{r.status || "With us"}</span>
                  </li>
                )}
              />
            </div>
          ) : null}
        </PortalCard>
      ) : null}
    </div>
  );
}
