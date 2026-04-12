// file location: src/components/HR/tabs/DisciplinaryTab.js
import React from "react";
import dynamic from "next/dynamic";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

const DisciplinaryPage = dynamic(() => import("@/pages/hr/disciplinary"), {
  ssr: false,
  loading: () => <HrTabLoadingSkeleton />,
});

export default function DisciplinaryTab() {
  return <DisciplinaryPage embedded />;
}
