// file location: src/components/HR/tabs/DisciplinaryTab.js
import React from "react";
import dynamic from "next/dynamic";

const DisciplinaryPage = dynamic(() => import("@/pages/hr/disciplinary"), { ssr: false });

export default function DisciplinaryTab() {
  return <DisciplinaryPage embedded />;
}
