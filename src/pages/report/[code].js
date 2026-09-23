// file location: src/pages/report/[code].js
//
// The customer-facing VHC report link: /report/K7RM4XQP
//
// This is the URL that goes out by text message. It replaces
// /vhc/customer/<job number>/<12 mixed-case base64url chars>, which exposed the
// internal job number, ran to three path segments and was near-impossible to
// read out over the phone.
//
// It renders the SAME page component as the old route — there is no second
// implementation of the report. The only thing this file does is turn a share
// code into the { jobNumber, linkCode } pair that page already expects, using
// the unique `job_share_links.link_code` index.
//
// The old routes are deliberately still live: links already sent to customers
// must keep working until they expire.
import {
  VhcLinkedCustomerPage,
  getVhcLinkServerSideProps,
} from "@/pages/vhc/customer/[jobNumber]/[linkCode]";
import { normaliseShareCode } from "@/lib/vhc/shareCode";

export async function getServerSideProps(context) {
  const rawCode = context.params?.code || "";
  const linkCode = normaliseShareCode(rawCode);

  // Server-only — kept inside the handler so it never reaches the client bundle.
  const { resolveJobNumberForShareCode } = await import("@/lib/vhc/sharedReport");
  const jobNumber = await resolveJobNumberForShareCode(linkCode);

  if (!jobNumber) {
    // Same wording an invalid code gets on the legacy route, so the customer
    // sees one message regardless of which link shape they followed.
    context.res?.setHeader?.("Cache-Control", "private, no-store");
    return {
      props: {
        initialReport: { error: "This link is invalid or the job was not found." },
        resolvedJobNumber: null,
        resolvedLinkCode: linkCode,
      },
    };
  }

  // Reuse the legacy route's resolver verbatim — same validation, same expiry
  // handling, same viewed_at side effect, same no-store header.
  const { props } = await getVhcLinkServerSideProps({
    params: { jobNumber, linkCode },
    res: context.res,
  });

  return { props: { ...props, resolvedJobNumber: jobNumber, resolvedLinkCode: linkCode } };
}

export default function CustomerReportPage({ initialReport, resolvedJobNumber, resolvedLinkCode }) {
  return (
    <VhcLinkedCustomerPage
      accessMode="customer"
      initialReport={initialReport}
      resolvedJobNumber={resolvedJobNumber}
      resolvedLinkCode={resolvedLinkCode}
    />
  );
}

// Bypass the global app shell: customers landing on this link should see only
// the VHC content — no staff topbar, sidebar, or job tracker.
CustomerReportPage.getLayout = function publicLayout(page) {
  return page;
};
CustomerReportPage.hideGlobalNotesWidget = true;
