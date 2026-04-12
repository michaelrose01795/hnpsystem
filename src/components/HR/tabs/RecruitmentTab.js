// file location: src/components/HR/tabs/RecruitmentTab.js
import React from "react";
import dynamic from "next/dynamic";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

const RecruitmentPage = dynamic(() => import("@/pages/hr/recruitment"), {
  ssr: false,
  loading: () => <HrTabLoadingSkeleton />,
});

export default function RecruitmentTab() {
  return <RecruitmentPage embedded />;
}
