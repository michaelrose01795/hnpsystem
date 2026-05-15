// file location: src/features/websiteManager/WebsiteManager.js
// Staff-side Website Manager — single source of truth for the public /website
// content, managed from inside the logged-in staff app.
//
// This component owns ALL website-content state and the mutation handlers.
// Each tab is a thin presentational panel under ./panels that receives the
// slice of state it needs plus the handlers it can call.
//
// The initial state is REAL content — sourced from the live /website data
// modules via ./websiteData (which adapts src/singlescroll/data/*). Mutations
// below update local React state only; each leaves a TODO marking the write
// path / API call that should persist it. The real /website pages are never
// touched by this tool.
import React, { useCallback, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import Section from "@/components/Section";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import {
  WEBSITE_PAGES,
  PAGE_CONTENT,
  MEDIA_ASSETS,
  SEO_ENTRIES,
  INITIAL_ACTIVITY,
} from "./websiteData";
import { makeId } from "./helpers";
import OverviewPanel from "./panels/OverviewPanel";
import PageContentPanel from "./panels/PageContentPanel";
import MediaPanel from "./panels/MediaPanel";
import SeoPanel from "./panels/SeoPanel";
import ActivityPanel from "./panels/ActivityPanel";
import AnalyticsPanel from "./panels/AnalyticsPanel";

const TABS = [
  { value: "overview", label: "Pages Overview" },
  { value: "content", label: "Page Content" },
  { value: "media", label: "Media Library" },
  { value: "seo", label: "SEO & Meta" },
  { value: "analytics", label: "Analytics" },
  { value: "activity", label: "Activity Log" },
];

// Deep-ish clone of the seed maps so editing never mutates the imported module.
const clonePages = () => WEBSITE_PAGES.map((p) => ({ ...p }));
const cloneContent = () =>
  Object.fromEntries(
    Object.entries(PAGE_CONTENT).map(([k, blocks]) => [k, blocks.map((b) => ({ ...b }))])
  );
const cloneSeo = () =>
  Object.fromEntries(Object.entries(SEO_ENTRIES).map(([k, v]) => [k, { ...v }]));

export default function WebsiteManager() {
  const { user } = useUser();
  const currentUserName =
    (typeof user?.username === "string" && user.username.trim()) || "Staff User";

  const [activeTab, setActiveTab] = useState("overview");
  // When the user clicks "Manage" on a page in the Overview tab, this carries
  // the chosen page key across to the Page Content tab as its initial selection.
  const [initialContentPage, setInitialContentPage] = useState(null);

  // ---- Website-content state (mock) -------------------------------------
  const [pages, setPages] = useState(clonePages);
  const [content, setContent] = useState(cloneContent);
  const [media, setMedia] = useState(() => MEDIA_ASSETS.map((m) => ({ ...m })));
  const [seo, setSeo] = useState(cloneSeo);
  const [activity, setActivity] = useState(() => INITIAL_ACTIVITY.map((a) => ({ ...a })));

  const nowIso = () => new Date().toISOString();

  // Prepend an entry to the activity log. Called by every mutation handler.
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

  // Stamp a record with the current editor + timestamp.
  const stamp = useCallback(
    () => ({ lastEditedBy: currentUserName, lastEditedAt: nowIso() }),
    [currentUserName]
  );

  const pageName = useCallback(
    (pageKey) => pages.find((p) => p.key === pageKey)?.name || pageKey,
    [pages]
  );

  // Touch a page's "last edited" stamp whenever its content/SEO changes.
  const touchPage = useCallback(
    (pageKey) => {
      setPages((prev) =>
        prev.map((p) => (p.key === pageKey ? { ...p, ...stamp() } : p))
      );
    },
    [stamp]
  );

  // ---- Page status -------------------------------------------------------
  const togglePageStatus = useCallback(
    (pageKey) => {
      setPages((prev) =>
        prev.map((p) => {
          if (p.key !== pageKey) return p;
          const next = p.status === "published" ? "draft" : "published";
          return { ...p, status: next, ...stamp() };
        })
      );
      const p = pages.find((x) => x.key === pageKey);
      const next = p?.status === "published" ? "Draft" : "Published";
      logActivity(`Set page status to ${next}`, p?.name || pageKey, p?.name);
      // TODO: PATCH /api/website/pages/:key { status }
    },
    [pages, stamp, logActivity]
  );

  // ---- Content blocks ----------------------------------------------------
  const addBlock = useCallback(
    (pageKey, draft) => {
      const block = { id: makeId("blk"), ...draft, ...stamp() };
      setContent((prev) => ({
        ...prev,
        [pageKey]: [...(prev[pageKey] || []), block],
      }));
      touchPage(pageKey);
      logActivity("Created content", draft.title, pageName(pageKey));
      // TODO: POST /api/website/pages/:key/blocks
    },
    [stamp, touchPage, logActivity, pageName]
  );

  const updateBlock = useCallback(
    (pageKey, blockId, draft) => {
      setContent((prev) => ({
        ...prev,
        [pageKey]: (prev[pageKey] || []).map((b) =>
          b.id === blockId ? { ...b, ...draft, ...stamp() } : b
        ),
      }));
      touchPage(pageKey);
      logActivity("Edited content", draft.title, pageName(pageKey));
      // TODO: PATCH /api/website/blocks/:id
    },
    [stamp, touchPage, logActivity, pageName]
  );

  const deleteBlock = useCallback(
    (pageKey, blockId) => {
      const removed = (content[pageKey] || []).find((b) => b.id === blockId);
      setContent((prev) => ({
        ...prev,
        [pageKey]: (prev[pageKey] || []).filter((b) => b.id !== blockId),
      }));
      touchPage(pageKey);
      logActivity("Deleted content", removed?.title || "Content block", pageName(pageKey));
      // TODO: DELETE /api/website/blocks/:id
    },
    [content, touchPage, logActivity, pageName]
  );

  const toggleBlockStatus = useCallback(
    (pageKey, blockId) => {
      let nextLabel = "";
      let title = "";
      setContent((prev) => ({
        ...prev,
        [pageKey]: (prev[pageKey] || []).map((b) => {
          if (b.id !== blockId) return b;
          const next = b.status === "published" ? "draft" : "published";
          nextLabel = next === "published" ? "Published" : "Draft";
          title = b.title;
          return { ...b, status: next, ...stamp() };
        }),
      }));
      touchPage(pageKey);
      logActivity(`Set status to ${nextLabel}`, title, pageName(pageKey));
      // TODO: PATCH /api/website/blocks/:id { status }
    },
    [stamp, touchPage, logActivity, pageName]
  );

  // Reorder a block within its page. dir: -1 = up, +1 = down.
  const moveBlock = useCallback(
    (pageKey, blockId, dir) => {
      setContent((prev) => {
        const list = [...(prev[pageKey] || [])];
        const idx = list.findIndex((b) => b.id === blockId);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= list.length) return prev;
        [list[idx], list[target]] = [list[target], list[idx]];
        return { ...prev, [pageKey]: list };
      });
      touchPage(pageKey);
      const moved = (content[pageKey] || []).find((b) => b.id === blockId);
      logActivity(
        `Reordered content (${dir < 0 ? "up" : "down"})`,
        moved?.title || "Content block",
        pageName(pageKey)
      );
      // TODO: PATCH /api/website/pages/:key/block-order
    },
    [content, touchPage, logActivity, pageName]
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
      // TODO: POST /api/website/media (multipart upload to storage bucket)
    },
    [currentUserName, logActivity]
  );

  const replaceMedia = useCallback(
    (mediaId, asset) => {
      let name = "";
      setMedia((prev) =>
        prev.map((m) => {
          if (m.id !== mediaId) return m;
          name = asset.name || m.name;
          return {
            ...m,
            ...asset,
            uploadedBy: currentUserName,
            uploadedAt: nowIso(),
          };
        })
      );
      logActivity("Replaced media", name, "Media Library");
      // TODO: PUT /api/website/media/:id
    },
    [currentUserName, logActivity]
  );

  const deleteMedia = useCallback(
    (mediaId) => {
      const removed = media.find((m) => m.id === mediaId);
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      logActivity("Deleted media", removed?.name || "Media asset", "Media Library");
      // TODO: DELETE /api/website/media/:id
    },
    [media, logActivity]
  );

  // ---- SEO ---------------------------------------------------------------
  const updateSeo = useCallback(
    (pageKey, patch) => {
      setSeo((prev) => ({ ...prev, [pageKey]: { ...prev[pageKey], ...patch } }));
      touchPage(pageKey);
      logActivity("Updated SEO", `${pageName(pageKey)} meta details`, pageName(pageKey));
      // TODO: PATCH /api/website/pages/:key/seo
    },
    [touchPage, logActivity, pageName]
  );

  // Block counts per page, derived for the overview panel.
  const blockCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(content).map(([k, blocks]) => [k, blocks.length])
      ),
    [content]
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
          blockCounts={blockCounts}
          media={media}
          activity={activity}
          onTogglePageStatus={togglePageStatus}
          onOpenPage={(pageKey) => {
            setActiveTab("content");
            // PageContentPanel reads ?page intent via the prop below.
            setInitialContentPage(pageKey);
          }}
        />
      )}

      {activeTab === "content" && (
        <PageContentPanel
          pages={pages}
          content={content}
          initialPageKey={initialContentPage}
          onAddBlock={addBlock}
          onUpdateBlock={updateBlock}
          onDeleteBlock={deleteBlock}
          onMoveBlock={moveBlock}
          onToggleBlock={toggleBlockStatus}
          onTogglePageStatus={togglePageStatus}
        />
      )}

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

      {/* Analytics is read-only and self-contained — it owns its own mock
          data and sub-tabs, so it takes no props from the content state. */}
      {activeTab === "analytics" && <AnalyticsPanel />}

      {activeTab === "activity" && <ActivityPanel activity={activity} />}
    </>
  );
}
