// file location: src/singlescroll/hooks/useIs3DCapable.js
// Decides whether to render the heavy 3D hero scene or fall back to the
// poster image. Returns:
//   - capable: WebGL is available and the device isn't a tiny phone
//   - lowQuality: a coarser device — drop bloom, lower DPR, fewer particles

import { useEffect, useState } from "react";

const MOBILE_BP = 768;

function detect() {
  if (typeof window === "undefined") {
    return { capable: false, lowQuality: false };
  }

  // WebGL probe.
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    webgl = false;
  }

  const isMobile = window.innerWidth < MOBILE_BP;
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;

  return {
    capable: webgl,
    lowQuality: Boolean(isMobile || lowMem || lowCores),
  };
}

export default function useIs3DCapable() {
  const [state, setState] = useState({ capable: true, lowQuality: false });

  useEffect(() => {
    setState(detect());
    const onResize = () => setState(detect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return state;
}
