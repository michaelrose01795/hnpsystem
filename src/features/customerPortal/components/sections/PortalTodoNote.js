// file location: src/features/customerPortal/components/sections/PortalTodoNote.js
// Small-print "API not linked yet" note shown above unavailable live sections. Colors are
// fixed for the permanent-dark /website skin (light text on dark glass) so
// they read correctly regardless of the user's theme.
import React from "react";

export default function PortalTodoNote({ label = "API not linked yet", detail }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 11,
        lineHeight: 1.5,
        color: "rgba(255, 255, 255, 0.55)",
        fontStyle: "italic",
      }}
    >
      <span style={{ fontWeight: 700, color: "rgba(255, 220, 220, 0.85)" }}>
        TODO · {label}.
      </span>{" "}
      {detail ||
        "Connection to the required API or database table is still required."}
    </p>
  );
}
