// file location: src/components/HR/tabs/TrainingTab.js
import React from "react";
import dynamic from "next/dynamic";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

const TrainingPage = dynamic(() => import("@/pages/hr/training"), {
  ssr: false,
  loading: () => <HrTabLoadingSkeleton />,
});

export default function TrainingTab() {
  return <TrainingPage embedded />;
}
