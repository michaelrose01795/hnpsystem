// file location: src/components/ui/index.js
// Barrel export for all shared UI components.
// Usage: import { Card, Button, PageWrapper } from "@/components/ui";

// Layout components
export { default as PageWrapper } from "./PageWrapper";
export { default as PageContainer } from "./PageContainer";
export { default as PageSection } from "./PageSection";
export { default as Card } from "./Card";
export { default as LayerSurface } from "./LayerSurface";
export { default as LayerTheme } from "./LayerTheme";
// ToolbarRow not re-exported from barrel — 4 live consumers in src/pages/accounts and src/components/accounts still import it directly; pending migration to FilterToolbarRow
export { default as ControlGroup } from "./ControlGroup";
export { default as StatusMessage } from "./StatusMessage";

// Control components
export { default as Button } from "./Button";
export { default as InputField } from "./InputField";

// Staff layout/UI building blocks (staffglobal.css class-driven)
export { default as StaffPageHeader } from "./StaffPageHeader";
export { default as StaffCard } from "./StaffCard";
export { default as StaffCardGrid } from "./StaffCardGrid";
export { default as StaffButton } from "./StaffButton";
export { default as StaffTabs } from "./StaffTabs";

// Shared layout architecture
export * from "./layout-system";
