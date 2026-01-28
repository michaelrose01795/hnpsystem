"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

export default function ModalPortal({ children }) {
  const mountNode = useMemo(() => {
    if (typeof document === "undefined") return null;
    const node = document.createElement("div");
    node.setAttribute("data-modal-portal", "true");
    return node;
  }, []);

  useEffect(() => {
    if (!mountNode) return undefined;
    document.body.appendChild(mountNode);
    return () => {
      document.body.removeChild(mountNode);
    };
  }, [mountNode]);

  if (!mountNode) return null;
  return createPortal(children, mountNode);
}
