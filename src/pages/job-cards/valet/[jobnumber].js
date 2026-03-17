// file location: src/pages/job-cards/valet/[jobnumber].js
"use client";

import React from "react";
import { useRouter } from "next/router";
import JobCardDetailPage from "@/pages/job-cards/[jobNumber]";

export default function ValetJobCardPage() {
  const router = useRouter();
  const rawJobNumber = router.query?.jobnumber;
  const forcedJobNumber = Array.isArray(rawJobNumber) ? rawJobNumber[0] : rawJobNumber;

  return <JobCardDetailPage forcedJobNumber={forcedJobNumber} valetMode />;
}

