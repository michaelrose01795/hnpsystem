export const WORKSHOP_ASSIGNMENT_TYPES = Object.freeze({
  TECH: "tech",
  MOT: "mot",
});

export const WORKSHOP_ASSIGNMENT_OPTIONS = Object.freeze([
  { value: WORKSHOP_ASSIGNMENT_TYPES.TECH, label: "Tech section" },
  { value: WORKSHOP_ASSIGNMENT_TYPES.MOT, label: "MOT section" },
]);

export const isWorkshopAssignmentType = (value) =>
  Object.values(WORKSHOP_ASSIGNMENT_TYPES).includes(String(value || "").trim().toLowerCase());

export const isMotAccountRole = (role) => {
  const value = String(role || "").trim().toLowerCase();
  return value.includes("mot") || value === "tester";
};

export const getDefaultWorkshopAssignment = (role) =>
  isMotAccountRole(role) ? WORKSHOP_ASSIGNMENT_TYPES.MOT : WORKSHOP_ASSIGNMENT_TYPES.TECH;

export const resolveWorkshopAssignment = (role, dailyAssignment) => {
  const normalized = String(dailyAssignment || "").trim().toLowerCase();
  return isWorkshopAssignmentType(normalized)
    ? normalized
    : getDefaultWorkshopAssignment(role);
};
