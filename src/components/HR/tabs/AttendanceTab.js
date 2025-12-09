// file location: src/components/HR/tabs/AttendanceTab.js
import React from "react";
import dynamic from "next/dynamic";
const AttendancePage = dynamic(() => import("@/pages/hr/attendance"), { ssr: false });
export default function AttendanceTab() {
  return <div><AttendancePage /></div>;
}
