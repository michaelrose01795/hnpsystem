// file location: src/components/HR/tabs/LeaveTab.js
import React from "react";
import dynamic from "next/dynamic";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

const LeavePage = dynamic(() => import("@/pages/hr/leave"), {
  ssr: false,
  loading: () => <HrTabLoadingSkeleton />,
});

export default function LeaveTab() {
  return <LeavePage embedded />;
}
