/**
 * TrustAtom Signing Engine
 * Ed25519 signing + SHA-256 hashing — produces cryptographic receipts for AI decisions.
 * Port of 07_BACKEND/app/services/trustatom.py
 *
 * No Receipt. No Trust.
 */

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { createHash, randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DCT {
  env: "SANDBOX" | "PRODUCTION" | "STAGING";
  parent_decision_id?: string;
  compliance_tags: string[];
  risk_score: number;
  ttl_ms: number;
}

export interface TrustAtomInput {
  action: string;
  actor: string;
  decision: "ALLOW" | "DENY";
  context: Record<string, unknown>;
  compliance_tags?: string[];
  risk_score?: number;
  tenant_id?: string;
  resource_id?: string;
}

export interface TrustAtomReceipt {
  id: string;
  action: string;
  actor: string;
  decision: "ALLOW" | "DENY";
  context: Record<string, unknown>;
  evidence_hash: string;
  signature_b64: string;
  public_key_b64: string;
  timestamp_iso: string;
  timestamp_ms: number;
  dct: DCT;
  tenant_id: string;
  resource_id: string;
  signing_time_ms: number;
}

export interface VerifyResult {
  valid: boolean;
  reason: string;
  receipt_id: string;
  public_key_b64: string;
}

// ── Risk + Compliance Maps ───────────────────────────────────────────────────

const RISK_MAP: Record<string, number> = {
  EXPORT_INTEGRATION: 0.85,
  DEPLOY: 0.9,
  MODIFY_POLICY: 0.95,
  APPROVE_LOAN: 0.7,
  TRIAGE_PATIENT: 0.8,
  TRADE_SIGNAL: 0.75,
  GRAPH_WRITE: 0.4,
  CODE_GENERATION: 0.3,
  GRAPH_READ: 0.1,
  READ_EVIDENCE: 0.05,
};

const COMPLIANCE_MAP: Record<string, string[]> = {
  TRIAGE_PATIENT: ["HIPAA:164.312(b)", "HL7"],
  APPROVE_LOAN: ["SOX:302", "FCRA"],
  TRADE_SIGNAL: ["SOX:302", "SEC:17a-4"],
  EXPORT_INTEGRATION: ["NIST:PR", "NIST:RS", "SOC2:A1.2"],
  DEPLOY: ["NIST:PR", "SOC2:CC6.1"],
  CODE_GENERATION: ["NIST:PR", "NICE:SP"],
  GRAPH_READ: ["NIST:ID", "NIST:DE", "SOC2:CC6.1"],
};

// ── Key Management ───────────────────────────────────────────────────────────

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function generateKeyPair(): KeyPair {
  return nacl.sign.keyPair();
}

export function loadOrCreateKey(path: string): KeyPair {
  if (existsSync(path)) {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return {
      publicKey: naclUtil.decodeBase64(data.publicKey),
      secretKey: naclUtil.decodeBase64(data.secretKey),
    };
  }

  const kp = generateKeyPair();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      {
        publicKey: naclUtil.encodeBase64(kp.publicKey),
        secretKey: naclUtil.encodeBase64(kp.secretKey),
      },
      null,
      2,
    ),
  );
  return kp;
}

// ── Signing ──────────────────────────────────────────────────────────────────

export function createTrustAtom(
  input: TrustAtomInput,
  keyPair: KeyPair,
): TrustAtomReceipt {
  const start = performance.now();
  const ts = Date.now();

  // Canonical JSON (sorted keys, no whitespace) — matches Python implementation
  const canonical = JSON.stringify(input, Object.keys(input).sort());
  const evidenceHash = createHash("sha256").update(canonical).digest("hex");

  // Ed25519 sign the evidence hash
  const sig = nacl.sign.detached(
    naclUtil.decodeUTF8(evidenceHash),
    keyPair.secretKey,
  );
  const sigB64 = naclUtil.encodeBase64(sig);
  const pubB64 = naclUtil.encodeBase64(keyPair.publicKey);

  // Compute risk + compliance from action
  const risk = input.risk_score ?? RISK_MAP[input.action] ?? 0.5;
  const tags =
    input.compliance_tags ?? COMPLIANCE_MAP[input.action] ?? ["NIST:PR"];

  const signingTime = performance.now() - start;

  return {
    id: `ta_${evidenceHash.slice(0, 12)}`,
    action: input.action,
    actor: input.actor,
    decision: input.decision,
    context: input.context,
    evidence_hash: evidenceHash,
    signature_b64: sigB64,
    public_key_b64: pubB64,
    timestamp_iso: new Date(ts).toISOString(),
    timestamp_ms: ts,
    dct: {
      env: "SANDBOX",
      compliance_tags: tags,
      risk_score: risk,
      ttl_ms: 0,
    },
    tenant_id: input.tenant_id ?? "demo-tenant",
    resource_id: input.resource_id ?? "default",
    signing_time_ms: Math.round(signingTime * 100) / 100,
  };
}

// ── Verification ─────────────────────────────────────────────────────────────

export function verifyTrustAtom(
  receipt: TrustAtomReceipt,
): VerifyResult {
  try {
    const sig = naclUtil.decodeBase64(receipt.signature_b64);
    const pubKey = naclUtil.decodeBase64(receipt.public_key_b64);
    const msg = naclUtil.decodeUTF8(receipt.evidence_hash);

    const valid = nacl.sign.detached.verify(msg, sig, pubKey);

    return {
      valid,
      reason: valid
        ? "Ed25519 signature verified — receipt is authentic"
        : "Signature mismatch — receipt may have been tampered with",
      receipt_id: receipt.id,
      public_key_b64: receipt.public_key_b64,
    };
  } catch (e: unknown) {
    return {
      valid: false,
      reason: `Verification failed: ${e instanceof Error ? e.message : String(e)}`,
      receipt_id: receipt.id,
      public_key_b64: receipt.public_key_b64,
    };
  }
}
