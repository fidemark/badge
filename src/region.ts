/**
 * <fidemark-region uid="0x.." content-hash="0x..">...</fidemark-region>
 *
 * Wraps a content subtree and declares it as an attested region. The
 * component performs three checks and renders a status pill anchored to
 * the region:
 *
 *   1. Recompute the canonical hash of the wrapped subtree (via
 *      canonicalizeDom) and compare to the declared `content-hash`.
 *   2. Fetch the attestation by UID and compare its on-chain
 *      `contentHash` to the declared hash.
 *   3. Watch revocation status and DOM mutation.
 *
 * Status states:
 *   - verified:    declared == recomputed == on-chain && !revoked
 *   - tampered:    declared != recomputed (page content drifted)
 *   - mismatch:    declared != on-chain (attester or markup error)
 *   - revoked:     3-way match but on-chain revoked
 *   - unreachable: network error fetching the attestation
 *
 * Wrapping is light-DOM so the content stays selectable, indexable, and
 * accessible. The pill + side panel live in a shadow root attached to a
 * sibling `<aside>` injected after children, anchored visually via
 * `position: absolute` against the host (which gets `position: relative`).
 *
 * The class definition lives inside `register()` so this module is safe
 * to import in environments where HTMLElement is undefined (Next.js
 * server components, SSR, RSC). On the client the bundle calls
 * `register()` automatically; on the server it is a no-op.
 */

import {
  fetchAttestation,
  DEFAULT_API_BASE,
  type BadgeAttestation,
} from "./types.js";
import { canonicalizeDom, hashRegion } from "./region-canonicalize.js";

type Status =
  | { kind: "loading" }
  | { kind: "verified"; att: BadgeAttestation }
  | { kind: "tampered"; recomputed: string }
  | { kind: "mismatch"; att: BadgeAttestation }
  | { kind: "revoked"; att: BadgeAttestation }
  | { kind: "unreachable"; message: string };

const PILL_STYLES = `
  :host {
    display: block;
    position: relative;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  button.pill {
    position: absolute;
    /* The host's outline is drawn 4px outside its box (outline-offset).
     * Pill height is ~24px, so -16px (= -outline-offset - height/2) centers
     * the pill vertically on the outline ring. */
    top: -16px;
    right: 12px;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #d4d4d8;
    background: #fafafa;
    color: #18181b;
    padding: 2px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    line-height: 1.6;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  }
  button.pill[data-status="verified"] { color: #065f46; border-color: #6ee7b7; background: #ecfdf5; }
  button.pill[data-status="tampered"] { color: #991b1b; border-color: #fca5a5; background: #fef2f2; }
  button.pill[data-status="mismatch"] { color: #991b1b; border-color: #fca5a5; background: #fef2f2; }
  button.pill[data-status="revoked"]  { color: #92400e; border-color: #fcd34d; background: #fffbeb; }
  button.pill[data-status="unreachable"] { color: #52525b; border-color: #d4d4d8; }
  button.pill[data-status="loading"]  { color: #52525b; }
  .panel {
    position: absolute;
    top: 18px;
    right: 8px;
    z-index: 2147483647;
    min-width: 280px;
    max-width: min(360px, calc(100vw - 24px));
    background: #fff;
    color: #18181b;
    border: 1px solid #d4d4d8;
    border-radius: 8px;
    padding: 12px 12px 12px 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    display: none;
    font-size: 12px;
  }
  :host([open]) .panel { display: block; }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .panel h2 { margin: 0; font-size: 13px; font-weight: 600; }
  .close {
    all: unset;
    cursor: pointer;
    color: #71717a;
    font-size: 18px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .close:hover { background: #f4f4f5; color: #18181b; }
  .panel dl { margin: 0; }
  .panel dt { font-size: 11px; color: #71717a; margin-top: 8px; }
  .panel dd { margin: 0; font-size: 12px; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .panel a { color: #2563eb; text-decoration: none; }
  .panel a:hover { text-decoration: underline; }
  .ok  { color: #059669; }
  .bad { color: #dc2626; }
`;

const REGION_BORDER_VAR = "--fidemark-region-border";
const STATUS_LABEL: Record<Status["kind"], string> = {
  loading: "Verifying…",
  verified: "✓ Verified",
  tampered: "⚠ Tampered",
  mismatch: "⚠ Hash mismatch",
  revoked: "Revoked",
  unreachable: "Unreachable",
};

const STATUS_OUTLINE: Record<Status["kind"], string> = {
  loading: "transparent",
  verified: "#10b981",
  tampered: "#dc2626",
  mismatch: "#dc2626",
  revoked: "#f59e0b",
  unreachable: "#a1a1aa",
};

function isHex32(s: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(s);
}

function labelType(t: BadgeAttestation["type"]): string {
  switch (t) {
    case "human":
      return "Human Proof";
    case "ai":
      return "AI Proof";
    case "multi":
      return "Multi-party Proof";
    case "pop":
      return "Verified-human Proof";
  }
}

function formatTime(unixSeconds: number): string {
  const ms = unixSeconds * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(unixSeconds);
  return d.toISOString().replace("T", " ").replace(/\..+$/, " UTC");
}

function linkOut(href: string, label: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  return a;
}

/**
 * Define the custom element. Safe to call multiple times: it short-circuits
 * if the registry already has it. No-op on environments without
 * HTMLElement (Node SSR), so this module can be imported anywhere.
 */
export function register(): void {
  if (typeof HTMLElement === "undefined") return;
  if (typeof customElements === "undefined") return;
  if (customElements.get("fidemark-region")) return;

  class FidemarkRegionElement extends HTMLElement {
    static get observedAttributes() {
      return ["uid", "content-hash", "api-base", "outline"];
    }

    private shadow: ShadowRoot | null = null;
    private pill: HTMLButtonElement | null = null;
    private panel: HTMLElement | null = null;
    private observer: MutationObserver | null = null;
    private requestSeq = 0;
    private status: Status = { kind: "loading" };
    private declaredHash: string | null = null;

    connectedCallback() {
      // Defer mutation to the next animation frame so React (or any other
      // hydration-based renderer) can finish reconciling the server HTML
      // before any host attribute we set leaks into the diff. The shadow
      // root itself is invisible to hydration so attaching it is safe,
      // but `applyOutline` mutates the host's inline style.
      const run = () => {
        if (!this.isConnected) return;
        this.mountOverlay();
        this.startObserving();
        void this.recheck();
      };
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(run);
      } else {
        run();
      }
    }

    disconnectedCallback() {
      this.observer?.disconnect();
      this.observer = null;
      // Shadow root content is owned by the element; we let the GC handle
      // it once the host is gone. Don't reach into shadowRoot to remove
      // children manually because the host may reconnect and we want the
      // overlay to come back without re-attaching the shadow root.
      this.pill = null;
      this.panel = null;
    }

    attributeChangedCallback(name: string) {
      if (!this.isConnected) return;
      if (name === "uid" || name === "content-hash" || name === "api-base") {
        void this.recheck();
      } else if (name === "outline") {
        this.applyOutline();
      }
    }

    private mountOverlay() {
      // Attach shadow DOM to the host itself rather than appending an
      // <aside> into light DOM. The publisher's children are projected
      // through <slot>, so they remain in the host's light-DOM children
      // (visible to canonicalizeDom) while the pill + panel live in the
      // shadow root, invisible to React's hydration check.
      if (!this.shadow) {
        // attachShadow may throw on elements that already have a shadow
        // root from a prior connect/disconnect cycle. Re-use the existing
        // root in that case.
        this.shadow = (this.shadowRoot as ShadowRoot | null) ?? this.attachShadow({ mode: "open" });
      }
      const shadow = this.shadow;
      // Reset the shadow tree on every (re)mount. Hot-reload, dev-server
      // restarts, and React Fast Refresh can each invoke connectedCallback
      // again on an element whose shadow root is already populated; if
      // we appended a second pill we would end up with stacked badges.
      while (shadow.firstChild) shadow.removeChild(shadow.firstChild);

      const style = document.createElement("style");
      style.textContent = PILL_STYLES;
      shadow.appendChild(style);

      const slot = document.createElement("slot");
      shadow.appendChild(slot);

      const pill = document.createElement("button");
      pill.className = "pill";
      pill.type = "button";
      pill.setAttribute("part", "pill");
      pill.dataset.status = "loading";
      pill.textContent = STATUS_LABEL.loading;
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleAttribute("open");
      });
      shadow.appendChild(pill);

      const panel = document.createElement("div");
      panel.className = "panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Attestation details");
      shadow.appendChild(panel);

      this.pill = pill;
      this.panel = panel;
      this.applyOutline();
    }

    private startObserving() {
      if (this.observer) return;
      this.observer = new MutationObserver((records) => {
        // Skip mutations the component caused on itself (style/outline updates
        // from setStatus). Without this guard the observer would loop on its
        // own writes.
        const matters = records.some((r) => {
          if (r.target === this && r.type === "attributes") return false;
          return true;
        });
        if (matters) void this.recheck();
      });
      this.observer.observe(this, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-fidemark-ignore"],
      });
    }

    private regionContent(): Element {
      // Publisher content lives in light DOM (our shadow root only holds
      // the pill + panel + slot). Cloning the host's childNodes gives us
      // exactly the canonical region without the overlay leaking in.
      const synthetic = document.createElement("div");
      for (const child of Array.from(this.childNodes)) {
        synthetic.appendChild(child.cloneNode(true));
      }
      return synthetic;
    }

    private apiBase(): string {
      return this.getAttribute("api-base") || DEFAULT_API_BASE;
    }

    private outlineMode(): "subtle" | "strong" | "off" {
      const v = this.getAttribute("outline");
      if (v === "off" || v === "strong") return v;
      return "subtle";
    }

    private async recheck() {
      const uid = (this.getAttribute("uid") || "").trim();
      const declared = (this.getAttribute("content-hash") || "").trim().toLowerCase();
      if (!isHex32(uid) || !isHex32(declared)) {
        this.setStatus({
          kind: "unreachable",
          message: "Missing or malformed uid / content-hash.",
        });
        return;
      }
      this.declaredHash = declared;
      const seq = ++this.requestSeq;
      this.setStatus({ kind: "loading" });

      let recomputed: string;
      try {
        recomputed = (await hashRegion(this.regionContent())).toLowerCase();
      } catch (err) {
        this.setStatus({
          kind: "unreachable",
          message: `Hash compute failed: ${(err as Error).message}`,
        });
        return;
      }
      if (seq !== this.requestSeq) return;

      if (recomputed !== declared) {
        this.setStatus({ kind: "tampered", recomputed });
        return;
      }

      let att: BadgeAttestation;
      try {
        att = await fetchAttestation(uid, this.apiBase());
      } catch (err) {
        this.setStatus({ kind: "unreachable", message: (err as Error).message });
        return;
      }
      if (seq !== this.requestSeq) return;

      if (att.contentHash.toLowerCase() !== declared) {
        this.setStatus({ kind: "mismatch", att });
        return;
      }
      if (att.revoked) {
        this.setStatus({ kind: "revoked", att });
        return;
      }
      this.setStatus({ kind: "verified", att });
    }

    private setStatus(next: Status) {
      this.status = next;
      if (!this.pill || !this.panel) return;
      this.pill.dataset.status = next.kind;
      this.pill.textContent = STATUS_LABEL[next.kind];
      this.applyOutline();
      this.renderPanel();
    }

    private applyOutline() {
      const mode = this.outlineMode();
      if (mode === "off") {
        this.style.removeProperty("outline");
        this.style.removeProperty("outline-offset");
        return;
      }
      const width = mode === "strong" ? "2px" : "1px";
      this.style.outline = `${width} solid ${STATUS_OUTLINE[this.status.kind]}`;
      this.style.outlineOffset = "4px";
      this.style.setProperty(REGION_BORDER_VAR, STATUS_OUTLINE[this.status.kind]);
    }

    private renderPanel() {
      if (!this.panel) return;
      while (this.panel.firstChild) this.panel.removeChild(this.panel.firstChild);
      const status = this.status;

      const header = document.createElement("div");
      header.className = "panel-header";
      const heading = document.createElement("h2");
      heading.textContent = STATUS_LABEL[status.kind];
      header.appendChild(heading);
      const close = document.createElement("button");
      close.className = "close";
      close.type = "button";
      close.setAttribute("aria-label", "Close");
      close.textContent = "×";
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeAttribute("open");
      });
      header.appendChild(close);
      this.panel.appendChild(header);

      const dl = document.createElement("dl");
      const row = (label: string, value: string | Node, ok?: boolean) => {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        if (typeof value === "string") {
          dd.textContent = value;
        } else {
          dd.appendChild(value);
        }
        if (ok === true) dd.classList.add("ok");
        if (ok === false) dd.classList.add("bad");
        dl.appendChild(dt);
        dl.appendChild(dd);
      };

      const declared = this.declaredHash || this.getAttribute("content-hash") || "";

      switch (status.kind) {
        case "loading":
          row("Status", "Computing canonical hash and fetching attestation…");
          break;
        case "verified": {
          row("Type", labelType(status.att.type));
          row("Attester", status.att.attester);
          row("Created", formatTime(status.att.createdAt));
          row("Declared hash", declared, true);
          row("On-chain hash", status.att.contentHash, true);
          row("UID", linkOut(status.att.verifyUrl, status.att.uid));
          break;
        }
        case "tampered":
          row("Declared hash", declared);
          row("Recomputed hash", status.recomputed, false);
          row("Hint", "Page content has changed since this region was attested.");
          break;
        case "mismatch":
          row("Declared hash", declared);
          row("On-chain hash", status.att.contentHash, false);
          row("UID", linkOut(status.att.verifyUrl, status.att.uid));
          row("Hint", "The on-chain attestation does not cover the declared content.");
          break;
        case "revoked":
          row("Type", labelType(status.att.type));
          row("Attester", status.att.attester);
          row("UID", linkOut(status.att.verifyUrl, status.att.uid));
          row("Hint", "The attester revoked this attestation after publishing.");
          break;
        case "unreachable":
          row("Reason", status.message);
          break;
      }

      this.panel.appendChild(dl);
    }
  }

  customElements.define("fidemark-region", FidemarkRegionElement);
}

// Register on import in any environment that supports custom elements.
register();

export { canonicalizeDom, hashRegion };
