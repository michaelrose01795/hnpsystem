import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parseStaffStyleAudit } from "@/lib/staff-style-review/auditParser";

export const STAFF_STYLE_AUDIT_PATH = "docs/Not following staffglobal.css setting.md";

export function loadStaffStyleAuditSource() {
  const absolutePath = path.join(process.cwd(), STAFF_STYLE_AUDIT_PATH);
  const markdown = fs.readFileSync(absolutePath, "utf8");
  const parsed = parseStaffStyleAudit(markdown);
  return {
    ...parsed,
    sourcePath: STAFF_STYLE_AUDIT_PATH,
    sourceHash: crypto.createHash("sha256").update(markdown).digest("hex"),
  };
}

