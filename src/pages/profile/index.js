import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProfileWorkTab from "@/components/profile/ProfileWorkTab";
import ProfilePersonalTab from "@/components/profile/ProfilePersonalTab";
import TabSwitcher from "@/components/profile/TabSwitcher";
import useIsMobile from "@/hooks/useIsMobile";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

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
  const [headerActions, setHeaderActions] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setHeaderActions(null);
  }, [activeTab]);

  const content = (
    <DevLayoutSection
      sectionKey="profile-page-content"
      sectionType="page-shell"
      shell
      style={{
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? "12px" : "18px",
        padding: isEmbedded ? "0" : isMobile ? "12px" : "24px",
      }}
    >
      <DevLayoutSection
        sectionKey="profile-tab-toolbar"
        parentKey="profile-page-content"
        sectionType="toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <DevLayoutSection sectionKey="profile-tab-switcher" parentKey="profile-tab-toolbar" sectionType="tab-row">
          <TabSwitcher
            activeTab={activeTab}
            onChange={(nextTab) => {
              if (nextTab === "personal" && personalDisabled) return;
              setActiveTab(nextTab);
            }}
            personalDisabled={personalDisabled}
          />
        </DevLayoutSection>
        <DevLayoutSection sectionKey="profile-tab-actions" parentKey="profile-tab-toolbar" sectionType="toolbar">
          <div style={{ marginLeft: "auto" }}>{headerActions}</div>
        </DevLayoutSection>
      </DevLayoutSection>

      <DevLayoutSection sectionKey="profile-active-tab-panel" parentKey="profile-page-content" sectionType="section-shell" shell>
        {activeTab === "work" ? (
          <ProfileWorkTab
            forcedUserName={forcedUserName}
            embeddedOverride
            adminPreviewOverride={adminPreviewOverride}
            onHeaderActionsChange={setHeaderActions}
          />
        ) : (
          <ProfilePersonalTab
            disabled={personalDisabled}
            onHeaderActionsChange={setHeaderActions}
          />
        )}
      </DevLayoutSection>
    </DevLayoutSection>
  );

  return isEmbedded ? content : <Layout>{content}</Layout>;
}

export default function ProfilePageWrapper(props) {
  return <ProfilePage {...props} />;
}
