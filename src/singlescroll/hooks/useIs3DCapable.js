// file location: src/singlescroll/hooks/useIs3DCapable.js
// Decides whether to load the heavy 3D hero scene. This hook is used before
// the dynamic Three.js import, so weak phones / poor connections never fetch
// or initialise the 3D chunk at all.
// Returns:
//   - ready: detection has run on the client
//   - capable: safe to load WebGL + glTF models
//   - lowQuality: capable but coarser settings should be used

import { useEffect, useState } from "react";

const MOBILE_BP = 768;
const TINY_PHONE_BP = 420;
const LOW_MEMORY_GB = 4;
const LOW_CORE_COUNT = 4;
const SLOW_DOWNLINK_MBPS = 1.5;

const INITIAL_STATE = { ready: false, capable: false, lowQuality: false };

function detect() {
  if (typeof window === "undefined") {
    return INITIAL_STATE;
  }

  // WebGL probe.
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }

  const isMobile = window.innerWidth < MOBILE_BP;
  const isTinyPhone = window.innerWidth <= TINY_PHONE_BP;
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= LOW_MEMORY_GB;
  const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= LOW_CORE_COUNT;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const constrainedNetwork = Boolean(
    connection?.saveData ||
    ["slow-2g", "2g"].includes(connection?.effectiveType) ||
    (connection?.downlink && connection.downlink < SLOW_DOWNLINK_MBPS),
  );
  const lowProcessingPhone = isMobile && (isTinyPhone || lowMem || lowCores);

  return {
    ready: true,
    capable: Boolean(webgl && !lowProcessingPhone && !constrainedNetwork),
    lowQuality: Boolean(isMobile || lowMem || lowCores),
  };
}

export default function useIs3DCapable() {
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    const update = () => setState(detect());
    update();
    const onResize = () => setState(detect());
    window.addEventListener("resize", onResize);
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    connection?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("resize", onResize);
      connection?.removeEventListener?.("change", update);
    };
  }, []);

  return state;
}
