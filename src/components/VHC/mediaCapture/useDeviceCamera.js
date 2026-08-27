// file location: src/components/VHC/mediaCapture/useDeviceCamera.js
// React hook that manages the physical camera stream for the full-screen
// capture experience. It owns the getUserMedia lifecycle, enumerates the
// available lenses, and exposes zoom + flip controls. Audio track is only
// requested in video mode so photo mode never lights the mic light.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"; // React primitives

// Helper: clamp any number into [min, max].
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max); // Standard clamp
}

// Heuristic: infer "user" vs "environment" from a device label.
// Device labels vary per OS but almost always mention front/back/rear.
function inferFacingMode(device = {}) {
  const label = String(device.label || "").toLowerCase(); // Normalise to lowercase
  if (/front|facetime|user|selfie/.test(label)) return "user"; // Front-facing keywords
  if (/back|rear|environment|wide|tele|ultra/.test(label)) return "environment"; // Rear keywords
  return "environment"; // Safe default: rear camera
}

// Natural phone-camera ordering for multi-lens rear arrays
// (ultra-wide < wide < standard < telephoto).
function rankDevice(device = {}) {
  const label = String(device.label || "").toLowerCase(); // Lowercase match target
  if (label.includes("ultra")) return 0; // Ultra-wide first
  if (label.includes("wide")) return 1; // Then wide
  if (label.includes("back") || label.includes("rear")) return 2; // Main rear next
  if (label.includes("tele")) return 3; // Telephoto last
  return 4; // Unknown cameras go to the end
}

// Return a sorted copy of the device list in natural lens order.
function sortByLensOrder(devices = []) {
  return [...devices].sort((a, b) => rankDevice(a) - rankDevice(b)); // Immutable sort
}

// Build the "0.5x / 1x / 2x / 3x" discrete lens options for the slider.
// These correspond to the sorted physical lenses on the rear array.
function buildDiscreteLensOptions(devices = []) {
  const sorted = sortByLensOrder(devices); // Put lenses in natural order
  const defaults = [0.5, 1, 2, 3]; // Display labels we'd like to assign
  return sorted.map((device, index) => ({ // Attach a label per sorted device
    deviceId: device.deviceId, // MediaDeviceInfo id (used for gUM)
    label: `${defaults[index] || index + 1}x`, // Display label
    value: defaults[index] || index + 1, // Numeric value for slider
  }));
}

// Build the getUserMedia constraints for a given target.
function buildConstraints({ facing, deviceId, requestAudio, exactFacing }) {
  return {
    video: {
      width: { ideal: 1920 }, // Prefer full HD
      height: { ideal: 1080 },
      ...(deviceId
        ? { deviceId: { exact: deviceId } } // Explicit lens wins
        : { facingMode: exactFacing ? { exact: facing } : { ideal: facing } }), // Otherwise by side
    },
    audio: requestAudio, // Only ask for mic in video mode
  };
}

// Open a stream, insisting on the rear camera first when that is what we want.
// `exact` is the only facing constraint a browser must honour; if the device
// cannot satisfy it we fall back to the softer `ideal` hint rather than fail.
async function openStream({ facing, deviceId, requestAudio }) {
  if (!deviceId && facing === "environment") { // Rear requested with no specific lens
    try {
      return await navigator.mediaDevices.getUserMedia(buildConstraints({ facing, deviceId, requestAudio, exactFacing: true }));
    } catch (exactError) {
      if (exactError?.name !== "OverconstrainedError" && exactError?.name !== "NotFoundError") throw exactError; // Real failure
    }
  }
  return navigator.mediaDevices.getUserMedia(buildConstraints({ facing, deviceId, requestAudio, exactFacing: false })); // Soft hint
}

// True when the live track is reporting the front-facing lens.
function isFrontStream(liveStream) {
  const settings = liveStream?.getVideoTracks?.()[0]?.getSettings?.() || {}; // Active track settings
  if (settings.facingMode) return settings.facingMode === "user"; // Trust an explicit report
  return false; // Unknown facing: assume it is fine
}

// Query the browser Permissions API for camera (and mic, in video mode) so a
// known denial can show recovery guidance immediately. Unknown/prompt states
// proceed to getUserMedia and let the browser own the permission prompt.
// The API is not universal, so failures fall through to "unknown" and the
// browser handles the request normally.
async function queryCombinedPermissionState(mode) {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const cameraResult = await navigator.permissions.query({ name: "camera" });
    if (cameraResult.state === "denied") return "denied";
    if (mode === "video") {
      try {
        const micResult = await navigator.permissions.query({ name: "microphone" });
        if (micResult.state === "denied") return "denied";
        if (cameraResult.state === "granted" && micResult.state === "granted") return "granted";
        return "prompt";
      } catch {
        return cameraResult.state === "granted" ? "granted" : "prompt";
      }
    }
    return cameraResult.state === "granted" ? "granted" : "prompt";
  } catch {
    return "unknown";
  }
}

// Main hook. Accepts the desired capture mode (photo/video) so we only
// request audio when we actually need it.
export default function useDeviceCamera({ isActive, mode = "photo" }) {
  // --- State ---------------------------------------------------------
  const [stream, setStream] = useState(null); // Active MediaStream or null
  const [permissionGranted, setPermissionGranted] = useState(false); // True once gUM succeeded
  // "unknown" (not yet checked), "checking" (query/request in flight),
  // "granted" (camera is active), "denied" (browser has blocked us).
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [loading, setLoading] = useState(false); // True during initialisation
  const [error, setError] = useState(""); // User-facing error string
  const [devices, setDevices] = useState({ user: [], environment: [] }); // Enumerated cameras
  const [facingMode, setFacingMode] = useState("environment"); // Current facing preference
  const [selectedDeviceId, setSelectedDeviceId] = useState(""); // Current deviceId in use
  const [zoomRange, setZoomRange] = useState(null); // { min, max, step } or null
  const [zoomValue, setZoomValue] = useState(1); // Current zoom reading
  const [applyingZoom, setApplyingZoom] = useState(false); // Debounce flag for UI
  const streamRef = useRef(null); // Latest stream for cleanup (mirror of state)

  // --- Lifecycle helpers --------------------------------------------

  // Fully stop whatever is currently running (tracks + stream).
  const stopStream = useCallback(() => {
    const current = streamRef.current; // Always read the latest
    if (current) { // If something's running
      current.getTracks().forEach((track) => { // Kill every track
        try { track.stop(); } catch { /* ignore */ } // Safe stop
      });
    }
    streamRef.current = null; // Clear ref
    setStream(null); // Clear state
    setZoomRange(null); // Reset zoom capability
    setZoomValue(1); // Reset zoom display
  }, []); // No deps — uses refs/setters only

  // Enumerate available video devices and group them by facing mode.
  const enumerateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) { // Not supported
      return { user: [], environment: [] }; // Empty groups
    }
    const all = await navigator.mediaDevices.enumerateDevices(); // Full device list
    const videoOnly = all.filter((device) => device.kind === "videoinput"); // Only cameras
    const grouped = { user: [], environment: [] }; // Build two buckets
    videoOnly.forEach((device) => { // For each camera
      const facing = inferFacingMode(device); // Decide which side
      grouped[facing].push(device); // Add to its bucket
    });
    grouped.user = sortByLensOrder(grouped.user); // Natural order front
    grouped.environment = sortByLensOrder(grouped.environment); // Natural order rear
    setDevices(grouped); // Save into state
    return grouped; // Return for direct use
  }, []);

  // Read capabilities from the active video track (zoom etc.) and
  // update the hook's state to reflect them.
  const syncTrackCapabilities = useCallback((liveStream, fallbackFacing) => {
    const track = liveStream?.getVideoTracks?.()[0]; // First video track
    if (!track) { setZoomRange(null); setZoomValue(1); return; } // No track: bail
    const settings = track.getSettings?.() || {}; // Current settings
    const capabilities = track.getCapabilities?.() || {}; // Supported ranges
    setSelectedDeviceId(settings.deviceId || ""); // Remember active device
    setFacingMode(settings.facingMode === "user" ? "user" : fallbackFacing || "environment"); // Remember facing
    if (capabilities.zoom !== undefined) { // Continuous zoom supported
      const nextRange = { // Normalise to plain numbers
        min: Number(capabilities.zoom.min || 1), // Minimum zoom
        max: Number(capabilities.zoom.max || 1), // Maximum zoom
        step: Number(capabilities.zoom.step || 0.1), // Step granularity
      };
      setZoomRange(nextRange); // Store range
      setZoomValue(clamp(Number(settings.zoom || nextRange.min || 1), nextRange.min, nextRange.max)); // Clamp current
    } else {
      setZoomRange(null); // No native zoom support
      setZoomValue(1); // Reset display value
    }
  }, []);

  // Start or restart the camera. `options` may target a specific device or facing mode.
  const start = useCallback(async ({ facingMode: facing = facingMode, deviceId = "", requestAudio = mode === "video", allowRearCorrection = true } = {}) => {
    if (!isActive) return; // Guard: hook inactive
    try {
      setLoading(true); // Show spinner
      setError(""); // Reset error
      if (!navigator.mediaDevices?.getUserMedia) { // Browser not supported
        throw new Error("Camera not supported in this browser"); // Raise
      }
      stopStream(); // Kill any running stream first
      const nextStream = await openStream({ facing, deviceId, requestAudio }); // Open, rear-first
      streamRef.current = nextStream; // Mirror to ref for cleanup
      setStream(nextStream); // Update React state
      setPermissionGranted(true); // Permission definitely granted
      setPermissionStatus("granted"); // Drives the UI state machine
      const grouped = await enumerateDevices(); // Labels become readable after permission
      // Some devices ignore a facingMode hint and hand back the front lens.
      // Now that labels are readable, retry once against a real rear device id.
      if (allowRearCorrection && !deviceId && facing === "environment" && isFrontStream(nextStream)) {
        const rear = (grouped.environment || []).find((device) => device.deviceId); // First rear lens
        if (rear) { // Only when we actually have one to switch to
          await start({ facingMode: "environment", deviceId: rear.deviceId, requestAudio, allowRearCorrection: false });
          return; // The nested call owns state from here
        }
      }
      syncTrackCapabilities(nextStream, facing); // Sync zoom/facing
    } catch (cameraError) {
      console.error("Camera initialisation failed:", cameraError); // Log for ops
      setPermissionGranted(false); // Mark denied
      if (cameraError?.name === "NotAllowedError") { // Permission rejected
        setPermissionStatus("denied");
        setError("Camera permission was denied. Allow access in your browser settings to continue.");
      } else if (cameraError?.name === "NotFoundError") { // No camera hardware
        setError("No camera was found on this device.");
      } else if (cameraError?.name === "NotReadableError") { // Busy
        setError("The camera is already in use by another app.");
      } else {
        setError(cameraError?.message || "Unable to start the camera."); // Generic fallback
      }
    } finally {
      setLoading(false); // Clear loading state
    }
  }, [enumerateDevices, facingMode, isActive, mode, stopStream, syncTrackCapabilities]);

  // Flip between rear and front cameras, picking the first lens of the new side.
  const flip = useCallback(async () => {
    const next = facingMode === "user" ? "environment" : "user"; // Toggle facing
    const candidateDevices = devices[next] || []; // Lenses of the target side
    await start({ facingMode: next, deviceId: candidateDevices[0]?.deviceId || "" }); // Restart
  }, [devices, facingMode, start]);

  // Apply a continuous zoom value (when supported by the track).
  const applyZoom = useCallback(async (nextZoom) => {
    if (!zoomRange || !streamRef.current) return; // Nothing to do
    const track = streamRef.current.getVideoTracks?.()[0]; // Video track
    if (!track?.applyConstraints) return; // Old browser: bail
    try {
      setApplyingZoom(true); // Debounce UI
      const clamped = clamp(Number(nextZoom), zoomRange.min, zoomRange.max); // Constrain to range
      await track.applyConstraints({ advanced: [{ zoom: clamped }] }); // Hardware zoom
      setZoomValue(clamped); // Reflect in state
    } catch (zoomError) {
      console.warn("Zoom change failed:", zoomError); // Log but don't crash
    } finally {
      setApplyingZoom(false); // Release debounce flag
    }
  }, [zoomRange]);

  // Switch to a specific lens (discrete device-based zoom) on multi-lens rigs.
  const switchLens = useCallback(async (deviceId) => {
    if (!deviceId || deviceId === selectedDeviceId) return; // No-op when already selected
    await start({ facingMode, deviceId }); // Restart on the new lens
  }, [facingMode, selectedDeviceId, start]);

  // --- Effects -------------------------------------------------------

  // Explicit retry used by the denied-state guidance after the user changes
  // the browser's site settings.
  const requestPermission = useCallback(async () => {
    setPermissionStatus("checking");
    await start({ facingMode: "environment", requestAudio: mode === "video" });
  }, [mode, start]);

  // Start or stop the camera whenever the hook becomes (in)active or the mode changes.
  // The browser is the sole owner of consent: previously granted access opens
  // without another prompt, while prompt/unknown states invoke the browser's
  // native permission UI directly. A known denial shows recovery guidance.
  useEffect(() => {
    if (!isActive) { // Being hidden — release the camera
      stopStream(); // Clean up
      setPermissionStatus("unknown"); // Reset for next open
      setError(""); // Clear any stale error
      return undefined; // Nothing to tear down
    }
    let cancelled = false;
    setPermissionStatus("checking");
    (async () => {
      const state = await queryCombinedPermissionState(mode);
      if (cancelled) return;
      if (state === "denied") {
        setPermissionStatus("denied");
        setPermissionGranted(false);
        setError("Camera permission was denied. Allow access in your browser settings to continue.");
      } else {
        start({ facingMode: "environment", requestAudio: mode === "video" });
      }
    })();
    return () => { cancelled = true; stopStream(); };
    // We intentionally do NOT list `start` here — its identity changes with every call;
    // using start within the effect by closure keeps this stable.
  }, [isActive, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived: the discrete lens buttons for the currently active side.
  const discreteLensOptions = useMemo(
    () => buildDiscreteLensOptions(devices[facingMode] || []), // Build for active side
    [devices, facingMode] // Recompute when the device list or side changes
  );

  // Public API ---------------------------------------------------------
  return {
    stream, // Current MediaStream (or null)
    permissionGranted, // Boolean permission flag
    permissionStatus, // "unknown" | "checking" | "granted" | "denied"
    requestPermission, // User-initiated native prompt trigger
    loading, // True during initialisation
    error, // Error message (empty string when none)
    facingMode, // "user" | "environment"
    selectedDeviceId, // Active videoinput id
    devices, // Grouped { user, environment } device list
    zoomRange, // Capability range or null
    zoomValue, // Current applied zoom
    applyingZoom, // True while a zoom change is in flight
    discreteLensOptions, // Array of { deviceId, label, value }
    start, // (opts?) => Promise<void> manual restart
    stop: stopStream, // () => void teardown
    flip, // () => Promise<void> flip facing
    applyZoom, // (n) => Promise<void> continuous zoom
    switchLens, // (deviceId) => Promise<void> discrete lens switch
  };
}
