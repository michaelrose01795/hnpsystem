// file location: src/pages/password-reset/reverted.js
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import PasswordRevertedPageUi from "@/components/page-ui/password-reset/password-reset-reverted-ui"; // Extracted presentation layer.

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
          body: JSON.stringify({ action: "revert", token })
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

  return <PasswordRevertedPageUi view="section1" message={message} originalPassword={originalPassword} revealed={revealed} setRevealed={setRevealed} status={status} statusColor={statusColor} />;
























































































}
