import { useEffect, useState } from "react";
import { fetchAttestation, DEFAULT_API_BASE, type BadgeProps, type BadgeStatus } from "./types.js";
import { styleFor } from "./styles.js";

export function FidemarkBadge({ uid, apiBase = DEFAULT_API_BASE, theme = "light" }: BadgeProps) {
  const [status, setStatus] = useState<BadgeStatus>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });
    fetchAttestation(uid, apiBase).then(
      (att) => {
        if (!cancelled) setStatus({ kind: "ok", attestation: att });
      },
      (err: Error) => {
        if (!cancelled) setStatus({ kind: "error", message: err.message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uid, apiBase]);

  const style = styleFor(theme);

  if (status.kind === "loading") {
    return <span style={style.container}>verifying…</span>;
  }
  if (status.kind === "error") {
    return (
      <span style={{ ...style.container, ...style.pillError }} role="alert">
        ⚠ {status.message}
      </span>
    );
  }

  const att = status.attestation;
  const verifyUrl = att.verifyUrl || `${apiBase}/${uid}`;

  const labelStyle = att.revoked
    ? style.pillRevoked
    : att.type === "human"
      ? style.pillHuman
      : att.type === "ai"
        ? style.pillAI
        : att.type === "multi"
          ? style.pillMulti
          : style.pillPoP;

  let label: string;
  if (att.revoked) {
    label = "Revoked";
  } else if (att.type === "human") {
    label = `Human Proof${att.human?.proofMethod === "ens-verified" ? " (ENS)" : ""}`;
  } else if (att.type === "ai") {
    label = `AI Proof${att.ai ? ` · ${att.ai.modelId}` : ""}`;
  } else if (att.type === "multi") {
    const n = att.multi?.attesters.length;
    label = `Multi-party Proof${n ? ` · ${n} signers` : ""}`;
  } else {
    label = "Verified-human Proof";
  }

  return (
    <a
      href={verifyUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...style.container, ...style.link }}
      title={`Fidemark, ${label}`}
    >
      <span style={style.icon} aria-hidden>
        {att.revoked ? "✗" : "✓"}
      </span>
      <span style={labelStyle}>{label}</span>
    </a>
  );
}
