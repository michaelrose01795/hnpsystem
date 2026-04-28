// Phase 1 of the VHC refactor: this module no longer normalises decisions itself.
// All decision/severity normalisation now goes through the canonical engine at
// src/features/vhc/vhcStatusEngine.js (which re-exports the primitives from
// src/lib/vhc/vhcItemState.js). The previous local normalizeAuthorizationState
// was deleted because resolveVhcItemState already handles every alias it covered.
import { resolveVhcItemState } from "@/features/vhc/vhcStatusEngine";

const compactText = (value = "") =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const normaliseText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const firstText = (...values) =>
  values
    .flat()
    .map((value) => (typeof value === "string" ? value.trim() : String(value || "").trim()))
    .find(Boolean) || "";

const toArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const uniqueValues = (values = []) => {
  const seen = new Set();
  const output = [];
  values.forEach((value) => {
    const text = String(value || "").trim();
    if (!text) return;
    const key = compactText(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(text);
  });
  return output;
};

export const normalizePartNumberKey = compactText;

const isChecksheetRow = (row) => {
  const section = String(row?.section || "").trim();
  return section === "VHC_CHECKSHEET" || section === "VHC Checksheet";
};

const isAllocatableVhcRow = (row) => {
  // Single source of truth: resolveVhcItemState normalises approval_status +
  // authorization_state (in either snake_case or camelCase) and exposes
  // isAuthorizedLike (true for AUTHORIZED and COMPLETED). The Complete flag
  // is kept as a separate condition because legacy rows can have Complete=true
  // without a recognised decision string.
  if (!row || isChecksheetRow(row)) return false;
  const state = resolveVhcItemState(row);
  return state.isAuthorizedLike || row?.Complete === true || row?.complete === true;
};

const extractWheelPositionToken = (...values) => {
  const raw = values.filter(Boolean).join(" ");
  const text = normaliseText(raw);
  const compact = compactText(raw).toLowerCase();

  if (text.includes("near side rear") || compact.includes("nsr")) return "nsr";
  if (text.includes("off side rear") || compact.includes("osr")) return "osr";
  if (text.includes("near side front") || compact.includes("nsf")) return "nsf";
  if (text.includes("off side front") || compact.includes("osf")) return "osf";
  if (text.includes("near side") && !text.includes("rear")) return "nsf";
  if (text.includes("off side") && !text.includes("rear")) return "osf";
  return "";
};

const extractTyreSizeKey = (...values) => {
  const raw = values.filter(Boolean).join(" ").toUpperCase();
  const match = raw.match(/(\d{3}\s*\/\s*\d{2}\s*R\s*\d{2})/);
  return match?.[1] ? compactText(match[1]) : "";
};

const buildRowHaystack = (row) =>
  normaliseText(
    [
      row?.displayText,
      row?.description,
      row?.detailText,
      row?.issueTitle,
      row?.issueDescription,
      row?.noteText,
      row?.section,
      ...(toArray(row?.rows)),
    ]
      .filter(Boolean)
      .join(" ")
  );

const buildPartHints = (part = {}) => {
  const partNumber = firstText(
    part?.partNumber,
    part?.part_number,
    part?.part_number_snapshot,
    part?.part?.part_number
  );
  const partName = firstText(
    part?.partName,
    part?.name,
    part?.part_name_snapshot,
    part?.part?.name
  );
  const partDescription = firstText(
    part?.description,
    part?.row_description,
    part?.requestNotes,
    part?.request_notes,
    part?.part?.description
  );

  return {
    partNumber,
    partName,
    partDescription,
    wheelToken: extractWheelPositionToken(partNumber, partName, partDescription),
    tyreSizeKey: extractTyreSizeKey(partNumber, partName, partDescription),
    haystackTokens: uniqueValues(
      normaliseText([partName, partDescription].filter(Boolean).join(" "))
        .split(" ")
        .filter((token) => token.length >= 4)
    ),
  };
};

const scorePartAgainstRow = (part, row) => {
  const partHints = buildPartHints(part);
  const rowHaystack = buildRowHaystack(row);
  if (!rowHaystack) {
    return { score: 0, matchedBy: "none" };
  }

  let score = 0;
  let matchedBy = "text";
  const rowWheelToken = extractWheelPositionToken(
    row?.displayText,
    row?.description,
    row?.detailText,
    row?.issueDescription,
    row?.section
  );
  const rowTyreSizeKey = extractTyreSizeKey(
    row?.displayText,
    row?.description,
    row?.detailText,
    row?.issueDescription,
    row?.section
  );

  if (partHints.wheelToken && rowWheelToken) {
    score += partHints.wheelToken === rowWheelToken ? 70 : -40;
  }

  if (partHints.tyreSizeKey && rowTyreSizeKey) {
    score += partHints.tyreSizeKey === rowTyreSizeKey ? 32 : -18;
  }

  partHints.haystackTokens.forEach((token) => {
    if (rowHaystack.includes(token)) {
      score += token.length >= 6 ? 12 : 7;
    }
  });

  if (partHints.partName) {
    const nameTokens = normaliseText(partHints.partName)
      .split(" ")
      .filter((token) => token.length >= 4);
    const nameHits = nameTokens.filter((token) => rowHaystack.includes(token)).length;
    score += nameHits * 6;
  }

  if (partHints.partDescription) {
    const descriptionTokens = normaliseText(partHints.partDescription)
      .split(" ")
      .filter((token) => token.length >= 4);
    const descriptionHits = descriptionTokens.filter((token) => rowHaystack.includes(token)).length;
    score += descriptionHits * 5;
  }

  if (!partHints.wheelToken && partHints.partNumber) {
    const compactNumber = compactText(partHints.partNumber).toLowerCase();
    if (compactNumber.startsWith("nsf") && rowWheelToken === "nsf") score += 55;
    if (compactNumber.startsWith("osf") && rowWheelToken === "osf") score += 55;
    if (compactNumber.startsWith("nsr") && rowWheelToken === "nsr") score += 55;
    if (compactNumber.startsWith("osr") && rowWheelToken === "osr") score += 55;
  }

  return { score, matchedBy };
};

const buildBaseVhcRows = ({
  jobRequests = [],
  vhcChecks = [],
  authorizedVhcItems = [],
  partsJobItems = [],
} = {}) => {
  const checksById = new Map();
  const requestsByVhcId = new Map();
  const authorisedByVhcId = new Map();
  const linkedPartNumbersByVhcId = new Map();

  toArray(vhcChecks).forEach((check) => {
    const vhcItemId = check?.vhc_id ?? check?.vhcItemId ?? check?.vhc_item_id ?? null;
    if (vhcItemId === null || vhcItemId === undefined || isChecksheetRow(check)) return;
    checksById.set(String(vhcItemId), check);
  });

  toArray(jobRequests).forEach((row) => {
    const vhcItemId = row?.vhc_item_id ?? row?.vhcItemId ?? null;
    if (vhcItemId === null || vhcItemId === undefined) return;
    requestsByVhcId.set(String(vhcItemId), row);
  });

  toArray(authorizedVhcItems).forEach((row) => {
    const vhcItemId = row?.vhcItemId ?? row?.vhc_item_id ?? null;
    if (vhcItemId === null || vhcItemId === undefined) return;
    authorisedByVhcId.set(String(vhcItemId), row);
  });

  toArray(partsJobItems).forEach((part) => {
    const vhcItemId = part?.vhc_item_id ?? part?.vhcItemId ?? null;
    if (vhcItemId === null || vhcItemId === undefined) return;
    const key = String(vhcItemId);
    const existing = linkedPartNumbersByVhcId.get(key) || [];
    existing.push(
      firstText(
        part?.part_number_snapshot,
        part?.partNumber,
        part?.part_number,
        part?.part?.part_number
      )
    );
    linkedPartNumbersByVhcId.set(key, existing);
  });

  const candidateIds = new Set([
    ...checksById.keys(),
    ...requestsByVhcId.keys(),
    ...authorisedByVhcId.keys(),
    ...linkedPartNumbersByVhcId.keys(),
  ]);

  const rows = [];
  candidateIds.forEach((vhcKey) => {
    const check = checksById.get(vhcKey) || null;
    const request = requestsByVhcId.get(vhcKey) || null;
    const authorised = authorisedByVhcId.get(vhcKey) || null;
    const expectedPartNumbers = uniqueValues([
      authorised?.partNumber,
      authorised?.part_number,
      check?.part_number,
      ...(linkedPartNumbersByVhcId.get(vhcKey) || []),
    ]);

    const shouldInclude =
      Boolean(request) ||
      Boolean(authorised) ||
      isAllocatableVhcRow(check);

    if (!shouldInclude) return;

    const vhcItemId = Number(vhcKey);
    rows.push({
      id: `vhc-${vhcKey}`,
      rowKey: `vhc-${vhcKey}`,
      type: "vhc",
      vhcItemId,
      requestId:
        request?.request_id ??
        request?.requestId ??
        authorised?.requestId ??
        authorised?.request_id ??
        check?.request_id ??
        null,
      description: firstText(
        request?.description,
        authorised?.description,
        authorised?.label,
        check?.issue_title,
        check?.issue_description,
        check?.section
      ) || `VHC item ${vhcKey}`,
      displayText: firstText(
        authorised?.label,
        authorised?.description,
        check?.issue_title,
        request?.description,
        check?.section
      ),
      detailText: firstText(
        authorised?.issueDescription,
        authorised?.issue_description,
        request?.note_text,
        request?.noteText,
        check?.issue_description,
        check?.note_text,
        check?.measurement
      ),
      issueTitle: firstText(authorised?.issue_title, check?.issue_title),
      issueDescription: firstText(
        authorised?.issue_description,
        authorised?.issueDescription,
        check?.issue_description,
        check?.note_text
      ),
      noteText: firstText(request?.note_text, request?.noteText, authorised?.noteText, check?.note_text),
      section: firstText(authorised?.section, check?.section),
      status: firstText(
        request?.status,
        authorised?.status,
        check?.authorization_state,
        check?.approval_status
      ),
      authorizationState: firstText(authorised?.authorizationState, check?.authorization_state),
      approvalStatus: firstText(authorised?.approvalStatus, check?.approval_status),
      expectedPartNumbers,
      expectedPartNumber: expectedPartNumbers[0] || "",
      expectedPartNumberDisplay: expectedPartNumbers[0] || "",
      canAllocate: true,
      rows: toArray(authorised?.rows),
    });
  });

  return rows;
};

const attachOrphanVhcPartNumbers = (rows, partsJobItems = []) => {
  const nextRows = rows.map((row) => ({
    ...row,
    expectedPartNumbers: [...(row.expectedPartNumbers || [])],
  }));

  const orphanParts = toArray(partsJobItems).filter((part) => {
    const origin = String(part?.origin || "").toLowerCase();
    const hasLinkedVhcId = part?.vhc_item_id !== null && part?.vhc_item_id !== undefined;
    return origin.includes("vhc") && !hasLinkedVhcId;
  });

  orphanParts.forEach((part) => {
    const matched = matchPartToVhcRequestRow(
      {
        partNumber: firstText(
          part?.part_number_snapshot,
          part?.partNumber,
          part?.part?.part_number
        ),
        partName: firstText(part?.part_name_snapshot, part?.name, part?.part?.name),
        partDescription: firstText(
          part?.row_description,
          part?.request_notes,
          part?.requestNotes,
          part?.part?.description
        ),
      },
      nextRows,
      { directOnly: false }
    );

    if (!matched?.row?.vhcItemId) return;
    const targetRow = nextRows.find(
      (row) => String(row?.vhcItemId) === String(matched.row.vhcItemId)
    );
    if (!targetRow) return;
    targetRow.expectedPartNumbers = uniqueValues([
      ...targetRow.expectedPartNumbers,
      firstText(
        part?.part_number_snapshot,
        part?.partNumber,
        part?.part?.part_number
      ),
    ]);
    targetRow.expectedPartNumber = targetRow.expectedPartNumbers[0] || "";
    targetRow.expectedPartNumberDisplay = targetRow.expectedPartNumbers[0] || "";
  });

  return nextRows.map((row) => ({
    ...row,
    expectedPartNumbers: uniqueValues(row.expectedPartNumbers),
    expectedPartNumber: uniqueValues(row.expectedPartNumbers)[0] || "",
    expectedPartNumberDisplay: uniqueValues(row.expectedPartNumbers)[0] || "",
  }));
};

export const buildVhcRequestLinkRows = (sources = {}) =>
  attachOrphanVhcPartNumbers(buildBaseVhcRows(sources), sources.partsJobItems);

export const matchPartToVhcRequestRow = (part, rows = [], options = {}) => {
  const directOnly = options?.directOnly === true;
  const partNumberKey = compactText(part?.partNumber);
  const candidates = toArray(rows).filter((row) => row?.vhcItemId);

  if (partNumberKey) {
    const directMatches = candidates.filter((row) =>
      toArray(row.expectedPartNumbers).some(
        (value) => compactText(value) === partNumberKey
      )
    );

    if (directMatches.length === 1) {
      return {
        row: directMatches[0],
        matchedBy: "part-number",
        debug: { directMatches: directMatches.map((row) => row.id) },
      };
    }

    if (directMatches.length > 1) {
      const scored = directMatches
        .map((row) => ({ row, ...scorePartAgainstRow(part, row) }))
        .sort((a, b) => b.score - a.score);

      if (scored.length === 1 || scored[0].score > scored[1].score) {
        return {
          row: scored[0].row,
          matchedBy: "part-number+text",
          debug: { directMatches: directMatches.map((row) => row.id) },
        };
      }

      return {
        row: null,
        matchedBy: "ambiguous-part-number",
        debug: { directMatches: directMatches.map((row) => row.id) },
      };
    }
  }

  if (directOnly) {
    return {
      row: null,
      matchedBy: "none",
      debug: { reason: "no-direct-match" },
    };
  }

  const scoredRows = candidates
    .map((row) => ({ row, ...scorePartAgainstRow(part, row) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredRows.length === 0) {
    return {
      row: null,
      matchedBy: "none",
      debug: { reason: "no-positive-text-match" },
    };
  }

  if (
    scoredRows.length === 1 ||
    scoredRows[0].score >= scoredRows[1].score + 10
  ) {
    return {
      row: scoredRows[0].row,
      matchedBy: "text",
      debug: {
        topScore: scoredRows[0].score,
        nextScore: scoredRows[1]?.score ?? null,
      },
    };
  }

  return {
    row: null,
    matchedBy: "ambiguous-text",
    debug: {
      topScore: scoredRows[0].score,
      nextScore: scoredRows[1]?.score ?? null,
      candidates: scoredRows.slice(0, 3).map((entry) => ({
        id: entry.row.id,
        score: entry.score,
      })),
    },
  };
};
