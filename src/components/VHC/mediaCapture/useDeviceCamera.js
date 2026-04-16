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

// Main hook. Accepts the desired capture mode (photo/video) so we only
// request audio when we actually need it.
export default function useDeviceCamera({ isActive, mode = "photo" }) {
  // --- State ---------------------------------------------------------
  const [stream, setStream] = useState(null); // Active MediaStream or null
  const [permissionGranted, setPermissionGranted] = useState(false); // True once gUM succeeded
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
  const start = useCallback(async ({ facingMode: facing = facingMode, deviceId = "", requestAudio = mode === "video" } = {}) => {
    if (!isActive) return; // Guard: hook inactive
    try {
      setLoading(true); // Show spinner
      setError(""); // Reset error
      if (!navigator.mediaDevices?.getUserMedia) { // Browser not supported
        throw new Error("Camera not supported in this browser"); // Raise
      }
      stopStream(); // Kill any running stream first
      const constraints = { // Build constraints
        video: {
          width: { ideal: 1920 }, // Prefer full HD
          height: { ideal: 1080 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facing } }),
        },
        audio: requestAudio, // Only ask for mic in video mode
      };
      const nextStream = await navigator.mediaDevices.getUserMedia(constraints); // Actually open camera
      streamRef.current = nextStream; // Mirror to ref for cleanup
      setStream(nextStream); // Update React state
      setPermissionGranted(true); // Permission definitely granted
      await enumerateDevices(); // Labels become readable after permission
      syncTrackCapabilities(nextStream, facing); // Sync zoom/facing
    } catch (cameraError) {
      console.error("Camera initialisation failed:", cameraError); // Log for ops
      setPermissionGranted(false); // Mark denied
      if (cameraError?.name === "NotAllowedError") { // Permission rejected
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

  // Start or stop the camera whenever the hook becomes (in)active or the mode changes.
  useEffect(() => {
    if (!isActive) { // Being hidden — release the camera
      stopStream(); // Clean up
      return undefined; // Nothing to tear down
    }
    start({ facingMode: "environment", requestAudio: mode === "video" }); // Default: rear camera
    return () => { stopStream(); }; // Cleanup on unmount/mode change
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
