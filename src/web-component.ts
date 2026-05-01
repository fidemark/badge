/**
 * Vanilla Web Component: <fidemark-badge uid="0x..." theme="light" api-base="...">
 *
 * Drop-in for any HTML page. No React required at runtime, this file ships
 * as a small standalone bundle (ESM + IIFE).
 *
 * <script type="module" src="https://cdn.jsdelivr.net/npm/@fidemark/badge@^0.1/dist/web-component.js"></script>
 * <fidemark-badge uid="0xabc…"></fidemark-badge>
 */
import { fetchAttestation, DEFAULT_API_BASE, type BadgeAttestation } from "./types.js";

const STYLES = `
  :host {
    display: inline-block;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 0.85em;
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    border-radius: 9999px;
    padding: 0.25em 0.7em;
    line-height: 1.2;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid var(--border, #e4e4e7);
    background: var(--bg, #fafafa);
    color: var(--fg, #18181b);
  }
  :host([theme="dark"]) a {
    --border: #3f3f46;
    --bg: #18181b;
    --fg: #fafafa;
  }
  .pill-human { color: #065f46; font-weight: 600; }
  .pill-ai    { color: #5b21b6; font-weight: 600; }
  .pill-multi { color: #075985; font-weight: 600; }
  .pill-pop   { color: #92400e; font-weight: 600; }
  .pill-revoked { color: #991b1b; font-weight: 600; }
  .pill-error   { color: #7f1d1d; }
  :host([theme="dark"]) .pill-human   { color: #a7f3d0; }
  :host([theme="dark"]) .pill-ai      { color: #ddd6fe; }
  :host([theme="dark"]) .pill-multi   { color: #bae6fd; }
  :host([theme="dark"]) .pill-pop     { color: #fde68a; }
  :host([theme="dark"]) .pill-revoked { color: #fca5a5; }
  :host([theme="dark"]) .pill-error   { color: #fca5a5; }
`;

class FidemarkBadgeElement extends HTMLElement {
  static get observedAttributes() {
    return ["uid", "api-base", "theme"];
  }

  private root: ShadowRoot;
  private link: HTMLAnchorElement;
  private icon: HTMLSpanElement;
  private label: HTMLSpanElement;
  private currentRequest = 0;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });

    // Construct the shadow tree via DOM APIs, avoids any HTML parsing of
    // user-controllable values, even though all content here is static.
    const styleEl = document.createElement("style");
    styleEl.textContent = STYLES;

    const link = document.createElement("a");
    link.setAttribute("part", "badge");
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");

    const icon = document.createElement("span");
    icon.className = "icon";
    icon.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "label";

    link.appendChild(icon);
    link.appendChild(label);
    this.root.appendChild(styleEl);
    this.root.appendChild(link);

    this.link = link;
    this.icon = icon;
    this.label = label;
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private async render() {
    const uid = this.getAttribute("uid");
    const apiBase = this.getAttribute("api-base") ?? DEFAULT_API_BASE;
    if (!uid) {
      this.setError("No UID");
      return;
    }
    this.setLoading();

    const requestId = ++this.currentRequest;
    try {
      const att = await fetchAttestation(uid, apiBase);
      if (requestId !== this.currentRequest) return;
      this.renderAttestation(att, apiBase, uid);
    } catch (err) {
      if (requestId !== this.currentRequest) return;
      this.setError((err as Error).message);
    }
  }

  private setLoading() {
    this.icon.textContent = "";
    this.label.textContent = "verifying…";
    this.label.className = "label";
    this.link.removeAttribute("href");
  }

  private setError(msg: string) {
    this.icon.textContent = "⚠";
    this.label.textContent = msg;
    this.label.className = "label pill-error";
    this.link.removeAttribute("href");
  }

  private renderAttestation(att: BadgeAttestation, apiBase: string, uid: string) {
    const isRevoked = att.revoked;
    this.icon.textContent = isRevoked ? "✗" : "✓";

    let text: string;
    let cls: string;
    if (isRevoked) {
      text = "Revoked";
      cls = "pill-revoked";
    } else if (att.type === "human") {
      text = `Human Proof${att.human?.proofMethod === "ens-verified" ? " (ENS)" : ""}`;
      cls = "pill-human";
    } else if (att.type === "ai") {
      text = `AI Proof${att.ai ? ` · ${att.ai.modelId}` : ""}`;
      cls = "pill-ai";
    } else if (att.type === "multi") {
      const n = att.multi?.attesters.length;
      text = `Multi-party Proof${n ? ` · ${n} signers` : ""}`;
      cls = "pill-multi";
    } else {
      text = "Verified-human Proof";
      cls = "pill-pop";
    }

    this.label.textContent = text;
    this.label.className = `label ${cls}`;
    this.link.href = att.verifyUrl || `${apiBase}/${uid}`;
  }
}

if (typeof window !== "undefined" && !customElements.get("fidemark-badge")) {
  customElements.define("fidemark-badge", FidemarkBadgeElement);
}

export { FidemarkBadgeElement };
