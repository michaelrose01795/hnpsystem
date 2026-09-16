import { buildCustomerReportUrl } from "@/lib/vhc/shareCode";
export { VhcLinkedCustomerPage } from "@/components/VHC/CustomerVhcPage";
export async function getServerSideProps({ params, res }) {
  res.setHeader("Cache-Control", "private, no-store");
  const { resolveSharedVhcReport } = await import("@/lib/database/vhcCustomerReport");
  const { status } = await resolveSharedVhcReport(params);
  if (status !== 200) return { notFound: true };
  return { redirect: { destination: buildCustomerReportUrl(params.linkCode), permanent: false } };
}
export const getVhcLinkServerSideProps = getServerSideProps;
export default function LegacyCustomerPage() { return null; }
