import React from "react";

export default function StatusMessage({
  children,
  tone = "info",
  className = "",
  style,
}) {
  return (
    <div className={["app-status-message", `app-status-message--${tone}`, className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}
