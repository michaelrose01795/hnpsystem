// file location: src/components/HR/tabs/TrainingTab.js
import React from "react";
import dynamic from "next/dynamic";

const TrainingPage = dynamic(() => import("@/pages/hr/training"), { ssr: false });

export default function TrainingTab() {
  return <TrainingPage embedded />;
}
