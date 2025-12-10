// file location: src/components/HR/tabs/RecruitmentTab.js
import React from "react";
import dynamic from "next/dynamic";

const RecruitmentPage = dynamic(() => import("@/pages/hr/recruitment"), { ssr: false });

export default function RecruitmentTab() {
  return <RecruitmentPage embedded />;
}
