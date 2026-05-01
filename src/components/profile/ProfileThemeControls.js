import { useMemo } from "react";
import { ACCENT_PALETTES, useTheme } from "@/styles/themeProvider";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import Button from "@/components/ui/Button";

const SAFE_ACCENT_PALETTES =
ACCENT_PALETTES && typeof ACCENT_PALETTES === "object" ?
ACCENT_PALETTES :
{
  red: { label: "Red", light: "#b91c1c", dark: "#f87171" }
};

function AccentOptionContent({ label, light, dark }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        minWidth: 0
      }}>
      <span
        aria-hidden="true"
        style={{
          width: "12px",
          height: "12px",
          borderRadius: "var(--radius-pill)",
          border: "1px solid rgba(var(--text-1-rgb), 0.2)",
          background: light,
          flexShrink: 0
        }} />
      <span
        style={{
          fontWeight: 700,
          color: dark,
          lineHeight: 1.1
        }}>
        {label}
      </span>
    </span>);
}

export default function ProfileThemeControls({
  visible = true,
  dropdownWidth = "170px",
  className = "",
  justifyContent = "flex-end",
  style = undefined
}) {
  const { mode: themeMode, resolvedMode, toggleTheme, accent, setAccent } = useTheme();

  const themeLabel = useMemo(() => {
    if (themeMode === "system") {
      return `System (${resolvedMode === "dark" ? "dark" : "light"})`;
    }
    return themeMode === "dark" ? "Dark mode" : "Light mode";
  }, [resolvedMode, themeMode]);

  const accentOptions = useMemo(
    () =>
    Object.entries(SAFE_ACCENT_PALETTES).map(([value, palette]) => ({
      value,
      label: <AccentOptionContent label={palette.label} light={palette.light} dark={palette.dark} />
    })),
    []
  );

  if (!visible) return null;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        justifyContent,
        ...style
      }}>
      <div style={{ minWidth: dropdownWidth, width: dropdownWidth }}>
        <DropdownField
          value={accent}
          onValueChange={setAccent}
          options={accentOptions}
          className="profile-accent-dropdown"
          size="sm" />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={toggleTheme}
        aria-label="Cycle theme">
        {themeLabel}
      </Button>
    </div>);
}
