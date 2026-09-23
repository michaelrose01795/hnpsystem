// file location: src/features/customers/hub/useCopyToClipboard.js
//
// Copy-to-clipboard with a short "Copied" acknowledgement. Used by the contact
// details on the customer record, which staff read down the phone all day.

import { useCallback, useEffect, useRef, useState } from "react";

export default function useCopyToClipboard(resetAfterMs = 1800) {
  const [copied, setCopied] = useState("");
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = useCallback(
    async (value) => {
      const text = String(value ?? "").trim();
      if (!text) return false;

      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else if (typeof document !== "undefined") {
          // Fallback for insecure contexts / older browsers on the shop floor.
          const field = document.createElement("textarea");
          field.value = text;
          field.setAttribute("readonly", "");
          document.body.appendChild(field);
          field.select();
          document.execCommand("copy");
          document.body.removeChild(field);
        } else {
          return false;
        }
      } catch (_err) {
        return false;
      }

      setCopied(text);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(""), resetAfterMs);
      return true;
    },
    [resetAfterMs]
  );

  return { copy, copied };
}
