import CustomerVhcPage from "@/components/VHC/CustomerVhcPage";
import { normaliseShareCode } from "@/lib/vhc/shareCode";

export async function getServerSideProps(context) {
  context.res.setHeader("Cache-Control", "private, no-store");
  context.res.setHeader("Referrer-Policy", "no-referrer");
  context.res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const { resolveSharedVhcReport } = await import("@/lib/database/vhcCustomerReport");
  const linkCode = normaliseShareCode(context.params.code);
  try {
    const { status, body } = await resolveSharedVhcReport({ linkCode });
    return { props: {
      initialReport: status === 200 ? { payload: JSON.parse(JSON.stringify(body)) } : { error: body.error },
      resolvedJobNumber: body.jobData?.job_number || null, resolvedLinkCode: linkCode,
    } };
  } catch {
    return { props: { initialReport: { error: "Unable to load your report. Please try again." }, resolvedLinkCode: linkCode } };
  }
}

export default function CustomerReportPage(props) {
  return <CustomerVhcPage key={props.resolvedLinkCode} {...props} />;
}
CustomerReportPage.getLayout = (page) => page;
CustomerReportPage.hideGlobalNotesWidget = true;
