// file location: src/features/websiteManager/WebsiteManager.js
// Staff-side Website Manager — single source of truth for the public /website
// content, managed from inside the logged-in staff app.
//
// Page status / SEO / media writes persist via /api/website/*. Per-section
// content writes are handled directly by PageContentPanel (which loads from
// /api/website/sections/* on demand). The Live Preview tab embeds /website
// itself in an iframe with click-to-edit overlays. The Shop tab manages the
// e-commerce catalog (Phase 4).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import Section from "@/components/Section";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { WEBSITE_PAGES, MEDIA_ASSETS, SEO_ENTRIES, INITIAL_ACTIVITY } from "./websiteData";
import { makeId } from "./helpers";
import {
  setPageStatusApi,
  updateSeoApi,
  saveMedia,
  deleteMediaApi,
  fetchPages,
  fetchSeo,
  fetchMedia,
  fetchActivity,
} from "./websiteApi";
import OverviewPanel from "./panels/OverviewPanel";
import PageContentPanel from "./panels/PageContentPanel";
import MediaPanel from "./panels/MediaPanel";
import SeoPanel from "./panels/SeoPanel";
import ActivityPanel from "./panels/ActivityPanel";
import AnalyticsPanel from "./panels/AnalyticsPanel";
import LivePreviewPanel from "./panels/LivePreviewPanel";
import ShopPanel from "./panels/ShopPanel";

const TABS = [
  { value: "overview", label: "Pages Overview" },
  { value: "content", label: "Page Content" },
  { value: "preview", label: "Live Preview" },
  { value: "shop", label: "Shop" },
  { value: "media", label: "Media Library" },
  { value: "seo", label: "SEO & Meta" },
  { value: "analytics", label: "Analytics" },
  { value: "activity", label: "Activity Log" },
];

// Initial fallback data when the API is unreachable. Once the migration is
// applied and the seed is run, useEffect below replaces these with live rows.
const seedPages = () => WEBSITE_PAGES.map((p) => ({ ...p }));
const seedSeo = () =>
  Object.fromEntries(Object.entries(SEO_ENTRIES).map(([k, v]) => [k, { ...v }]));

const VALID_TABS = TABS.map((t) => t.value);

export default function WebsiteManager() {
  const { user } = useUser();
  const router = useRouter();
  const currentUserName =
    (typeof user?.username === "string" && user.username.trim()) || "Staff User";

  // Initial tab honours ?tab=... so the sidebar / presentation can deep-link
  // directly to a sub-section ("/website-manager?tab=shop" jumps
  // straight to the Shop tab on first render).
  const initialTabFromQuery =
    typeof router.query?.tab === "string" && VALID_TABS.includes(router.query.tab)
      ? router.query.tab
      : "overview";
  const [activeTab, setActiveTab] = useState(initialTabFromQuery);
  useEffect(() => {
    if (
      typeof router.query?.tab === "string" &&
      VALID_TABS.includes(router.query.tab) &&
      router.query.tab !== activeTab
    ) {
      setActiveTab(router.query.tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query?.tab]);
  const [initialContentPage, setInitialContentPage] = useState(null);

  // Live state, primed with the seed fallback so the panel renders instantly.
  const [pages, setPages] = useState(seedPages);
  const [media, setMedia] = useState(() => MEDIA_ASSETS.map((m) => ({ ...m })));
  const [seo, setSeo] = useState(seedSeo);
  const [activity, setActivity] = useState(() => INITIAL_ACTIVITY.map((a) => ({ ...a })));

  // Load real data from the API on mount.
  useEffect(() => {
    (async () => {
      try {
        const [livePages, liveSeo, liveMedia, liveActivity] = await Promise.all([
          fetchPages().catch(() => null),
          fetchSeo().catch(() => null),
          fetchMedia().catch(() => null),
          fetchActivity().catch(() => null),
        ]);
        if (Array.isArray(livePages) && livePages.length) {
          setPages(
            livePages.map((p) => ({
              key: p.page_key,
              name: p.name,
              route: p.route,
              status: p.status,
              lastEditedBy: p.last_edited_by,
              lastEditedAt: p.last_edited_at,
            }))
          );
        }
        if (Array.isArray(liveSeo) && liveSeo.length) {
          setSeo(
            Object.fromEntries(
              liveSeo.map((row) => [
                row.page_key,
                {
                  metaTitle: row.meta_title,
                  metaDescription: row.meta_description,
                  slug: row.slug,
                  canonical: row.canonical,
                  ogImage: row.og_image,
                  indexed: row.indexed,
                },
              ])
            )
          );
        }
        if (Array.isArray(liveMedia)) {
          setMedia(
            liveMedia.map((m) => ({
              id: m.id,
              name: m.name,
              url: m.url,
              type: m.media_type,
              sizeKb: m.size_kb,
              uploadedBy: m.uploaded_by,
              uploadedAt: m.uploaded_at,
              usedOn: m.used_on,
            }))
          );
        }
        if (Array.isArray(liveActivity)) {
          setActivity(
            liveActivity.map((a) => ({
              id: String(a.id),
              action: a.action,
              target: a.target,
              page: a.page_key || "—",
              user: a.actor || "Staff",
              at: a.occurred_at,
            }))
          );
        }
      } catch {
        // Silent: the seed-fallback state already populated everything.
      }
    })();
  }, []);

  const nowIso = () => new Date().toISOString();

  const logActivity = useCallback(
    (action, target, pageName) => {
      setActivity((prev) => [
        {
          id: makeId("act"),
          action,
          target,
          page: pageName || "—",
          user: currentUserName,
          at: nowIso(),
        },
        ...prev,
      ]);
    },
    [currentUserName]
  );

  const stamp = useCallback(
    () => ({ lastEditedBy: currentUserName, lastEditedAt: nowIso() }),
    [currentUserName]
  );

  const pageName = useCallback(
    (pageKey) => pages.find((p) => p.key === pageKey)?.name || pageKey,
    [pages]
  );

  // ---- Page status -------------------------------------------------------
  const togglePageStatus = useCallback(
    (pageKey) => {
      const current = pages.find((x) => x.key === pageKey);
      const nextStatus = current?.status === "published" ? "draft" : "published";
      setPages((prev) =>
        prev.map((p) =>
          p.key === pageKey ? { ...p, status: nextStatus, ...stamp() } : p
        )
      );
      logActivity(
        `Set page status to ${nextStatus === "published" ? "Published" : "Draft"}`,
        current?.name || pageKey,
        current?.name
      );
      setPageStatusApi(pageKey, nextStatus).catch(() => {
        // eslint-disable-next-line no-console
        console.warn("[WebsiteManager] page status save failed");
      });
    },
    [pages, stamp, logActivity]
  );

  // ---- Media -------------------------------------------------------------
  const addMedia = useCallback(
    (asset) => {
      const record = {
        id: makeId("med"),
        uploadedBy: currentUserName,
        uploadedAt: nowIso(),
        usedOn: "Unassigned",
        ...asset,
      };
      setMedia((prev) => [record, ...prev]);
      logActivity("Uploaded media", record.name, record.usedOn);
      saveMedia({
        id: record.id,
        name: record.name,
        url: record.url,
        media_type: record.type || "image",
        size_kb: record.sizeKb || null,
        used_on: record.usedOn,
      }).catch(() => {});
    },
    [currentUserName, logActivity]
  );

  const replaceMedia = useCallback(
    (mediaId, asset) => {
      let snapshot = null;
      setMedia((prev) =>
        prev.map((m) => {
          if (m.id !== mediaId) return m;
          snapshot = {
            ...m,
            ...asset,
            uploadedBy: currentUserName,
            uploadedAt: nowIso(),
          };
          return snapshot;
        })
      );
      logActivity("Replaced media", snapshot?.name || "Media asset", "Media Library");
      if (snapshot) {
        saveMedia({
          id: snapshot.id,
          name: snapshot.name,
          url: snapshot.url,
          media_type: snapshot.type || "image",
          size_kb: snapshot.sizeKb || null,
          used_on: snapshot.usedOn,
        }).catch(() => {});
      }
    },
    [currentUserName, logActivity]
  );

  const deleteMedia = useCallback(
    (mediaId) => {
      const removed = media.find((m) => m.id === mediaId);
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      logActivity("Deleted media", removed?.name || "Media asset", "Media Library");
      deleteMediaApi(mediaId).catch(() => {});
    },
    [media, logActivity]
  );

  // ---- SEO ---------------------------------------------------------------
  const updateSeo = useCallback(
    (pageKey, patch) => {
      setSeo((prev) => ({ ...prev, [pageKey]: { ...prev[pageKey], ...patch } }));
      setPages((prev) =>
        prev.map((p) => (p.key === pageKey ? { ...p, ...stamp() } : p))
      );
      logActivity("Updated SEO", `${pageName(pageKey)} meta details`, pageName(pageKey));
      const apiPatch = {
        meta_title: patch.metaTitle,
        meta_description: patch.metaDescription,
        slug: patch.slug,
        canonical: patch.canonical,
        og_image: patch.ogImage,
        indexed: patch.indexed,
      };
      Object.keys(apiPatch).forEach(
        (k) => apiPatch[k] === undefined && delete apiPatch[k]
      );
      updateSeoApi(pageKey, apiPatch).catch(() => {});
    },
    [stamp, logActivity, pageName]
  );

  return (
    <>
      <Section
        title="Website Manager"
        subtitle="Add, edit, publish and monitor everything shown on the public Humphries & Parks website — without leaving the staff app."
      >
        <TabGroup
          items={TABS}
          value={activeTab}
          onChange={(value) => setActiveTab(value)}
          ariaLabel="Website Manager sections"
          layout="wrap"
        />
      </Section>

      {activeTab === "overview" && (
        <OverviewPanel
          pages={pages}
          seo={seo}
          media={media}
          activity={activity}
          onTogglePageStatus={togglePageStatus}
          onOpenPage={(pageKey) => {
            setActiveTab("content");
            setInitialContentPage(pageKey);
          }}
        />
      )}

      {activeTab === "content" && (
        <PageContentPanel
          pages={pages}
          initialPageKey={initialContentPage}
          onTogglePageStatus={togglePageStatus}
        />
      )}

      {activeTab === "preview" && <LivePreviewPanel />}

      {activeTab === "shop" && <ShopPanel />}

      {activeTab === "media" && (
        <MediaPanel
          media={media}
          onAddMedia={addMedia}
          onReplaceMedia={replaceMedia}
          onDeleteMedia={deleteMedia}
        />
      )}

      {activeTab === "seo" && (
        <SeoPanel pages={pages} seo={seo} onUpdateSeo={updateSeo} />
      )}

      {activeTab === "analytics" && <AnalyticsPanel />}

      {activeTab === "activity" && <ActivityPanel activity={activity} />}
    </>
  );
}
