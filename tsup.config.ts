import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    external: ["react", "react-dom"],
  },
  {
    // Web Component bundle, standalone, no React peer required at runtime.
    entry: { "web-component": "src/web-component.ts" },
    format: ["esm", "cjs", "iife"],
    globalName: "FidemarkBadge",
    dts: true,
    sourcemap: true,
    target: "es2022",
  },
  {
    // <fidemark-region> bundle, standalone web component for region-level
    // verification. Includes its own canonicalization helpers.
    entry: { region: "src/region.ts" },
    format: ["esm", "cjs", "iife"],
    globalName: "FidemarkRegion",
    dts: true,
    sourcemap: true,
    target: "es2022",
  },
]);
