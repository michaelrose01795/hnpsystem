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
      <div style={{ background: "var(--layer-section-level-3)", padding: "40px 0", minHeight: "80vh" }}>
        <div style={{ width: "100%", padding: "0 40px" }}>
          <div style={{
            background: "var(--layer-section-level-3)",
            borderRadius: "36px",
            border: "1px solid rgba(var(--text-primary-rgb), 0.08)",
            padding: "32px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}>
            {/* Header */}
            <div style={{
              borderRadius: "28px",
              border: "1px solid var(--surface-light)",
              background: "var(--layer-section-level-2)",
              padding: "24px 32px",
            }}>
              <p style={{
                margin: 0,
                fontSize: "0.75rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--grey-accent)",
              }}>
                Workshop Efficiency
              </p>
              <h1 style={{ margin: "8px 0 0", fontSize: "2rem", color: "var(--text-primary)" }}>
                My Efficiency
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: "0.95rem", color: "var(--grey-accent)" }}>
                Track your monthly hours against targets. The Overall tab is read-only. Your own tab is editable.
              </p>
            </div>

            {/* Efficiency component */}
            {!ready ? (
              <div style={{
                background: "var(--surface)",
                borderRadius: "18px",
                padding: "32px",
                border: "1px solid var(--surface-light)",
                textAlign: "center",
                color: "var(--info)",
              }}>
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
        </div>
      </div>
    </Layout>
  );
}
