// file location: src/components/dev-platform/DevHealthPill.js
//
// Phase 8 — a compact live health indicator for the Developer Platform shell.
// Polls the dev-gated GET /api/support/health roll-up (sanitiser canary / DB /
// storage / RLS / build) and renders a tinted status Pill. Read-only; it only
// ever shows a status word + colour, never diagnostics content.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pill } from "@/components/support/dev/supportDevUi";

const POLL_MS = 30000;

const STATUS_TONE = {
  ok: "success-base",
  warn: "warning-base",
  fail: "danger-base",
  unknown: "text-1",
};

const STATUS_LABEL = {
  ok: "Healthy",
  warn: "Degraded",
  fail: "Failing",
  unknown: "Health —",
};

export default function DevHealthPill() {
  const [status, setStatus] = useState("unknown");
  const timerRef = useRef(null);

  const probe = useCallback(async () => {
    try {
      const res = await fetch("/api/support/health", { credentials: "include" });
      // 503 is a valid "fail" roll-up, not a transport error — read the body.
      const data = await res.json().catch(() => null);
      setStatus(data?.status || (res.ok ? "ok" : "fail"));
    } catch {
      setStatus("unknown");
    }
  }, []);

  useEffect(() => {
    probe();
    timerRef.current = window.setInterval(probe, POLL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [probe]);

  const tone = STATUS_TONE[status] || STATUS_TONE.unknown;
  return (
    <Pill
      label={STATUS_LABEL[status] || STATUS_LABEL.unknown}
      tone={tone}
      strong
      title="Application health (updates every 30s)"
      style={{ minHeight: 28 }}
    />
  );
}
