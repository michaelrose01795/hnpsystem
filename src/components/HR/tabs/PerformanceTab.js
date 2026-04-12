// file location: src/components/HR/tabs/PerformanceTab.js
import React from "react";
import dynamic from "next/dynamic";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

const PerformancePage = dynamic(() => import("@/pages/hr/performance"), {
  ssr: false,
  loading: () => <HrTabLoadingSkeleton />,
});

export default function PerformanceTab() {
  return <PerformancePage embedded />;
}
