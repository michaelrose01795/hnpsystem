// file location: src/pages/tech/efficiency.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import dynamic from "next/dynamic";
const EfficiencyTab = dynamic(() => import("@/components/Clocking/EfficiencyTab"), { ssr: false });

export default function TechEfficiencyPage() {
  const { user, dbUserId } = useUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (dbUserId) setReady(true);
  }, [dbUserId]);

  const techUserId = dbUserId ? Number(dbUserId) : null;

  return (
    <Layout>
      {!ready ? (
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "18px",
            padding: "32px",
            border: "1px solid var(--surface-light)",
            textAlign: "center",
            color: "var(--info)",
          }}
        >
          Loading your profile...
        </div>
      ) : (
        <EfficiencyTab
          editable={true}
          filterUserId={techUserId}
          editableUserId={techUserId}
        />
      )}
    </Layout>
  );
}
