// file location: src/pages/api/dev/why-this-system-exists.js
// Dev-only editor endpoint for the hardcoded "Why This System Exists" pitch text.

import fs from "node:fs/promises";
import path from "node:path";
import { withRoleGuard } from "@/lib/auth/roleGuard";

const TARGET_FILE = path.join(
  process.cwd(),
  "src",
  "components",
  "page-ui",
  "dev",
  "dev-user-diagnostic-ui.js"
);

const START_MARKER = "const whyThisSystemExistsSpeechGroups = ";
const END_MARKER = "\n\nexport default function UserDiagnosticDevPageUi";

function normaliseGroups(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((group) => {
      if (!Array.isArray(group)) return [];
      return group
        .map((paragraph) => String(paragraph ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
    })
    .filter((group) => group.length > 0);
}

function serialiseSpeechGroups(groups) {
  const groupBlocks = groups
    .map((group) => {
      const paragraphLines = group
        .map((paragraph) => `    ${JSON.stringify(paragraph)},`)
        .join("\n");
      return `  [\n${paragraphLines}\n  ]`;
    })
    .join(",\n");

  return `${START_MARKER}[\n${groupBlocks},\n];`;
}

async function handler(req, res) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const groups = normaliseGroups(req.body?.groups);
  if (groups.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one speech section with paragraph text is required.",
    });
  }

  const source = await fs.readFile(TARGET_FILE, "utf8");
  const startIndex = source.indexOf(START_MARKER);
  const endIndex = source.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return res.status(500).json({
      success: false,
      message: "Could not find the hardcoded speech section in the source file.",
    });
  }

  const nextSource =
    source.slice(0, startIndex) +
    serialiseSpeechGroups(groups) +
    source.slice(endIndex);

  await fs.writeFile(TARGET_FILE, nextSource, "utf8");

  return res.status(200).json({
    success: true,
    data: { groups },
  });
}

export default withRoleGuard(handler);
