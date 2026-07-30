const normaliseText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const BRAKE_COMPONENT_RE = /^(front|rear)\s+(pads?|discs?|drums?)$/;

const uniqueText = (values = []) => {
  const seen = new Set();
  return values.filter((value) => {
    const key = normaliseText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const uniqueParts = (parts = []) => {
  const seen = new Set();
  return parts.filter((part) => {
    const key = String(part?.id || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const aggregateConsolidatedBrakeValues = (items = []) => {
  const uniqueSourceItems = Array.from(
    new Map(
      (items || []).map((item, index) => [
        String(item?.canonicalId || item?.vhcCheck?.vhc_id || item?.id || `row-${index}`),
        item,
      ])
    ).values()
  );
  const sourceVhcIds = uniqueText(
    uniqueSourceItems.flatMap((item) => [
      item?.id,
      item?.canonicalId,
      item?.vhcCheck?.vhc_id,
    ])
  );
  const partsTotal = uniqueSourceItems.reduce((total, item) => {
    const value = Number(item?.parts_gbp);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
  const labourHours = uniqueSourceItems.reduce((highest, item) => {
    const value = Number(item?.labour_hours);
    return Number.isFinite(value) && value > highest ? value : highest;
  }, 0);

  return {
    sourceVhcIds,
    partsTotal,
    labourHours,
    partsComplete: uniqueSourceItems.some((item) => item?.partsComplete),
    labourComplete: uniqueSourceItems.some((item) => item?.labourComplete),
  };
};

const resolveBrakeComponent = (item) => {
  const categoryId = item?.vhcItem?.category?.id || item?.vhcItem?.categoryId || "";
  if (categoryId !== "brakes_hubs") return null;
  const match = normaliseText(item?.vhcItem?.label).match(BRAKE_COMPONENT_RE);
  if (!match) return null;
  return { axle: match[1], component: match[2].replace(/s$/, "") };
};

const formatComponentLabel = (component) => {
  if (component === "pad") return "Pads";
  if (component === "disc") return "Discs";
  return "Drums";
};

const formatComponentDetail = (item, component) => {
  const measurement = String(item?.vhcItem?.measurement || "").trim();
  const rows = Array.isArray(item?.vhcItem?.rows)
    ? item.vhcItem.rows.map((row) => String(row || "").trim()).filter(Boolean)
    : [];
  const details = uniqueText([measurement, ...rows])
    .map((value) => (/^visual$/i.test(value) ? "Visual check" : value))
    .join(" · ");
  return details ? `${formatComponentLabel(component)}: ${details}` : formatComponentLabel(component);
};

const isRelatedBrakeConcern = (item, axle, components) => {
  const categoryId = item?.vhcItem?.category?.id || item?.vhcItem?.categoryId || "";
  if (categoryId !== "brakes_hubs") return false;
  if (resolveBrakeComponent(item)) return false;

  const text = normaliseText(
    [
      item?.vhcItem?.label,
      item?.vhcItem?.notes,
      item?.vhcItem?.concernText,
      ...(Array.isArray(item?.vhcItem?.rows) ? item.vhcItem.rows : []),
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (!text.includes(axle)) return false;
  return Array.from(components).some((component) => {
    if (component === "pad") return /\bpads?\b/.test(text);
    if (component === "disc") return /\bdiscs?\b/.test(text);
    return /\bdrums?\b/.test(text);
  });
};

const pickAnchor = (members) =>
  members.find((item) => item?.vhcItem?.vhcCheck?.vhc_id) ||
  members.find((item) => /^\d+$/.test(String(item?.canonicalVhcId || ""))) ||
  members[0];

const buildConcernText = (members) =>
  uniqueText(
    members.flatMap((item) => {
      if (resolveBrakeComponent(item)) return [];
      return [
        item?.vhcItem?.concernText,
        item?.vhcItem?.notes,
        item?.vhcItem?.label,
      ];
    })
  ).join(" · ");

export const consolidateBrakePartsDisplayRows = (displayItems = []) => {
  const componentGroups = new Map();

  displayItems.forEach((item) => {
    const brakeComponent = resolveBrakeComponent(item);
    if (!brakeComponent) return;
    if (!componentGroups.has(brakeComponent.axle)) {
      componentGroups.set(brakeComponent.axle, []);
    }
    componentGroups.get(brakeComponent.axle).push({ item, ...brakeComponent });
  });

  const consumed = new Set();
  const replacements = new Map();

  componentGroups.forEach((componentRows, axle) => {
    const components = new Set(componentRows.map((row) => row.component));
    if (components.size < 2) return;

    const componentItems = componentRows.map((row) => row.item);
    const relatedConcerns = displayItems.filter((item) =>
      !componentItems.includes(item) && isRelatedBrakeConcern(item, axle, components)
    );
    const members = [...componentItems, ...relatedConcerns];
    const anchor = pickAnchor([...relatedConcerns, ...componentItems]);
    if (!anchor) return;

    const detailRows = componentRows.map(({ item, component }) =>
      formatComponentDetail(item, component)
    );
    const concernText = buildConcernText(relatedConcerns);
    const sourceVhcIds = uniqueText(
      members.flatMap((item) => [
        item?.vhcId,
        item?.canonicalVhcId,
        ...(Array.isArray(item?.sourceVhcIds) ? item.sourceVhcIds : []),
      ])
    );

    const consolidated = {
      ...anchor,
      linkedParts: uniqueParts(members.flatMap((item) => item?.linkedParts || [])),
      sourceVhcIds,
      vhcItem: {
        ...anchor.vhcItem,
        label: `${axle === "rear" ? "Rear" : "Front"} Brakes`,
        measurement: "",
        rows: detailRows,
        notes: concernText,
        concernText,
        isConsolidatedBrakeRow: true,
      },
    };

    replacements.set(componentItems[0], consolidated);
    members.forEach((item) => consumed.add(item));
  });

  return displayItems.flatMap((item) => {
    if (replacements.has(item)) return [replacements.get(item)];
    if (consumed.has(item)) return [];
    return [item];
  });
};
