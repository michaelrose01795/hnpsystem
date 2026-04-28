// file location: src/pages/vhc/share/[jobNumber]/[linkCode].js
// Legacy share URL — redirected to /vhc/customer/[jobNumber]/[linkCode].
// Both server-side (for crawlers / cold loads) and client-side (in case the
// route is reached via client navigation) redirects are wired so the customer
// always lands on the canonical customer-facing URL.
import { useEffect } from "react";
import { useRouter } from "next/router";

export async function getServerSideProps({ params }) {
  const jobNumber = params?.jobNumber || "";
  const linkCode = params?.linkCode || "";
  return {
    redirect: {
      destination: `/vhc/customer/${encodeURIComponent(jobNumber)}/${encodeURIComponent(linkCode)}`,
      permanent: false,
    },
  };
}

export default function LegacyShareRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const { jobNumber, linkCode } = router.query;
    if (jobNumber && linkCode) {
      router.replace(`/vhc/customer/${jobNumber}/${linkCode}`);
    }
  }, [router.isReady, router.query, router]);
  return null;
}

// Bypass the global app shell so the brief client-side redirect doesn't
// flash the staff topbar/sidebar/job tracker.
LegacyShareRedirect.getLayout = function publicLayout(page) {
  return page;
};
