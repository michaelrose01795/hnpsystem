// file location: src/pages/job-cards/appointments.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";
import LegacyAppointmentsRedirectPageUi from "@/components/page-ui/job-cards/job-cards-appointments-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";

export default function LegacyAppointmentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (isPresentationMode()) return;
    if (!router) {
      return;
    }

    router.replace("/appointments");
  }, [router]);

  return <LegacyAppointmentsRedirectPageUi view="section1" />;
}
