"use client";

// file location: src/pages/job-cards/[jobNumber]/check-box.js
import React, {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
} from "react"; // React hooks for state, refs, and imperative handles
import { useRouter } from "next/router"; // Router hook to access dynamic job number
import Layout from "@/components/Layout"; // Shared layout wrapper for consistent dashboard styling
import { getJobByNumberOrReg, updateJobVhcCheck } from "@/lib/database/jobs"; // Supabase helpers for job/VHC data

const SignaturePad = React.forwardRef(function SignaturePad(
  { penColor = "black", canvasProps = {} },
  ref
) {
  const canvasRef = useRef(null); // Store the actual canvas DOM element
  const contextRef = useRef(null); // Cache the 2D drawing context for reuse
  const drawingRef = useRef(false); // Track whether the pointer is currently drawing
  const hasStrokeRef = useRef(false); // Track whether the user has drawn anything

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1; // Capture device pixel ratio for crisp lines
    const width = canvasProps.width || 600;
    const height = canvasProps.height || 150;

    canvas.width = width * dpr; // Scale canvas backing resolution
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`; // Keep CSS size stable
    canvas.style.height = `${height}px`;
    canvas.style.touchAction = "none"; // Prevent scrolling while drawing on touch devices

    const context = canvas.getContext("2d");
    if (!context) return;

    context.scale(dpr, dpr); // Normalize drawing coordinates to CSS pixels
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2;
    context.strokeStyle = penColor;
    contextRef.current = context;
  }, [penColor, canvasProps.width, canvasProps.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const getCanvasPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX ?? 0) - rect.left);
      const y = ((event.clientY ?? 0) - rect.top);
      return { x, y };
    };

    const startDrawing = (event) => {
      drawingRef.current = true;
      hasStrokeRef.current = true;
      canvas.setPointerCapture(event.pointerId);
      const { x, y } = getCanvasPoint(event);
      context.beginPath();
      context.moveTo(x, y);
    };

    const drawStroke = (event) => {
      if (!drawingRef.current) return;
      event.preventDefault();
      const { x, y } = getCanvasPoint(event);
      context.lineTo(x, y);
      context.stroke();
    };

    const stopDrawing = (event) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      canvas.releasePointerCapture(event.pointerId);
      context.closePath();
    };

    canvas.addEventListener("pointerdown", startDrawing);
    canvas.addEventListener("pointermove", drawStroke);
    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointerleave", stopDrawing);

    return () => {
      canvas.removeEventListener("pointerdown", startDrawing);
      canvas.removeEventListener("pointermove", drawStroke);
      canvas.removeEventListener("pointerup", stopDrawing);
      canvas.removeEventListener("pointerleave", stopDrawing);
    };
  }, [penColor, canvasProps.width, canvasProps.height]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      hasStrokeRef.current = false;
    },
    isEmpty: () => !hasStrokeRef.current,
    getCanvas: () => canvasRef.current,
    fromDataURL: (dataUrl) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context || !dataUrl) return;
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        hasStrokeRef.current = true;
      };
      image.src = dataUrl;
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      width={canvasProps.width || 600}
      height={canvasProps.height || 150}
      className={canvasProps.className || "sigCanvas"}
      style={canvasProps.style || { border: "1px solid var(--text-primary)", borderRadius: "8px" }}
    />
  );
});

export default function CheckBoxPage() {
  const router = useRouter(); // Access the Next.js router
  const { jobNumber } = router.query; // Read the dynamic job number from the URL
  const [formFields, setFormFields] = useState([]); // Store checkbox configuration
  const [loading, setLoading] = useState(true); // Track whether data is being loaded
  const sigCanvas = useRef(null); // Reference to our custom signature pad

  useEffect(() => {
    if (!jobNumber) return; // Wait until the router provides the job number

    const loadCheckSheet = async () => {
      const job = await getJobByNumberOrReg(jobNumber); // Fetch job data including VHC checks
      const defaultFields = [
        "Oil Level",
        "Brakes Condition",
        "Tyres Condition",
        "Lights Working",
        "Fluid Levels",
        "Suspension Check",
      ];

      if (job?.vhcChecks?.length > 0) {
        const existing = job.vhcChecks[0]; // Assume single VHC record per job
        setFormFields(
          defaultFields.map((name) => ({
            name,
            checked: Boolean(existing[name]),
          }))
        );
        if (existing.signature) {
          sigCanvas.current?.fromDataURL(existing.signature); // Restore saved signature
        }
      } else {
        setFormFields(defaultFields.map((name) => ({ name, checked: false })));
      }

      setLoading(false);
    };

    loadCheckSheet();
  }, [jobNumber]);

  const toggleCheckbox = (index) => {
    setFormFields((prev) =>
      prev.map((field, idx) =>
        idx === index ? { ...field, checked: !field.checked } : field
      )
    );
  };

  const checkAll = () => {
    setFormFields((prev) => prev.map((field) => ({ ...field, checked: true })));
  };

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleSave = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert("Please provide a signature before saving.");
      return;
    }

    const signatureData = sigCanvas.current.getCanvas().toDataURL("image/png");
    const checkData = {};
    formFields.forEach((field) => {
      checkData[field.name] = field.checked;
    });
    checkData.signature = signatureData;

    try {
      const result = await updateJobVhcCheck(jobNumber, checkData);
      if (result.success) {
        alert("Check sheet saved successfully");
        router.push(`/job-cards/${jobNumber}`);
      } else {
        alert("Failed to save check sheet");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to save check sheet");
    }
  };

  const goBackToJobCard = () => router.push(`/job-cards/${jobNumber}`);
  const goToWriteUp = () => router.push(`/job-cards/${jobNumber}/write-up`);
  const goToVehicleDetails = () => router.push(`/job-cards/${jobNumber}/car-details`);

  if (loading) {
    return (
      <Layout>
        <p>Loading check sheet...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "16px" }}>
        <h2>Service Check Sheet for Job {jobNumber}</h2>

        {formFields.map((field, index) => (
          <div key={field.name} style={{ marginBottom: "8px" }}>
            <label>
              <input
                type="checkbox"
                checked={field.checked}
                onChange={() => toggleCheckbox(index)}
              />
              {field.name}
            </label>
          </div>
        ))}

        <h3>Technician Signature</h3>
        <SignaturePad
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            width: 600,
            height: 150,
            className: "sigCanvas",
            style: { border: "1px solid var(--text-primary)", borderRadius: "8px" },
          }}
        />

        <div style={{ marginTop: "16px" }}>
          <button
            onClick={handleClearSignature}
            style={{
              marginRight: "12px",
              padding: "8px 16px",
              backgroundColor: "var(--background)",
              border: "none",
              borderRadius: "6px",
            }}
          >
            Clear
          </button>

          <button
            onClick={handleSave}
            style={{
              marginRight: "12px",
              padding: "8px 16px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "6px",
            }}
          >
            Save Check Sheet
          </button>

          <button
            onClick={checkAll}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "6px",
            }}
          >
            Check All
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
          <button
            onClick={goBackToJobCard}
            style={{
              flex: 1,
              marginRight: "8px",
              padding: "12px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "6px",
            }}
          >
            Back to Job Card
          </button>

          <button
            onClick={goToWriteUp}
            style={{
              flex: 1,
              marginRight: "8px",
              padding: "12px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "6px",
            }}
          >
            Write-Up
          </button>

          <button
            onClick={goToVehicleDetails}
            style={{
              flex: 1,
              padding: "12px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "6px",
            }}
          >
            Vehicle Details
          </button>
        </div>
      </div>
    </Layout>
  );
}
