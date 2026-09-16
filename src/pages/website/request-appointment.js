// file location: src/pages/website/request-appointment.js
// Route for the workshop appointment request. Everything lives in the feature
// component so the page file stays a route entry (CLAUDE.md section 4.3).
//
// Server-rendered so the ?request= and ?reg= handed over by the home page quick
// actions are already in the form on first paint.
import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";
import WebsiteRouteBoundary from "@/features/website/errors/WebsiteRouteBoundary";
import RequestAppointmentPage from "@/features/website/workshop/RequestAppointmentPage";

export default function RequestAppointment({ initialQuery }) {
  return (
    <WebsiteRouteBoundary>
      <RequestAppointmentPage initialQuery={initialQuery} />
    </WebsiteRouteBoundary>
  );
}

// Opts out of the staff sidebar / topbar chrome — see CustomerWebsiteLayout.
RequestAppointment.getLayout = customerWebsiteGetLayout;

export async function getServerSideProps({ query }) {
  return { props: { initialQuery: query || {} } };
}
