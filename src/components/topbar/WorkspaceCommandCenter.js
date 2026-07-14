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
import TeamPanel from "@/components/topbar/TeamPanel";
import AssistantPanel from "@/components/topbar/AssistantPanel";
import { useCommandPalette, openCommandPalette } from "@/hooks/useCommandPalette";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { useFavourites } from "@/hooks/useFavourites";
import { useContextualSuggestions } from "@/hooks/useContextualSuggestions";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useReminders } from "@/hooks/useReminders";
import { useWorkspacePreferences } from "@/hooks/useWorkspacePreferences";
import { useSelfAvailability } from "@/hooks/useSelfAvailability";
import { useTeamPresence } from "@/hooks/useTeamPresence";
import { useDepartmentActivity } from "@/hooks/useDepartmentActivity";
import { useEscalations } from "@/hooks/useEscalations";
import { useOperationalTrends } from "@/hooks/useOperationalTrends";
import { useOperationalRecommendations } from "@/hooks/useOperationalRecommendations";
import { useOperationalAlerts } from "@/hooks/useOperationalAlerts";
import { useBehaviourModel } from "@/hooks/useBehaviourModel";
import { buildCommands } from "@/lib/topbar/commandPalette";
import { recentToCommandSource } from "@/lib/topbar/recentActivity";
import { favouriteToCommandSource } from "@/lib/topbar/favourites";
import { applyQuickActionPrefs } from "@/lib/topbar/workspacePreferences";
import { getShortcut, formatCombo } from "@/config/topbar/keyboardShortcuts";
import { resolveWidgets } from "@/config/topbar/productivityWidgets";
import { buildManagerTools } from "@/config/topbar/managerTools";
import { resolveCoordinationLinks } from "@/config/topbar/crossDepartment";
import { buildWorkloadBalancing } from "@/config/topbar/workloadBalancing";
import { buildSmartReminders } from "@/config/topbar/smartReminders";
import { resolveWorkflow } from "@/config/topbar/workflowAutomation";
import { buildAssistant } from "@/config/topbar/assistant";
import { getDepartment } from "@/lib/reporting/config/departments";
import { audienceContactAction } from "@/config/topbar/communicationShortcuts";
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
  const [teamOpen, setTeamOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const isMac = useMemo(() => detectMac(), []);

  // --- Phase 4: collaborative operational workspace --------------------------
  const selfAvailability = useSelfAvailability({ enabled });
  const presence = useTeamPresence({
    department,
    selfAvailabilityId: selfAvailability.effectiveId,
    isPresentation: !enabled,
    enabled,
  });
  const activity = useDepartmentActivity({
    metrics,
    presenceById: presence.byId,
    enabled,
  });
  const escalations = useEscalations({ metrics, roles: userRoles, department, enabled });
  const managerTools = useMemo(
    () =>
      buildManagerTools({
        presence,
        metrics,
        department,
        roles: userRoles,
        myDepartment: presence.myDepartment,
      }),
    [presence, metrics, department, userRoles]
  );

  // Quick actions the user has chosen to keep (personalisation 3.7).
  const visibleQuickActions = useMemo(
    () => applyQuickActionPrefs(quickActions, preferences.prefs),
    [quickActions, preferences.prefs]
  );

  const pathname = (currentAsPath || "").split("?")[0].split("#")[0];
  // Phase 4.7 — cross-department coordination links for the current context.
  const coordination = useMemo(
    () => resolveCoordinationLinks({ department, pathname }),
    [department, pathname]
  );
  const suggestions = useContextualSuggestions({
    pathname,
    roles: userRoles,
    department,
    recentItems: recent.items,
    metrics,
    enabled,
  });

  // --- Phase 5: intelligent operational assistance ---------------------------
  // Behaviour learning (5.7) — on-device, from the route signal already flowing.
  const behaviour = useBehaviourModel({ currentAsPath, navigationItems, enabled });
  // Trend ring (5.1) — reuses the metrics poll; no new polling.
  const { trends } = useOperationalTrends({ metrics, enabled });
  // Predictive recommendations (5.1) + proactive alerts (5.3).
  const recommendations = useOperationalRecommendations({
    metrics,
    trends,
    roles: userRoles,
    department,
    pathname,
    behaviour,
    enabled,
  });
  const { alerts } = useOperationalAlerts({ metrics, trends, roles: userRoles, department, enabled });
  // Smart reminders (5.4), workflow next-steps (5.5) and workload balancing (5.2)
  // are pure over data already in hand — memoised, no polling.
  const smartReminders = useMemo(
    () =>
      buildSmartReminders(
        { metrics, roles: userRoles, department, pathname, manualOutstanding: reminders.outstanding },
        { limit: WORKSPACE_LIMITS.smartReminders }
      ),
    [metrics, userRoles, department, pathname, reminders.outstanding]
  );
  const workflow = useMemo(
    () => resolveWorkflow({ pathname, roles: userRoles, department, metrics }, { limit: WORKSPACE_LIMITS.workflowSteps }),
    [pathname, userRoles, department, metrics]
  );
  const balancing = useMemo(
    () =>
      buildWorkloadBalancing({
        presence,
        metrics,
        trends,
        roles: userRoles,
        department,
        myDepartment: presence.myDepartment,
      }),
    [presence, metrics, trends, userRoles, department]
  );
  // Assemble the unified assistant (5.6) — normalised sections + a headline.
  const assistant = useMemo(
    () =>
      buildAssistant({
        alerts,
        recommendations,
        workflow,
        smartReminders,
        balancing,
        pathname,
        roles: userRoles,
      }),
    [alerts, recommendations, workflow, smartReminders, balancing, pathname, userRoles]
  );

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
    // Phase 4 — collaborative team workspace (presence, availability, activity,
    // escalations, manager tools, coordination) reachable from anywhere.
    list.push({
      id: "action:team-workspace",
      label: "Open team workspace",
      icon: "👥",
      keywords: ["team", "presence", "availability", "who is", "online", "colleagues", "collaborate", "activity"],
      shortcut: formatCombo(getShortcut("team-workspace"), isMac),
      run: () => setTeamOpen(true),
    });
    // Phase 5 — the intelligent operational assistant (recommendations, alerts,
    // next steps, smart reminders, balancing, guidance) reachable from anywhere.
    list.push({
      id: "action:operational-assistant",
      label: "Open operational assistant",
      icon: "🤖",
      keywords: ["assistant", "recommend", "suggest", "alerts", "next steps", "guidance", "help", "intelligent", "predict"],
      shortcut: formatCombo(getShortcut("operational-assistant"), isMac),
      run: () => setAssistantOpen(true),
    });
    // Phase 4.4 — one-click "message my department" from the palette.
    const myDeptContact = audienceContactAction(department, presence.departments);
    if (myDeptContact?.href) {
      const deptName = getDepartment(department)?.name || "department";
      list.push({
        id: "action:message-department",
        label: `Message the ${deptName} team`,
        icon: "📣",
        keywords: ["message", "team", "department", "chat", "broadcast", deptName.toLowerCase()],
        href: myDeptContact.href,
      });
    }
    list.push({
      id: "action:keyboard-shortcuts",
      label: "Keyboard shortcuts",
      icon: "⌨",
      keywords: ["keyboard", "shortcuts", "keys", "hotkeys", "help"],
      shortcut: formatCombo(getShortcut("shortcut-hints"), isMac),
      run: () => setHintsOpen(true),
    });
    return list;
  }, [visibleQuickActions, currentPage, favourites, isMac, department, presence.departments]);

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
      "team-workspace": () => setTeamOpen((v) => !v),
      "operational-assistant": () => setAssistantOpen((v) => !v),
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
      <TeamPanel
        isOpen={teamOpen}
        onClose={() => setTeamOpen(false)}
        department={department}
        departmentName={getDepartment(department)?.name || null}
        presence={presence}
        selfAvailability={selfAvailability}
        escalations={escalations}
        activity={activity.items}
        managerTools={managerTools}
        coordination={coordination}
      />
      <AssistantPanel
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        assistant={assistant}
        presence={presence}
        behaviour={behaviour}
      />
    </>
  );
}
