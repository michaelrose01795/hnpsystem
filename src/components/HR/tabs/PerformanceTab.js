// file location: src/components/HR/tabs/PerformanceTab.js
import React from "react";
import dynamic from "next/dynamic";
const PerformancePage = dynamic(() => import("@/pages/hr/performance"), { ssr: false });
export default function PerformanceTab() {
  return <div><PerformancePage /></div>;
}
