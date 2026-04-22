// file location: src/pages/tech/efficiency.js
"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import dynamic from "next/dynamic";
import TechEfficiencyPageUi from "@/components/page-ui/tech/tech-efficiency-ui"; // Extracted presentation layer.
const EfficiencyTab = dynamic(() => import("@/components/Clocking/EfficiencyTab"), { ssr: false });

export default function TechEfficiencyPage() {
  const { dbUserId } = useUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (dbUserId) setReady(true);
  }, [dbUserId]);


  const techUserId = dbUserId ? Number(dbUserId) : null;

  return <TechEfficiencyPageUi view="section1" EfficiencyTab={EfficiencyTab} ready={ready} techUserId={techUserId} />;





































}
