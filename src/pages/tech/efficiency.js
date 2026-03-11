// file location: src/pages/tech/efficiency.js
"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import dynamic from "next/dynamic";
const EfficiencyTab = dynamic(() => import("@/components/Clocking/EfficiencyTab"), { ssr: false });

export default function TechEfficiencyPage() {
  const { dbUserId } = useUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (dbUserId) setReady(true);
  }, [dbUserId]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.add("allow-portrait-efficiency");
    return () => {
      document.body.classList.remove("allow-portrait-efficiency");
    };
  }, []);

  const techUserId = dbUserId ? Number(dbUserId) : null;

  return (
    <Layout>
      <div className="tech-efficiency-page-shell">
        {!ready ? (
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              padding: "32px",
              border: "none",
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
      </div>
      <style jsx>{`
        .tech-efficiency-page-shell {
          width: 100%;
          min-width: 0;
        }

        @media (max-width: 430px) {
          .tech-efficiency-page-shell {
            margin-top: -4px;
          }
        }
      `}</style>
    </Layout>
  );
}
