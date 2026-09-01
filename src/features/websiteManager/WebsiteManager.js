// file location: src/features/websiteManager/WebsiteManager.js
// Staff-side Website Manager — single source of truth for the public /website
// content, managed from inside the logged-in staff app.
//
// Page status / SEO / media writes persist via /api/website/*. Per-section
// content writes are handled directly by PageContentPanel (which loads from
// /api/website/sections/* on demand). The Visual editor tab embeds /website
// itself in an iframe with click-to-edit overlays, and the Design & layout tab
// edits the site chrome (top bar, block running order, visual design) through
// the website_nav / website_section_layout / website_design tables. The Shop
// tab manages the e-commerce catalogue.
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import Button from "@/components/ui/Button";
import StaffPageHeader from "@/components/ui/StaffPageHeader";
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
import DesignPanel from "./panels/DesignPanel";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "preview", label: "Visual editor" },
  { value: "content", label: "Pages & sections" },
  { value: "design", label: "Design & layout" },
  { value: "shop", label: "Shop" },
  { value: "media", label: "Media" },
  { value: "seo", label: "SEO" },
  { value: "analytics", label: "Analytics" },
  { value: "activity", label: "Activity" },
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
        if ([livePages, liveSeo, liveMedia, liveActivity].every((result) => result === null)) {
          setLoadError("Live website data could not be loaded. Showing fallback content.");
        }
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
        setLoadError("Live website data could not be loaded. Showing fallback content.");
      } finally {
        setLoading(false);
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
    async (pageKey) => {
      const current = pages.find((x) => x.key === pageKey);
      if (!current) return;
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
      try {
        await setPageStatusApi(pageKey, nextStatus);
      } catch {
        setPages((prev) => prev.map((p) => (p.key === pageKey ? current : p)));
        setLoadError(`The ${current.name} publish status could not be saved.`);
      }
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
    <main className="app-page-shell website-manager">
      <div className="app-page-stack">
        <StaffPageHeader
          title="Website manager"
          actions={
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.open("/website", "_blank", "noopener,noreferrer")}
            >
              Open live website
            </Button>
          }
        />

        {/* The tab strip paints its own container background, so it sits
            directly on the page stack — wrapping it in a card surface would
            stack two surfaces (CLAUDE.md §3.0) and read as a boxed-in strip
            that no other staff page has. */}
        <div className="website-manager__tabs">
          <TabGroup
            items={TABS}
            value={activeTab}
            onChange={(value) => {
              setActiveTab(value);
              router.replace(
                { pathname: router.pathname, query: { ...router.query, tab: value } },
                undefined,
                { shallow: true, scroll: false }
              );
            }}
            ariaLabel="Website Manager sections"
          />
        </div>

        {(loading || loadError) && (
          <div
            className={`website-manager__notice${loadError ? " website-manager__notice--warning" : ""}`}
            role={loadError ? "alert" : "status"}
          >
            {loadError || "Loading live website data…"}
          </div>
        )}

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

        {activeTab === "design" && <DesignPanel />}

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
      </div>
    </main>
  );
}
