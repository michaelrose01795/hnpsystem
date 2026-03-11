import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

export default function PasswordRevertedPage() {
  const router = useRouter();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Reverting password...");
  const [originalPassword, setOriginalPassword] = useState("");
  const [revealed, setRevealed] = useState(false);

  const token = useMemo(() => {
    if (!router.isReady) return "";
    const value = router.query?.token;
    return typeof value === "string" ? value : "";
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing reset token.");
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "revert", token }),
        });
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = { success: false, message: `Request failed (${response.status}).` };
        }

        if (cancelled) return;

        if (!response.ok || !payload?.success) {
          setStatus("error");
          setMessage(payload?.message || "Unable to revert password.");
          return;
        }

        setOriginalPassword(String(payload?.revertedPassword || ""));
        setStatus("success");
        setMessage("Password has been reverted.");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(error?.message || "Unable to revert password.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, token]);

  const statusColor = status === "success" ? "#22c55e" : status === "error" ? "#ef4444" : "#b91c1c";

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        background: "#000000",
        color: "#f9fafb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "#0f172a",
          border: "1px solid #374151",
          borderTop: "4px solid #b91c1c",
          borderRadius: "var(--radius-md)",
          padding: "26px",
          textAlign: "center",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <h1 style={{ margin: "0 0 10px", fontSize: "1.5rem", color: "#ffffff" }}>
          {status === "success" ? "Password Reverted" : status === "error" ? "Revert Failed" : "Working..."}
        </h1>
        <p style={{ margin: "0 0 18px", color: "#d1d5db", lineHeight: 1.5 }}>{message}</p>
        <div style={{ width: "72px", height: "3px", background: statusColor, margin: "0 auto 20px", borderRadius: "var(--radius-pill)" }} />

        {status === "success" && (
          <div
            style={{
              margin: "0 auto",
              textAlign: "center",
              maxWidth: "420px",
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: "var(--radius-sm)",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Original Password
            </p>
            <div
              style={{
                width: "100%",
                maxWidth: "360px",
                border: "1px solid #4b5563",
                borderRadius: "var(--radius-xs)",
                background: "#030712",
                color: "#f9fafb",
                padding: "10px 12px",
                fontFamily: "monospace",
                minHeight: "40px",
                boxSizing: "border-box",
                wordBreak: "break-all",
              }}
            >
              {revealed ? originalPassword || "(empty password)" : "••••••••••••"}
            </div>
            <button
              type="button"
              onClick={() => setRevealed((prev) => !prev)}
              style={{
                marginTop: "10px",
                border: "none",
                borderRadius: "var(--radius-xs)",
                background: "#b91c1c",
                color: "#ffffff",
                padding: "9px 12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {revealed ? "Hide Original Password" : "Reveal Original Password"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
