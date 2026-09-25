// file location: src/features/workspaces/WorkspaceEmbedBridge.js
//
// Runs INSIDE a workspace frame. Reports the frame's page and focus to the host
// and carries out the host's navigation requests, so the one global sidebar can
// drive whichever workspace is focused. Renders nothing.
import { useEffect } from "react";
import { useRouter } from "next/router";
import {
  WORKSPACE_MESSAGES,
  postToHost,
  openInOtherWorkspace,
  setEmbeddedWorkspaceStatus,
} from "@/features/workspaces/workspaceBridge";
import { bindWorkspaceLinkTargets } from "@/features/workspaces/workspaceLinks";

export default function WorkspaceEmbedBridge({ workspaceId }) {
  const router = useRouter();

  // READY once mounted in embedded mode, then ROUTE on every navigation.
  useEffect(() => {
    if (!workspaceId) return undefined;
    postToHost(WORKSPACE_MESSAGES.READY, { href: router.asPath });
    const onRouteDone = (url) => postToHost(WORKSPACE_MESSAGES.ROUTE, { href: url });
    router.events.on("routeChangeComplete", onRouteDone);
    router.events.on("hashChangeComplete", onRouteDone);
    return () => {
      router.events.off("routeChangeComplete", onRouteDone);
      router.events.off("hashChangeComplete", onRouteDone);
    };
    // router.asPath intentionally read once — later changes arrive as events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, router.events]);

  // Any interaction inside the frame focuses this workspace in the host.
  useEffect(() => {
    if (!workspaceId) return undefined;
    const onInteract = () => postToHost(WORKSPACE_MESSAGES.FOCUS);
    document.addEventListener("pointerdown", onInteract, true);
    document.addEventListener("focusin", onInteract, true);
    return () => {
      document.removeEventListener("pointerdown", onInteract, true);
      document.removeEventListener("focusin", onInteract, true);
    };
  }, [workspaceId]);

  // Host -> frame: navigation (sidebar clicks, topbar search, move/duplicate
  // actions) and the shell status the right-click menu reads.
  useEffect(() => {
    if (!workspaceId) return undefined;
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data;
      if (!data) return;
      if (data.type === WORKSPACE_MESSAGES.STATUS) {
        setEmbeddedWorkspaceStatus({ canAdd: Boolean(data.canAdd), count: Number(data.count) || 2 });
        return;
      }
      if (data.type !== WORKSPACE_MESSAGES.NAVIGATE || typeof data.href !== "string") return;
      if (data.href === router.asPath) return;
      router.push(data.href);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [workspaceId, router]);

  // Links marked data-workspace-target="other" open in another workspace.
  useEffect(() => {
    if (!workspaceId) return undefined;
    return bindWorkspaceLinkTargets(openInOtherWorkspace);
  }, [workspaceId]);

  return null;
}
