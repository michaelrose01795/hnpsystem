// file location: src/pages/job-cards/appointments.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";
import LegacyAppointmentsRedirectPageUi from "@/components/page-ui/job-cards/job-cards-appointments-ui"; // Extracted presentation layer.

export default function LegacyAppointmentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router) {
      return;
    }

    router.replace("/appointments");
  }, [router]);

  return <LegacyAppointmentsRedirectPageUi view="section1" />;
}
