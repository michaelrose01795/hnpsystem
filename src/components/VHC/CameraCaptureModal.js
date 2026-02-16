// file location: src/components/VHC/CameraCaptureModal.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import VHCModalShell, { buildModalButton } from "./VHCModalShell";

export default function CameraCaptureModal({ isOpen, onClose, onCapture, initialMode = "photo" }) {
  const [cameraStream, setCameraStream] = useState(null);
  const [captureMode, setCaptureMode] = useState(initialMode);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);

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

  // Initialize camera on modal open
  useEffect(() => {
    if (isOpen) {
      initializeCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Get available cameras
  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === "videoinput");
      setAvailableCameras(cameras);
      return cameras;
    } catch (err) {
      console.error("Error enumerating devices:", err);
      return [];
    }
  };

  // Initialize camera
  const initializeCamera = async () => {
    try {
      setError(null);

      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Camera not supported in this browser");
        return;
      }

      // Get available cameras
      const cameras = await getAvailableCameras();

      // Determine which camera to use
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: captureMode === "photo" ? "environment" : "user",
        },
        audio: captureMode === "video",
      };

      if (selectedCamera) {
        constraints.video.deviceId = { exact: selectedCamera };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      setCameraStream(stream);
      setPermissionGranted(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Set selected camera if not already set
      if (!selectedCamera && cameras.length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        setSelectedCamera(settings.deviceId);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);

      if (err.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else if (err.name === "NotReadableError") {
        setError("Camera is already in use by another application.");
      } else {
        setError(`Camera error: ${err.message}`);
      }
    }
  };

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
    setRecordingDuration(0);
  }, [cameraStream]);

  // Switch camera
  const switchCamera = async (deviceId) => {
    stopCamera();
    setSelectedCamera(deviceId);

    // Reinitialize with new camera
    setTimeout(() => {
      initializeCamera();
    }, 100);
  };

  // Toggle mode (photo/video)
  const toggleMode = () => {
    stopCamera();
    const newMode = captureMode === "photo" ? "video" : "photo";
    setCaptureMode(newMode);

    // Reinitialize camera with new mode
    setTimeout(() => {
      initializeCamera();
    }, 100);
  };

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !cameraStream) {
      setError("Camera not ready");
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const fileName = `photo_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: "image/jpeg" });
            onCapture(file, "photo");
            stopCamera();
            onClose();
          }
        },
        "image/jpeg",
        0.92
      );
    } catch (err) {
      console.error("Error capturing photo:", err);
      setError("Failed to capture photo");
    }
  };

  // Start recording video
  const startRecording = () => {
    if (!cameraStream) {
      setError("Camera not ready");
      return;
    }

    try {
      const preferredMimeType = getPreferredVideoMimeType();
      const options = preferredMimeType ? { mimeType: preferredMimeType } : {};
      const mediaRecorder = new MediaRecorder(cameraStream, options);
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const outputMimeType = preferredMimeType || "video/webm";
        const extension = outputMimeType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(chunks, { type: outputMimeType });
        const fileName = `video_${Date.now()}.${extension}`;
        const file = new File([blob], fileName, { type: outputMimeType });
        onCapture(file, "video");
        stopCamera();
        onClose();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Failed to start recording");
    }
  };

  // Stop recording video
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle close
  const handleClose = () => {
    stopCamera();
    onClose();
  };

  // Modal footer
  const footer = (
    <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", width: "100%" }}>
      <button
        onClick={handleClose}
        style={{
          ...buildModalButton("ghost"),
          padding: "10px 20px",
        }}
      >
        Cancel
      </button>

      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={toggleMode}
          style={{
            ...buildModalButton("secondary"),
            padding: "10px 20px",
          }}
          disabled={isRecording}
        >
          Switch to {captureMode === "photo" ? "Video" : "Photo"}
        </button>

        {captureMode === "photo" ? (
          <button
            onClick={capturePhoto}
            style={{
              ...buildModalButton("primary"),
              padding: "10px 20px",
            }}
            disabled={!permissionGranted || !!error}
          >
            Capture Photo
          </button>
        ) : (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              ...buildModalButton(isRecording ? "danger" : "primary"),
              padding: "10px 20px",
            }}
            disabled={!permissionGranted || !!error}
          >
            {isRecording ? `Stop Recording (${formatDuration(recordingDuration)})` : "Start Recording"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      title={`Capture ${captureMode === "photo" ? "Photo" : "Video"}`}
      subtitle={error ? null : "Position your camera and capture"}
      width="800px"
      height="650px"
      onClose={handleClose}
      footer={footer}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
        {/* Camera Selection */}
        {availableCameras.length > 1 && !error && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)" }}>
              Camera:
            </label>
            <select
              value={selectedCamera || ""}
              onChange={(e) => switchCamera(e.target.value)}
              disabled={isRecording}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--accent-purple-surface)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: "14px",
              }}
            >
              {availableCameras.map((camera, index) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Video Preview */}
        <div style={{
          flex: 1,
          background: "var(--background)",
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}>
          {error ? (
            <div style={{
              textAlign: "center",
              padding: "40px",
              color: "var(--danger)",
            }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
              <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                Camera Error
              </div>
              <div style={{ fontSize: "14px", color: "var(--info)" }}>
                {error}
              </div>
            </div>
          ) : !permissionGranted ? (
            <div style={{
              textAlign: "center",
              padding: "40px",
              color: "var(--info)",
            }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📷</div>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>
                Initializing camera...
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />

              {isRecording && (
                <div style={{
                  position: "absolute",
                  top: "16px",
                  left: "16px",
                  background: "rgba(220, 38, 38, 0.9)",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}>
                  <div style={{
                    width: "8px",
                    height: "8px",
                    background: "white",
                    borderRadius: "50%",
                    animation: "pulse 1s infinite",
                  }} />
                  REC {formatDuration(recordingDuration)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Mode Indicator */}
        <div style={{
          textAlign: "center",
          fontSize: "14px",
          color: "var(--info)",
          fontWeight: 600,
        }}>
          Mode: {captureMode === "photo" ? "📸 Photo" : "🎥 Video"}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </VHCModalShell>
  );
}
