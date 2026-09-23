// file location: src/features/workspaces/useWorkspaceEmbed.js
//
// Returns this document's workspace id when it is running inside a workspace
// frame, otherwise null. Resolved after mount, never during render: the server
// cannot know, so the first client render must match the server HTML. The host
// keeps a frame invisible until the frame reports READY, so the one render of
// full chrome before this flips is never seen.
import { useEffect, useState } from "react";
import { getEmbeddedWorkspaceId } from "@/features/workspaces/workspaceBridge";

export default function useWorkspaceEmbed() {
  const [workspaceId, setWorkspaceId] = useState(null);
  useEffect(() => {
    setWorkspaceId(getEmbeddedWorkspaceId());
  }, []);
  return workspaceId;
}
