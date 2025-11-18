// file location: src/pages/job-cards/appointments.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LegacyAppointmentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router) {
      return;
    }

    router.replace("/appointments");
  }, [router]);

  return (
    <div style={{ padding: "32px", fontFamily: "inherit" }}>
      Redirecting to the live appointments calendar...
    </div>
  );
}
