/**
 * React component entry. Pulled in via `import { FidemarkBadge } from "@fidemark/badge"`.
 *
 * For non-React embeds (vanilla HTML / Vue / Svelte), use the `web-component`
 * subpath which registers <fidemark-badge> globally.
 */
export { FidemarkBadge } from "./react.js";
export { FidemarkRegion } from "./region-react.js";
export type { FidemarkRegionProps } from "./region-react.js";
export type { BadgeProps, BadgeAttestation, BadgeStatus } from "./types.js";
