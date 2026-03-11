// file location: src/components/ui/index.js
// Barrel export for all shared UI components.
// Usage: import { Card, Button, PageWrapper } from "@/components/ui";

// Layout components
export { default as PageWrapper } from "./PageWrapper";
export { default as PageContainer } from "./PageContainer";
export { default as PageSection } from "./PageSection";
export { default as Card } from "./Card";
export { default as ToolbarRow } from "./ToolbarRow";
export { default as ControlGroup } from "./ControlGroup";
export { default as StatusMessage } from "./StatusMessage";

// Control components
export { default as Button } from "./Button";
export { default as InputField } from "./InputField";

// Shared layout architecture
export * from "./layout-system";
