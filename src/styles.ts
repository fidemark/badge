import type { CSSProperties } from "react";

export interface ThemeStyles {
  container: CSSProperties;
  pillHuman: CSSProperties;
  pillAI: CSSProperties;
  pillRevoked: CSSProperties;
  pillError: CSSProperties;
  text: CSSProperties;
  link: CSSProperties;
  icon: CSSProperties;
}

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4em",
  borderRadius: "9999px",
  padding: "0.25em 0.7em",
  fontFamily:
    "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
  fontSize: "0.85em",
  fontWeight: 500,
  lineHeight: 1.2,
  textDecoration: "none",
  cursor: "pointer",
  transition: "opacity 150ms ease",
};

export function styleFor(theme: "light" | "dark"): ThemeStyles {
  const dark = theme === "dark";
  return {
    container: {
      ...base,
      backgroundColor: dark ? "#18181b" : "#fafafa",
      color: dark ? "#fafafa" : "#18181b",
      border: `1px solid ${dark ? "#3f3f46" : "#e4e4e7"}`,
    },
    pillHuman: { color: dark ? "#a7f3d0" : "#065f46", fontWeight: 600 },
    pillAI: { color: dark ? "#ddd6fe" : "#5b21b6", fontWeight: 600 },
    pillRevoked: { color: dark ? "#fca5a5" : "#991b1b", fontWeight: 600 },
    pillError: { color: dark ? "#fca5a5" : "#7f1d1d", fontWeight: 500 },
    text: {},
    // No `color` here, the container already sets it, and `inherit` would
    // override it with whatever the surrounding page uses (which broke the
    // ✓ glyph in dark theme on light-mode pages).
    link: { textDecoration: "none" },
    icon: { fontSize: "0.9em" },
  };
}
