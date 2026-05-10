/**
 * React wrapper around <fidemark-region>. Registers the web component on
 * import and renders it as a JSX element. The component itself does the
 * verification work; this wrapper exists so React consumers do not have to
 * touch `customElements.define` manually.
 */
import * as React from "react";
import "./region.js";

export interface FidemarkRegionProps {
  uid: string;
  contentHash: string;
  apiBase?: string;
  outline?: "subtle" | "strong" | "off";
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "fidemark-region": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          uid?: string;
          "content-hash"?: string;
          "api-base"?: string;
          outline?: "subtle" | "strong" | "off";
        },
        HTMLElement
      >;
    }
  }
}

export function FidemarkRegion({
  uid,
  contentHash,
  apiBase,
  outline,
  className,
  style,
  children,
}: FidemarkRegionProps): React.ReactElement {
  // The custom element upgrades itself once the bundle defines it, then
  // mutates its own host (style.outline, an injected <aside> overlay).
  // React's hydration check sees the post-mutation DOM and reports a
  // mismatch against the clean server HTML. `suppressHydrationWarning`
  // is the canonical escape hatch for elements managed outside React,
  // and the connectedCallback also defers to requestAnimationFrame so
  // hydration has a chance to settle before any mutation happens.
  return React.createElement(
    "fidemark-region",
    {
      uid,
      "content-hash": contentHash,
      "api-base": apiBase,
      outline,
      className,
      style,
      suppressHydrationWarning: true,
    },
    children,
  );
}
