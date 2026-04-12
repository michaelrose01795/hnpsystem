// file location: src/components/HR/tabs/SettingsTab.js
import React from "react";
import dynamic from "next/dynamic";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

const SettingsPage = dynamic(() => import("@/pages/hr/settings"), {
  ssr: false,
  loading: () => <HrTabLoadingSkeleton />,
});

export default function SettingsTab() {
  return <SettingsPage embedded />;
}
