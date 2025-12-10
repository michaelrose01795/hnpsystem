// file location: src/components/HR/tabs/SettingsTab.js
import React from "react";
import dynamic from "next/dynamic";

const SettingsPage = dynamic(() => import("@/pages/hr/settings"), { ssr: false });

export default function SettingsTab() {
  return <SettingsPage embedded />;
}
