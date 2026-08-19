// file location: src/pages/tech/efficiency.js
"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import dynamic from "next/dynamic";
import TechEfficiencyPageUi, { TechEfficiencyRouteSkeleton } from "@/components/page-ui/tech/tech-efficiency-ui"; // Extracted presentation layer.
import {
  MOBILE_TECH_ROLES,
  TECHNICIAN_ROLES,
  normalizeRoles,
} from "@/lib/auth/roles";
const EfficiencyTab = dynamic(() => import("@/components/Clocking/EfficiencyTab"), {
  ssr: false,
  loading: () => <TechEfficiencyRouteSkeleton />,
});
const TECHNICIAN_ROLE_SET = new Set(
  normalizeRoles([...TECHNICIAN_ROLES, ...MOBILE_TECH_ROLES])
);

export default function TechEfficiencyPage() {
  const { dbUserId, user } = useUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (dbUserId) setReady(true);
  }, [dbUserId]);


  const techUserId = dbUserId ? Number(dbUserId) : null;
  const normalizedUserRoles = normalizeRoles(user?.roles || []);
  const isTechnicianOnly =
    normalizedUserRoles.length > 0 &&
    normalizedUserRoles.every((role) => TECHNICIAN_ROLE_SET.has(role));
  const canViewWorkshop = !isTechnicianOnly;

  return <TechEfficiencyPageUi
    view="section1"
    EfficiencyTab={EfficiencyTab}
    ready={ready}
    techUserId={techUserId}
    canViewWorkshop={canViewWorkshop}
  />;





































}
