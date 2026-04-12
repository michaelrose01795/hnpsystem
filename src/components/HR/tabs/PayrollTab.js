// file location: src/components/HR/tabs/PayrollTab.js
import React from "react";
import dynamic from "next/dynamic";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

const PayrollPage = dynamic(() => import("@/pages/hr/payroll"), {
  ssr: false,
  loading: () => <HrTabLoadingSkeleton />,
});

export default function PayrollTab() {
  return <PayrollPage embedded />;
}
