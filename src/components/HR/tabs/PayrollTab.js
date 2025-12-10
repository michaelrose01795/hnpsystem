// file location: src/components/HR/tabs/PayrollTab.js
import React from "react";
import dynamic from "next/dynamic";

const PayrollPage = dynamic(() => import("@/pages/hr/payroll"), { ssr: false });

export default function PayrollTab() {
  return <PayrollPage embedded />;
}
