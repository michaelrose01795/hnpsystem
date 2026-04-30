// file location: src/pages/profile/index.js
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ProfileWorkTab from "@/components/profile/ProfileWorkTab";
import ProfilePersonalTab from "@/components/profile/ProfilePersonalTab";
import TabSwitcher from "@/components/profile/TabSwitcher";
import useIsMobile from "@/hooks/useIsMobile";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { ACCENT_PALETTES, useTheme } from "@/styles/themeProvider";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import Button from "@/components/ui/Button";
import ProfilePageWrapperUi from "@/components/page-ui/profile/profile-ui"; // Extracted presentation layer.

const SAFE_ACCENT_PALETTES =
ACCENT_PALETTES && typeof ACCENT_PALETTES === "object" ?
ACCENT_PALETTES :
{
  red: { label: "Red", light: "#dc2626", dark: "#f87171" }
};

function AccentOptionContent({ label, light, dark }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        minWidth: 0
      }}>
      
      <span
        aria-hidden="true"
        style={{
          width: "12px",
          height: "12px",
          borderRadius: "var(--radius-pill)",
          border: "1px solid rgba(var(--text-primary-rgb), 0.2)",
          background: light,
          flexShrink: 0
        }} />
      
      <span
        style={{
          fontWeight: 700,
          color: dark,
          lineHeight: 1.1
        }}>
        
        {label}
      </span>
    </span>);

}

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
  const isMobile = useIsMobile();
  const { mode: themeMode, resolvedMode, toggleTheme, accent, setAccent } = useTheme();
  const isWorkTab = activeTab === "work";

  useEffect(() => {
    setHeaderActions(null);
  }, [activeTab]);

  const themeLabel = useMemo(() => {
    if (themeMode === "system") {
      return `System (${resolvedMode === "dark" ? "dark" : "light"})`;
    }
    return themeMode === "dark" ? "Dark mode" : "Light mode";
  }, [resolvedMode, themeMode]);

  const accentOptions = useMemo(
    () =>
    Object.entries(SAFE_ACCENT_PALETTES).map(([value, palette]) => ({
      value,
      label: <AccentOptionContent label={palette.label} light={palette.light} dark={palette.dark} />
    })),
    []
  );

  const content =
  <div className={isEmbedded ? undefined : "max-w-3xl mx-auto px-6 py-8"} style={isEmbedded ? undefined : { width: "100%" }}>
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
        
          <DevLayoutSection sectionKey="profile-tab-switcher" parentKey="profile-tab-toolbar" sectionType="tab-row">
            <TabSwitcher
            activeTab={activeTab}
            onChange={(nextTab) => {
              if (nextTab === "personal" && personalDisabled) return;
              setActiveTab(nextTab);
            }}
            personalDisabled={personalDisabled} />
          
          </DevLayoutSection>
          <DevLayoutSection sectionKey="profile-account-links" parentKey="profile-tab-toolbar" sectionType="toolbar">
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              flexWrap: "wrap"
            }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="app-btn--control"
                onClick={() => router.push("/account/security")}
              >
                Security
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="app-btn--control"
                onClick={() => router.push("/profile/privacy")}
              >
                Privacy
              </Button>
            </div>
          </DevLayoutSection>
          <DevLayoutSection sectionKey="profile-tab-actions" parentKey="profile-tab-toolbar" sectionType="toolbar">
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {isWorkTab ?
            <div style={{ minWidth: "170px", width: "170px" }}>
                  <DropdownField
                value={accent}
                onValueChange={setAccent}
                options={accentOptions}
                className="profile-accent-dropdown"
                size="sm" />
              
                </div> :
            null}
              {isWorkTab ?
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="app-btn--control"
              onClick={toggleTheme}
              aria-label="Cycle theme">
              
                  {themeLabel}
                </Button> :
            null}
              {headerActions}
            </div>
          </DevLayoutSection>
        </DevLayoutSection>

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
    </div>;


  return content;
}

export default function ProfilePageWrapper(props) {
  return <ProfilePageWrapperUi view="section1" ProfilePage={ProfilePage} props={props} />;
}
