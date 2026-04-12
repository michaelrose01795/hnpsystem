// file location: src/components/HR/tabs/ReportsTab.js
import React from "react";
import dynamic from "next/dynamic";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

const ReportsPage = dynamic(() => import("@/pages/hr/reports"), {
  ssr: false,
  loading: () => <HrTabLoadingSkeleton />,
});

export default function ReportsTab() {
  return <ReportsPage embedded />;
}
