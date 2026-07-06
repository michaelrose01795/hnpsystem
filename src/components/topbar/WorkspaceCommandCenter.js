// file location: src/components/topbar/WorkspaceCommandCenter.js
//
// Phase 3 mount point. A single, globally-mounted controller that hosts every
// productivity surface built in Phase 3 WITHOUT adding anything to the top bar
// (no height/visual change): the command palette (3.1), global recent activity
// (3.2), and — as the rollout proceeds — favourites, contextual suggestions,
// keyboard shortcuts, productivity widgets and personalisation.
//
// StaffLayout mounts this once with the data it already computes for the bar
// (navigation items, quick actions, roles, department, metrics, current route).
// Everything here is keyboard/overlay-driven, mirroring how NextActionPrompt /
// SupportControl already live as overlay controls rather than persistent chrome.

import React, { useMemo, useState } from "react";
import CommandPalette from "@/components/topbar/CommandPalette";
import ShortcutHintsOverlay from "@/components/topbar/ShortcutHintsOverlay";
import WorkspacePanel from "@/components/topbar/WorkspacePanel";
import WorkspaceCustomiseOverlay from "@/components/topbar/WorkspaceCustomiseOverlay";
import { useCommandPalette, openCommandPalette } from "@/hooks/useCommandPalette";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { useFavourites } from "@/hooks/useFavourites";
import { useContextualSuggestions } from "@/hooks/useContextualSuggestions";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useReminders } from "@/hooks/useReminders";
import { useWorkspacePreferences } from "@/hooks/useWorkspacePreferences";
import { buildCommands } from "@/lib/topbar/commandPalette";
import { recentToCommandSource } from "@/lib/topbar/recentActivity";
import { favouriteToCommandSource } from "@/lib/topbar/favourites";
import { applyQuickActionPrefs } from "@/lib/topbar/workspacePreferences";
import { getShortcut, formatCombo } from "@/config/topbar/keyboardShortcuts";
import { resolveWidgets } from "@/config/topbar/productivityWidgets";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

function detectMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
}

export default function WorkspaceCommandCenter({
  enabled = true,
  currentAsPath = "",
  currentPage = null,
  navigationItems = [],
  quickActions = [],
  userRoles = [],
  department = null,
  metrics = {},
}) {
  const palette = useCommandPalette({ enabled });
  const recent = useRecentActivity(currentAsPath, { enabled });
  const favourites = useFavourites({ enabled });
  const reminders = useReminders({ enabled });
  const preferences = useWorkspacePreferences({ enabled });
  const [hintsOpen, setHintsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const isMac = useMemo(() => detectMac(), []);

  // Quick actions the user has chosen to keep (personalisation 3.7).
  const visibleQuickActions = useMemo(
    () => applyQuickActionPrefs(quickActions, preferences.prefs),
    [quickActions, preferences.prefs]
  );

  const pathname = (currentAsPath || "").split("?")[0].split("#")[0];
  const suggestions = useContextualSuggestions({
    pathname,
    roles: userRoles,
    department,
    recentItems: recent.items,
    metrics,
    enabled,
  });

  // Recent items become a "Recent" section in the palette. Search items re-run by
  // re-opening the palette pre-filled with their query.
  const recentSources = useMemo(
    () =>
      recent.items
        .slice(0, WORKSPACE_LIMITS.paletteRecent)
        .map((item) => recentToCommandSource(item, { onRunSearch: openCommandPalette }))
        .filter(Boolean),
    [recent.items]
  );

  const favouriteSources = useMemo(
    () => favourites.favourites.map(favouriteToCommandSource).filter(Boolean),
    [favourites.favourites]
  );

  // Always-available actions surfaced in the palette (and discoverable there),
  // so favourites/shortcuts can be reached from anywhere without touching the bar.
  const actionSources = useMemo(() => {
    const list = [...visibleQuickActions];
    if (currentPage?.href) {
      const isFav = favourites.isFavourite(currentPage.href);
      list.push({
        id: "action:toggle-favourite",
        label: isFav ? "Remove this page from favourites" : "Favourite this page",
        icon: "★",
        keywords: ["favourite", "favorite", "star", "bookmark", "save"],
        shortcut: formatCombo(getShortcut("favourite-page"), isMac),
        run: () => favourites.toggleFavourite(currentPage),
      });
    }
    list.push({
      id: "action:workspace-panel",
      label: "Open my workspace panel",
      icon: "🗂",
      keywords: ["workspace", "panel", "widgets", "reminders", "upcoming", "tasks"],
      shortcut: formatCombo(getShortcut("workspace-panel"), isMac),
      run: () => setPanelOpen(true),
    });
    list.push({
      id: "action:keyboard-shortcuts",
      label: "Keyboard shortcuts",
      icon: "⌨",
      keywords: ["keyboard", "shortcuts", "keys", "hotkeys", "help"],
      shortcut: formatCombo(getShortcut("shortcut-hints"), isMac),
      run: () => setHintsOpen(true),
    });
    return list;
  }, [visibleQuickActions, currentPage, favourites, isMac]);

  // Aggregate the workspace context into productivity widgets for the panel,
  // honouring the user's widget visibility + order (personalisation 3.7).
  const widgets = useMemo(
    () =>
      resolveWidgets(
        {
          metrics,
          department,
          roles: userRoles,
          recentItems: recent.items,
          favourites: favourites.favourites,
          suggestions,
          reminders: reminders.reminders,
        },
        preferences.prefs
      ),
    [metrics, department, userRoles, recent.items, favourites.favourites, suggestions, reminders.reminders, preferences.prefs]
  );

  const commands = useMemo(
    () =>
      buildCommands({
        pages: navigationItems,
        actions: actionSources,
        favourites: favouriteSources,
        recent: recentSources,
        suggestions,
      }),
    [navigationItems, actionSources, favouriteSources, recentSources, suggestions]
  );

  // Record the search term when the user runs a command from a typed query, so it
  // resurfaces under Recent → Search.
  const handleExecute = (command, query) => {
    if (query && query.trim() && command?.kind !== "recent") {
      recent.recordSearch(query);
    }
  };

  // The single global shortcut handler dispatches by id (Phase 3.5). The
  // workspace-panel shortcut is wired in Phase 3.6.
  useKeyboardShortcuts(
    {
      "command-palette": () => palette.toggle(),
      search: () => palette.open(),
      "workspace-panel": () => setPanelOpen((v) => !v),
      "favourite-page": () => currentPage?.href && favourites.toggleFavourite(currentPage),
      "shortcut-hints": () => setHintsOpen(true),
    },
    { enabled }
  );

  if (!enabled) return null;

  return (
    <>
      <CommandPalette
        isOpen={palette.isOpen}
        onClose={palette.close}
        seed={palette.seed}
        commands={commands}
        onExecute={handleExecute}
      />
      <WorkspacePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        widgets={widgets}
        reminders={reminders}
        onCustomise={preferences.canPersonalise ? () => setCustomiseOpen(true) : null}
      />
      <WorkspaceCustomiseOverlay
        isOpen={customiseOpen}
        onClose={() => setCustomiseOpen(false)}
        prefs={preferences.prefs}
        onSetWidget={preferences.setWidget}
        onReorderWidget={preferences.reorderWidget}
        quickActions={quickActions}
        onToggleQuickAction={preferences.toggleQuickAction}
        onReset={preferences.reset}
      />
      <ShortcutHintsOverlay isOpen={hintsOpen} onClose={() => setHintsOpen(false)} />
    </>
  );
}
