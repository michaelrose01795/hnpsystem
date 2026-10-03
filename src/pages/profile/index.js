// file location: src/pages/profile/index.js
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ProfileWorkTab from "@/components/profile/ProfileWorkTab";
import ProfilePersonalTab from "@/components/profile/ProfilePersonalTab";
import TabSwitcher from "@/components/profile/TabSwitcher";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import Button from "@/components/ui/Button";
import ProfileThemeControls from "@/components/profile/ProfileThemeControls";
import ProfilePageWrapperUi from "@/components/page-ui/profile/profile-ui"; // Extracted presentation layer.
import PopupModal from "@/components/popups/popupStyleApi";
import { SecurityPanel } from "@/pages/security";
import { PrivacyPanel } from "@/pages/profile/privacy";
import { DesktopAppPanel } from "@/components/profile/DesktopAppCard"; // Desktop installer download popup
import TypingAssistPanel from "@/components/profile/TypingAssistPanel"; // Spelling / grammar / prediction settings popup

export function ProfilePage({
  forcedUserName = null,
  embeddedOverride = null,
  adminPreviewOverride = null
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
  const [openPanel, setOpenPanel] = useState(null);
  const isWorkTab = activeTab === "work";

  useEffect(() => {
    setHeaderActions(null);
  }, [activeTab]);

  const content =
  <div className={isEmbedded ? undefined : "max-w-3xl mx-auto px-6 py-8"} style={isEmbedded ? undefined : { width: "100%" }}>
      {/* Profile page: the tab bar and account shortcuts at the top, with the selected profile tab below. */}
      <DevLayoutSection
      sectionKey="profile-page-content"
      sectionType="page-shell"
      shell
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "0"
      }}>
      
        {/* Top bar: the work/personal tab switcher, account shortcut buttons and theme controls. */}
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
          width: "100%"
        }}>
        
          {/* Tab switcher between the Work and Personal profile views. */}
          <DevLayoutSection sectionKey="profile-tab-switcher" parentKey="profile-tab-toolbar" sectionType="tab-row">
            <TabSwitcher
            activeTab={activeTab}
            onChange={(nextTab) => {
              if (nextTab === "personal" && personalDisabled) return;
              setActiveTab(nextTab);
            }}
            personalDisabled={personalDisabled} />
          
          </DevLayoutSection>
          {isWorkTab ? (
            // Account shortcuts: buttons that open the Security, Privacy, Desktop App and Typing settings popups.
            <DevLayoutSection sectionKey="profile-account-links" parentKey="profile-tab-toolbar" sectionType="toolbar">
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--button-gap)",
                flexWrap: "wrap"
              }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpenPanel("security")}
                >
                  Security
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpenPanel("privacy")}
                >
                  Privacy
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpenPanel("desktop-app")}
                >
                  Desktop App
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpenPanel("typing")}
                >
                  Typing
                </Button>
              </div>
            </DevLayoutSection>
          ) : null}
          {/* Tab actions: theme controls plus any buttons supplied by the active tab. */}
          <DevLayoutSection sectionKey="profile-tab-actions" parentKey="profile-tab-toolbar" sectionType="toolbar">
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <ProfileThemeControls visible={isWorkTab} />
              {headerActions}
            </div>
          </DevLayoutSection>
        </DevLayoutSection>

        {/* The selected tab's content: either the work profile or the personal profile. */}
        <DevLayoutSection sectionKey="profile-active-tab-panel" parentKey="profile-page-content" sectionType="section-shell" shell style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: 0
        }}>
          {activeTab === "work" ?
        <ProfileWorkTab
          forcedUserName={forcedUserName}
          embeddedOverride
          adminPreviewOverride={adminPreviewOverride}
          onHeaderActionsChange={setHeaderActions} /> :


        <ProfilePersonalTab
          disabled={personalDisabled}
          onHeaderActionsChange={setHeaderActions} />

        }
        </DevLayoutSection>
      </DevLayoutSection>
      {/* Security settings popup, opened from the profile page. */}
      <PopupModal
        isOpen={openPanel === "security"}
        onClose={() => setOpenPanel(null)}
        ariaLabel="Security settings"
      >
        {/* Security settings, shown in a popup. */}
        <SecurityPanel />
      </PopupModal>
      {/* Privacy settings popup, opened from the profile page. */}
      <PopupModal
        isOpen={openPanel === "privacy"}
        onClose={() => setOpenPanel(null)}
        ariaLabel="Privacy settings"
      >
        {/* Privacy settings, shown in a popup. */}
        <PrivacyPanel />
      </PopupModal>
      {/* Desktop app popup: details for downloading the desktop version of the system. */}
      <PopupModal
        isOpen={openPanel === "desktop-app"}
        onClose={() => setOpenPanel(null)}
        ariaLabel="Desktop app download"
      >
        {/* Desktop app download details, shown in a popup. */}
        <DesktopAppPanel onClose={() => setOpenPanel(null)} />
      </PopupModal>
      {/* Typing assistant settings popup, opened from the profile page. */}
      <PopupModal
        isOpen={openPanel === "typing"}
        onClose={() => setOpenPanel(null)}
        ariaLabel="Typing assistant settings"
      >
        {/* Typing assistant settings, shown in a popup. */}
        <TypingAssistPanel />
      </PopupModal>
    </div>;


  return content;
}

export default function ProfilePageWrapper(props) {
  return <ProfilePageWrapperUi view="section1" ProfilePage={ProfilePage} props={props} />;
}
