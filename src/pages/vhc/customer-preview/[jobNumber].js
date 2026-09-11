import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { buildCustomerReportUrl } from "@/lib/vhc/shareCode";

// Staff bookmarks obtain the same guarded customer link used by Copy and Send.
export function VhcDirectCustomerPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!router.isReady || !router.query.jobNumber) return;
    let cancelled = false;
    fetch("/api/job-cards/" + encodeURIComponent(router.query.jobNumber) + "/share-link", { method: "POST" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || body.message || "Unable to open report");
        if (!cancelled) router.replace(buildCustomerReportUrl(body.linkCode));
      }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [router]);
  return <div className="app-empty-state app-empty-state--page" role="status">{error || "Opening customer report?"}</div>;
}
export default VhcDirectCustomerPage;
VhcDirectCustomerPage.getLayout = (page) => page;
VhcDirectCustomerPage.hideGlobalNotesWidget = true;
