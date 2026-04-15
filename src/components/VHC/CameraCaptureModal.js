// file location: src/components/VHC/CameraCaptureModal.js
// Full-screen mobile-first camera experience shared by the VHC capture flows.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useBodyModalLock from "@/hooks/useBodyModalLock";

const PRESET_ZOOM_VALUES = [0.5, 1, 2, 3];
const SNAP_ZOOM_VALUES = [0.5, 1, 2, 3];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function inferFacingMode(device = {}) {
  const label = String(device.label || "").toLowerCase();
  if (/front|facetime|user|selfie/.test(label)) return "user";
  if (/back|rear|environment|wide|tele|ultra/.test(label)) return "environment";
  return "environment";
}

function sortDevicesForNaturalLensOrder(devices = []) {
  const rankDevice = (device) => {
    const label = String(device.label || "").toLowerCase();
    if (label.includes("ultra")) return 0;
    if (label.includes("wide")) return 1;
    if (label.includes("back")) return 2;
    if (label.includes("rear")) return 2;
    if (label.includes("tele")) return 3;
    return 4;
  };

  return [...devices].sort((a, b) => rankDevice(a) - rankDevice(b));
}

function buildDiscreteLensOptions(devices = []) {
  const sorted = sortDevicesForNaturalLensOrder(devices);
  const defaults = [0.5, 1, 2, 3];
  return sorted.map((device, index) => ({
    deviceId: device.deviceId,
    label: `${defaults[index] || index + 1}x`,
    value: defaults[index] || index + 1,
  }));
}

function buildZoomPresetOptions(range) {
  if (!range) return [];
  const values = PRESET_ZOOM_VALUES
    .map((value) => clamp(value, range.min, range.max))
    .filter((value, index, array) => array.findIndex((entry) => Math.abs(entry - value) < 0.01) === index);
  return values.map((value) => ({
    label: `${value.toFixed(value < 1 ? 1 : Number.isInteger(value) ? 0 : 1)}x`,
    value,
  }));
}

function resolveLockedZoomValue(rawValue, range) {
  const clampedValue = clamp(rawValue, range.min, range.max);
  const snapTargets = SNAP_ZOOM_VALUES.filter(
    (value) => value >= range.min - 0.001 && value <= Math.min(range.max, 3) + 0.001
  );

  if (clampedValue > 3 || snapTargets.length === 0) {
    return clampedValue;
  }

  return snapTargets.reduce((closest, current) => {
    return Math.abs(current - clampedValue) < Math.abs(closest - clampedValue) ? current : closest;
  }, snapTargets[0]);
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  initialMode = "photo",
}) {
  useBodyModalLock(isOpen);

  const [captureMode, setCaptureMode] = useState(initialMode);
  const [cameraStream, setCameraStream] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [cameraDevices, setCameraDevices] = useState({ user: [], environment: [] });
  const [activeFacingMode, setActiveFacingMode] = useState("environment");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [zoomRange, setZoomRange] = useState(null);
  const [zoomValue, setZoomValue] = useState(1);
  const [isApplyingZoom, setIsApplyingZoom] = useState(false);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    setIsRecording(false);
    setRecordingDuration(0);
    setZoomRange(null);
    setZoomValue(1);
    setIsApplyingZoom(false);

    setCameraStream((currentStream) => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
  }, []);

  const enumerateAndGroupDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { user: [], environment: [] };
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === "videoinput");
    const grouped = {
      user: [],
      environment: [],
    };

    videoDevices.forEach((device) => {
      const facing = inferFacingMode(device);
      grouped[facing].push(device);
    });

    grouped.user = sortDevicesForNaturalLensOrder(grouped.user);
    grouped.environment = sortDevicesForNaturalLensOrder(grouped.environment);
    setCameraDevices(grouped);
    return grouped;
  }, []);

  const syncTrackCapabilities = useCallback((stream, fallbackFacingMode) => {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) {
      setZoomRange(null);
      setZoomValue(1);
      return;
    }

    const settings = track.getSettings?.() || {};
    const capabilities = track.getCapabilities?.() || {};
    const facing = settings.facingMode || fallbackFacingMode || activeFacingMode;

    setSelectedDeviceId(settings.deviceId || "");
    setActiveFacingMode(facing === "user" ? "user" : "environment");

    if (capabilities.zoom !== undefined) {
      const nextRange = {
        min: Number(capabilities.zoom.min || 1),
        max: Number(capabilities.zoom.max || 1),
        step: Number(capabilities.zoom.step || 0.1),
      };
      setZoomRange(nextRange);
      setZoomValue(clamp(Number(settings.zoom || nextRange.min || 1), nextRange.min, nextRange.max));
    } else {
      setZoomRange(null);
      setZoomValue(1);
    }
  }, [activeFacingMode]);

  const initializeCamera = useCallback(async ({
    facingMode = activeFacingMode,
    deviceId = "",
    mode = captureMode,
  } = {}) => {
    if (!isOpen) return;

    try {
      setLoadingCamera(true);
      setError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported in this browser");
      }

      stopCamera();

      const constraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facingMode } }),
        },
        audio: mode === "video",
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setPermissionGranted(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      await enumerateAndGroupDevices();
      syncTrackCapabilities(stream, facingMode);
    } catch (cameraError) {
      console.error("Camera initialisation failed:", cameraError);
      setPermissionGranted(false);

      if (cameraError?.name === "NotAllowedError") {
        setError("Camera permission was denied. Allow access in your browser settings to continue.");
      } else if (cameraError?.name === "NotFoundError") {
        setError("No camera was found on this device.");
      } else if (cameraError?.name === "NotReadableError") {
        setError("The camera is already in use by another app.");
      } else {
        setError(cameraError?.message || "Unable to start the camera.");
      }
    } finally {
      setLoadingCamera(false);
    }
  }, [activeFacingMode, captureMode, enumerateAndGroupDevices, isOpen, stopCamera, syncTrackCapabilities]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return undefined;
    }

    setCaptureMode(initialMode);
    setActiveFacingMode("environment");
    initializeCamera({ facingMode: "environment", mode: initialMode });

    return () => {
      stopCamera();
    };
  }, [initialMode, initializeCamera, isOpen, stopCamera]);

  useEffect(() => {
    if (!isOpen || !cameraStream) return;
    if (!videoRef.current) return;
    videoRef.current.srcObject = cameraStream;
  }, [cameraStream, isOpen]);

  const handleModeChange = async (nextMode) => {
    if (nextMode === captureMode || isRecording) return;
    setCaptureMode(nextMode);
    await initializeCamera({ facingMode: activeFacingMode, deviceId: selectedDeviceId, mode: nextMode });
  };

  const applyZoomValue = useCallback(async (nextZoom) => {
    if (!zoomRange || !cameraStream) return;

    const track = cameraStream.getVideoTracks?.()[0];
    if (!track?.applyConstraints) return;

    try {
      setIsApplyingZoom(true);
      const clampedZoom = resolveLockedZoomValue(nextZoom, zoomRange);
      await track.applyConstraints({
        advanced: [{ zoom: clampedZoom }],
      });
      setZoomValue(clampedZoom);
    } catch (zoomError) {
      console.warn("Zoom change failed:", zoomError);
    } finally {
      setIsApplyingZoom(false);
    }
  }, [cameraStream, zoomRange]);

  const discreteLensOptions = useMemo(
    () => buildDiscreteLensOptions(cameraDevices[activeFacingMode] || []),
    [activeFacingMode, cameraDevices]
  );

  const zoomPresetOptions = useMemo(() => {
    if (zoomRange) return buildZoomPresetOptions(zoomRange);
    if (activeFacingMode === "environment" && discreteLensOptions.length > 1) return discreteLensOptions;
    return [{ label: "1x", value: 1 }];
  }, [activeFacingMode, discreteLensOptions, zoomRange]);

  const activeZoomLabel = useMemo(() => {
    if (zoomRange) {
      return `${zoomValue.toFixed(zoomValue < 1 ? 1 : Number.isInteger(zoomValue) ? 0 : 1)}x`;
    }

    const matchedLens = discreteLensOptions.find((option) => option.deviceId === selectedDeviceId);
    if (matchedLens) return matchedLens.label;
    return "1x";
  }, [discreteLensOptions, selectedDeviceId, zoomRange, zoomValue]);

  const sliderRange = useMemo(() => {
    if (zoomRange) {
      return {
        min: zoomRange.min,
        max: zoomRange.max,
        step: zoomRange.max > 3 ? 0.05 : 0.01,
      };
    }

    if (activeFacingMode === "environment" && discreteLensOptions.length > 1) {
      return {
        min: 0,
        max: discreteLensOptions.length - 1,
        step: 1,
      };
    }

    return null;
  }, [activeFacingMode, discreteLensOptions, zoomRange]);

  const sliderValue = useMemo(() => {
    if (zoomRange) return zoomValue;

    if (activeFacingMode === "environment" && discreteLensOptions.length > 1) {
      const selectedIndex = discreteLensOptions.findIndex((option) => option.deviceId === selectedDeviceId);
      return selectedIndex >= 0 ? selectedIndex : 0;
    }

    return 0;
  }, [activeFacingMode, discreteLensOptions, selectedDeviceId, zoomRange, zoomValue]);

  const handleZoomSliderChange = async (event) => {
    const rawValue = Number(event.target.value);

    if (zoomRange) {
      await applyZoomValue(rawValue);
      return;
    }

    if (activeFacingMode !== "environment" || discreteLensOptions.length <= 1) return;
    const selectedOption = discreteLensOptions[Math.round(rawValue)];
    if (!selectedOption?.deviceId || selectedOption.deviceId === selectedDeviceId) return;

    await initializeCamera({
      facingMode: activeFacingMode,
      deviceId: selectedOption.deviceId,
      mode: captureMode,
    });
  };

  const flipCamera = async () => {
    const nextFacing = activeFacingMode === "user" ? "environment" : "user";
    const candidateDevices = cameraDevices[nextFacing] || [];
    await initializeCamera({
      facingMode: nextFacing,
      deviceId: candidateDevices[0]?.deviceId || "",
      mode: captureMode,
    });
  };

  const getPreferredVideoMimeType = () => {
    const candidates = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !cameraStream) {
      setError("Camera not ready");
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;

      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setError("Failed to capture photo");
          return;
        }

        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
        stopCamera();
        await Promise.resolve(onCapture?.(file, "photo"));
        onClose?.();
      }, "image/jpeg", 0.94);
    } catch (captureError) {
      console.error("Photo capture failed:", captureError);
      setError("Failed to capture photo");
    }
  };

  const startRecording = () => {
    if (!cameraStream) {
      setError("Camera not ready");
      return;
    }

    try {
      const preferredMimeType = getPreferredVideoMimeType();
      const recorder = new MediaRecorder(
        cameraStream,
        preferredMimeType ? { mimeType: preferredMimeType } : {}
      );
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = preferredMimeType || "video/webm";
        const extension = mimeType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], `video_${Date.now()}.${extension}`, { type: mimeType });
        stopCamera();
        await Promise.resolve(onCapture?.(file, "video"));
        onClose?.();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((current) => current + 1);
      }, 1000);
    } catch (recordError) {
      console.error("Video recording failed to start:", recordError);
      setError("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#05070b",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {cameraStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: cameraStream
              ? "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.08) 22%, rgba(0,0,0,0.08) 78%, rgba(0,0,0,0.75) 100%)"
              : "linear-gradient(180deg, #0f172a 0%, #030712 100%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "max(16px, env(safe-area-inset-top))",
            left: 0,
            right: 0,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose?.();
            }}
            aria-label="Close camera"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(15, 23, 42, 0.55)",
              color: "#fff",
              fontSize: "24px",
              fontWeight: 400,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(12px)",
              pointerEvents: "auto",
            }}
          >
            ×
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", pointerEvents: "auto" }}>
            {isRecording ? (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "999px",
                  background: "rgba(220, 38, 38, 0.92)",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                REC {formatDuration(recordingDuration)}
              </div>
            ) : null}

            <button
              type="button"
              onClick={flipCamera}
              aria-label="Switch camera"
              disabled={loadingCamera || isRecording}
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(15, 23, 42, 0.55)",
                color: "#fff",
                fontSize: "18px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(12px)",
                opacity: loadingCamera || isRecording ? 0.5 : 1,
              }}
            >
              ⇄
            </button>
          </div>
        </div>

        {(loadingCamera || error || !permissionGranted) && !cameraStream ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                maxWidth: "360px",
                padding: "20px 22px",
                borderRadius: "24px",
                background: "rgba(15, 23, 42, 0.72)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
                textAlign: "center",
                backdropFilter: "blur(18px)",
              }}
            >
              <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
                {loadingCamera ? "Opening camera…" : error ? "Camera unavailable" : "Preparing camera…"}
              </div>
              <div style={{ fontSize: "14px", lineHeight: 1.5, color: "rgba(255,255,255,0.78)" }}>
                {error || "Please wait while the device camera is prepared."}
              </div>
            </div>
          </div>
        ) : null}

        {cameraStream ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "16px 16px calc(20px + env(safe-area-inset-bottom))",
              display: "grid",
              gap: "16px",
            }}
          >
            {sliderRange ? (
              <div style={{ display: "flex", justifyContent: "center", pointerEvents: "auto" }}>
                <div
                  style={{
                    width: "min(420px, 86vw)",
                    padding: "10px 14px",
                    borderRadius: "18px",
                    background: "rgba(15, 23, 42, 0.58)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                    display: "grid",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    <span>Zoom</span>
                    <span>{activeZoomLabel}</span>
                  </div>
                  <input
                    type="range"
                    min={sliderRange.min}
                    max={sliderRange.max}
                    step={sliderRange.step}
                    value={sliderValue}
                    onChange={handleZoomSliderChange}
                    disabled={isApplyingZoom || isRecording}
                    style={{ width: "100%" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "11px", color: "rgba(255,255,255,0.72)" }}>
                    {zoomPresetOptions.map((option) => (
                      <span key={option.label}>{option.label}</span>
                    ))}
                    {zoomRange && zoomRange.max > 3 ? <span>{`${zoomRange.max.toFixed(1)}x`}</span> : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: "16px",
                pointerEvents: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px",
                    borderRadius: "999px",
                    background: "rgba(15, 23, 42, 0.62)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {[
                    { id: "photo", label: "Photo" },
                    { id: "video", label: "Video" },
                  ].map((mode) => {
                    const isActive = captureMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => handleModeChange(mode.id)}
                        disabled={isRecording}
                        style={{
                          minWidth: "88px",
                          height: "42px",
                          borderRadius: "999px",
                          border: "none",
                          background: isActive ? "#fff" : "transparent",
                          color: isActive ? "#020617" : "#fff",
                          fontSize: "14px",
                          fontWeight: 700,
                          padding: "0 16px",
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={captureMode === "photo" ? capturePhoto : isRecording ? stopRecording : startRecording}
                disabled={loadingCamera || !!error || !permissionGranted}
                aria-label={captureMode === "photo" ? "Take photo" : isRecording ? "Stop recording" : "Start recording"}
                style={{
                  width: "86px",
                  height: "86px",
                  borderRadius: "999px",
                  border: "4px solid rgba(255,255,255,0.95)",
                  background: captureMode === "photo"
                    ? "rgba(255,255,255,0.18)"
                    : isRecording
                    ? "#ef4444"
                    : "rgba(239, 68, 68, 0.22)",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  justifySelf: "center",
                }}
              >
                <span
                  style={{
                    width: captureMode === "photo" ? "64px" : isRecording ? "28px" : "58px",
                    height: captureMode === "photo" ? "64px" : isRecording ? "28px" : "58px",
                    borderRadius: captureMode === "photo" ? "999px" : isRecording ? "8px" : "999px",
                    background: captureMode === "photo" ? "#fff" : "#ef4444",
                    display: "block",
                  }}
                />
              </button>

              <div style={{ display: "flex", justifyContent: "flex-end", color: "#fff", fontSize: "13px", fontWeight: 700, opacity: 0.86 }}>
                {captureMode === "video" ? (isRecording ? "Tap to stop" : "Tap to record") : "Tap to capture"}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
