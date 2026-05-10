import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "../src/region.js";
import type { BadgeAttestation } from "../src/types.js";

const HEX_A = "0x" + "a".repeat(64);
const HEX_B = "0x" + "b".repeat(64);
const UID = "0x" + "1".repeat(64);

function makeAtt(overrides: Partial<BadgeAttestation> = {}): BadgeAttestation {
  return {
    uid: UID,
    type: "human",
    attester: "0x" + "f".repeat(40),
    contentHash: HEX_A,
    createdAt: 1_700_000_000,
    revoked: false,
    verifyUrl: "https://verify.fidemark.dev/" + UID,
    ...overrides,
  };
}

function makeParagraph(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}

function mountRegion(opts: {
  declared: string;
  uid: string;
  paragraphText: string;
}): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement("fidemark-region");
  el.setAttribute("uid", opts.uid);
  el.setAttribute("content-hash", opts.declared);
  el.appendChild(makeParagraph(opts.paragraphText));
  document.body.appendChild(el);
  return el;
}

function pillStatus(host: HTMLElement): string | null {
  const sr = host.shadowRoot;
  if (!sr) return null;
  return sr.querySelector("button.pill")?.getAttribute("data-status") ?? null;
}

function recomputedFromPanel(host: HTMLElement): string | undefined {
  // After a "tampered" status the second <dd> is the recomputed hash.
  return host.shadowRoot?.querySelectorAll("dd")[1]?.textContent?.trim();
}

async function tick() {
  // The component defers mount work to requestAnimationFrame and then
  // chains async hashRegion + fetch calls. Flush rAF first, then a few
  // microtask turns so the whole pipeline settles.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe("<fidemark-region>", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("reaches the verified state when declared, recomputed, and on-chain hashes all match", async () => {
    const text = "Stable content.";
    const probe = mountRegion({
      declared: "0x" + "0".repeat(64),
      uid: UID,
      paragraphText: text,
    });
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(makeAtt()), { status: 200 }));
    await tick();
    const recomputed = recomputedFromPanel(probe);
    expect(recomputed).toMatch(/^0x[0-9a-f]{64}$/);

    const real = mountRegion({ declared: recomputed!, uid: UID, paragraphText: text });
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(makeAtt({ contentHash: recomputed! })), { status: 200 }),
    );
    await tick();
    expect(pillStatus(real)).toBe("verified");
  });

  it("flags tampered when declared hash does not match the recomputed subtree", async () => {
    const el = mountRegion({
      declared: HEX_A,
      uid: UID,
      paragraphText: "Different content than the publisher hashed.",
    });
    fetchSpy.mockResolvedValue(new Response("{}", { status: 200 }));
    await tick();
    expect(pillStatus(el)).toBe("tampered");
  });

  it("flags mismatch when on-chain hash differs from declared even if subtree matches", async () => {
    const text = "X.";
    const probe = mountRegion({
      declared: "0x" + "0".repeat(64),
      uid: UID,
      paragraphText: text,
    });
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(makeAtt()), { status: 200 }));
    await tick();
    const recomputed = recomputedFromPanel(probe)!;

    const el = mountRegion({ declared: recomputed, uid: UID, paragraphText: text });
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(makeAtt({ contentHash: HEX_B })), { status: 200 }),
    );
    await tick();
    expect(pillStatus(el)).toBe("mismatch");
  });

  it("flags revoked when chain returns revoked=true", async () => {
    const text = "R.";
    const probe = mountRegion({
      declared: "0x" + "0".repeat(64),
      uid: UID,
      paragraphText: text,
    });
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(makeAtt()), { status: 200 }));
    await tick();
    const recomputed = recomputedFromPanel(probe)!;

    const el = mountRegion({ declared: recomputed, uid: UID, paragraphText: text });
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify(makeAtt({ contentHash: recomputed, revoked: true })),
        { status: 200 },
      ),
    );
    await tick();
    expect(pillStatus(el)).toBe("revoked");
  });

  it("flags unreachable when the API returns a network error", async () => {
    const text = "U.";
    const probe = mountRegion({
      declared: "0x" + "0".repeat(64),
      uid: UID,
      paragraphText: text,
    });
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(makeAtt()), { status: 200 }));
    await tick();
    const recomputed = recomputedFromPanel(probe)!;

    const el = mountRegion({ declared: recomputed, uid: UID, paragraphText: text });
    fetchSpy.mockRejectedValue(new Error("offline"));
    await tick();
    expect(pillStatus(el)).toBe("unreachable");
  });

  it("rejects malformed uid or hash without fetching", async () => {
    fetchSpy.mockResolvedValue(new Response("{}", { status: 200 }));
    const el = mountRegion({
      declared: "not-a-hash",
      uid: "not-a-uid",
      paragraphText: "Z.",
    });
    await tick();
    expect(pillStatus(el)).toBe("unreachable");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
