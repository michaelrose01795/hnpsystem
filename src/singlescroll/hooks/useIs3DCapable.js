// file location: src/singlescroll/hooks/useIs3DCapable.js
// Decides whether to load the heavy 3D hero scene. This hook is used before
// the dynamic Three.js import, so weak phones / poor connections never fetch
// or initialise the 3D chunk at all.
// Returns:
//   - ready: detection has run on the client
//   - capable: safe to load WebGL + glTF models
//   - lowQuality: capable but coarser settings should be used

import { useEffect, useState } from "react";

const DESKTOP_3D_BP = 1180;
const HIGH_MEMORY_GB = 8;
const HIGH_CORE_COUNT = 8;
const FAST_DOWNLINK_MBPS = 5;

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

  const memory = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const constrainedNetwork = Boolean(
    connection?.saveData ||
    ["slow-2g", "2g", "3g"].includes(connection?.effectiveType) ||
    (connection?.downlink && connection.downlink < FAST_DOWNLINK_MBPS),
  );
  const finePointer = window.matchMedia?.("(pointer: fine)")?.matches !== false;
  const desktopViewport = window.innerWidth >= DESKTOP_3D_BP;
  const highMemory = !memory || memory >= HIGH_MEMORY_GB;
  const highCoreCount = !cores || cores >= HIGH_CORE_COUNT;
  const highSpecDevice = desktopViewport && finePointer && highMemory && highCoreCount;

  return {
    ready: true,
    capable: Boolean(webgl && highSpecDevice && !constrainedNetwork),
    lowQuality: false,
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
