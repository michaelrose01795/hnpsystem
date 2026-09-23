import { buildCustomerReportUrl, normaliseShareCode } from "@/lib/vhc/shareCode";
export async function getServerSideProps({ params, res }) {
  res.setHeader("Cache-Control", "private, no-store");
  return { redirect: { destination: buildCustomerReportUrl(normaliseShareCode(params.code)), permanent: false } };
}
export default function LegacyReportPage() { return null; }
