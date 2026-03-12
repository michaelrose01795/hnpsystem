// file location: src/components/Section.js
// Canonical section card component for the entire app.
// This is an alias for the Card component in src/components/ui/Card.js.
// All consumers of SectionCard should import directly from this file.
// The intermediate re-exports in MetricCard.js and DashboardPrimitives.js have been removed.
export { default } from "./ui/Card"; // default export: use as <Section> (renders the Card component)
export { default as SectionCard } from "./ui/Card"; // named export: replaces MetricCard.SectionCard and DashboardPrimitives.SectionCard
