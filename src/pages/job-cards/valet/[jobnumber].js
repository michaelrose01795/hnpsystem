// file location: src/pages/job-cards/valet/[jobnumber].js
"use client";

import React from "react";
import { useRouter } from "next/router";
import JobCardDetailPage from "@/pages/job-cards/[jobNumber]";
import ValetJobCardPageUi from "@/components/page-ui/job-cards/valet/job-cards-valet-jobnumber-ui"; // Extracted presentation layer.

export default function ValetJobCardPage() {
  const router = useRouter();
  const rawJobNumber = router.query?.jobnumber;
  const forcedJobNumber = Array.isArray(rawJobNumber) ? rawJobNumber[0] : rawJobNumber;

  return <ValetJobCardPageUi view="section1" forcedJobNumber={forcedJobNumber} JobCardDetailPage={JobCardDetailPage} />;
}
