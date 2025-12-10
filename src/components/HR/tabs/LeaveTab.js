// file location: src/components/HR/tabs/LeaveTab.js
import React from "react";
import dynamic from "next/dynamic";

const LeavePage = dynamic(() => import("@/pages/hr/leave"), { ssr: false });

export default function LeaveTab() {
  return <LeavePage embedded />;
}
