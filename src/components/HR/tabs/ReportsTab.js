// file location: src/components/HR/tabs/ReportsTab.js
import React from "react";
import dynamic from "next/dynamic";
const ReportsPage = dynamic(() => import("@/pages/hr/reports"), { ssr: false });
export default function ReportsTab() {
  return <div><ReportsPage /></div>;
}
