import React from "react";
import { TabGroup } from "@/components/tabAPI/TabGroup";

export default function TabSwitcher({ activeTab, onChange, personalDisabled = false }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        alignSelf: "stretch",
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <TabGroup
          ariaLabel="Profile sections"
          value={activeTab}
          onChange={onChange}
          items={[
            { value: "work", label: "Work" },
            { value: "personal", label: "Personal" },
          ]}
        />
      </div>
      {personalDisabled ? (
        <div
          style={{
            fontSize: "0.82rem",
            color: "var(--text-secondary)",
          }}
        >
          Personal dashboard access is only available on your own profile.
        </div>
      ) : null}
    </div>
  );
}
