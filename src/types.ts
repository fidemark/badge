/**
 * The subset of FidemarkAttestation the badge cares about. Mirrors
 * `/api/attestation/[uid]`, kept here to avoid pulling the full SDK into
 * the badge bundle.
 */
export interface BadgeAttestation {
  uid: string;
  type: "human" | "ai" | "multi" | "pop";
  attester: string;
  contentHash: string;
  createdAt: number;
  revoked: boolean;
  verifyUrl: string;
  human?: { proofMethod: string };
  ai?: { modelId: string; provider: string };
  multi?: { attesters: string[]; proofMethod: string };
  pop?: { proofMethod: string };
}

export type BadgeStatus =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; attestation: BadgeAttestation };

export interface BadgeProps {
  /** Attestation UID. */
  uid: string;
  /** Origin of the verify page that hosts the JSON API. Defaults to https://verify.fidemark.dev. */
  apiBase?: string;
  /** Color theme. */
  theme?: "light" | "dark";
}

export const DEFAULT_API_BASE = "https://verify.fidemark.dev";

export async function fetchAttestation(uid: string, apiBase: string): Promise<BadgeAttestation> {
  const res = await fetch(`${apiBase}/api/attestation/${uid}`, { cache: "no-store" });
  if (res.status === 404) throw new Error("Attestation not found");
  if (!res.ok) throw new Error(`Lookup failed: ${res.status}`);
  return (await res.json()) as BadgeAttestation;
}
