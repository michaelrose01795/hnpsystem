import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProfileWorkTab from "@/components/profile/ProfileWorkTab";
import ProfilePersonalTab from "@/components/profile/ProfilePersonalTab";
import TabSwitcher from "@/components/profile/TabSwitcher";

export function ProfilePage({
  forcedUserName = null,
  embeddedOverride = null,
  adminPreviewOverride = null,
} = {}) {
  const router = useRouter();
  const isEmbeddedQuery = router.query.embedded === "1";
  const isEmbedded = embeddedOverride ?? isEmbeddedQuery;
  const initialTab = useMemo(() => {
    if (router.query.tab === "personal") return "personal";
    return "work";
  }, [router.query.tab]);
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const isAdminPreviewQuery = router.query.adminPreview === "1";
  const isAdminPreview = adminPreviewOverride ?? isAdminPreviewQuery;
  const isPreviewingAnotherUser = Boolean(forcedUserName || isAdminPreview);
  const personalDisabled = isPreviewingAnotherUser;
  const [personalHeaderActions, setPersonalHeaderActions] = useState(null);

  useEffect(() => {
    if (activeTab !== "personal") {
      setPersonalHeaderActions(null);
    }
  }, [activeTab]);

  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        padding: isEmbedded ? "0" : "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <TabSwitcher
          activeTab={activeTab}
          onChange={(nextTab) => {
            if (nextTab === "personal" && personalDisabled) return;
            setActiveTab(nextTab);
          }}
          personalDisabled={personalDisabled}
          />
        <div style={{ marginLeft: "auto" }}>{activeTab === "personal" ? personalHeaderActions : null}</div>
      </div>

      {activeTab === "work" ? (
        <ProfileWorkTab
          forcedUserName={forcedUserName}
          embeddedOverride
          adminPreviewOverride={adminPreviewOverride}
        />
      ) : (
        <ProfilePersonalTab
          disabled={personalDisabled}
          onHeaderActionsChange={setPersonalHeaderActions}
        />
      )}
    </div>
  );

  return isEmbedded ? content : <Layout>{content}</Layout>;
}

export default function ProfilePageWrapper(props) {
  return <ProfilePage {...props} />;
}
