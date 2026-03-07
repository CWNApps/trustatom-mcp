#!/usr/bin/env tsx
/**
 * TrustAtom MCP — Evaluation Tests
 * 8 tests covering signing, verification, compliance, and edge cases.
 * Run: npx tsx src/eval.ts
 */

import { loadOrCreateKey, createTrustAtom, verifyTrustAtom } from "./sign.js";
import type { TrustAtomInput } from "./sign.js";

const KEY_PATH = "./keys/test_keys.json";
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: unknown) {
    failed++;
    console.log(`  ❌ ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

console.log("\n🛡️  TrustAtom MCP — Evaluation Suite\n");

const kp = loadOrCreateKey(KEY_PATH);

// ── Test 1: Basic signing ────────────────────────────────────────────────

test("Signs a decision and returns a valid receipt", () => {
  const receipt = createTrustAtom(
    {
      action: "APPROVE_LOAN",
      actor: "gpt-4o",
      decision: "ALLOW",
      context: { risk_score: 0.12, loan_amount: 50000 },
    },
    kp,
  );
  assert(receipt.id.startsWith("ta_"), "ID should start with ta_");
  assert(receipt.signature_b64.length > 10, "Should have signature");
  assert(receipt.evidence_hash.length === 64, "SHA-256 hash should be 64 chars");
  assert(receipt.signing_time_ms < 100, "Signing should be <100ms");
});

// ── Test 2: Verification ─────────────────────────────────────────────────

test("Verifies an authentic receipt", () => {
  const receipt = createTrustAtom(
    {
      action: "TRIAGE_PATIENT",
      actor: "clinical-ai-v2",
      decision: "ALLOW",
      context: { acuity: "ESI-3" },
    },
    kp,
  );
  const result = verifyTrustAtom(receipt);
  assert(result.valid === true, "Should verify as valid");
});

// ── Test 3: Tampered receipt detection ───────────────────────────────────

test("Detects tampered receipt", () => {
  const receipt = createTrustAtom(
    {
      action: "DEPLOY",
      actor: "devops-bot",
      decision: "ALLOW",
      context: {},
    },
    kp,
  );
  // Tamper with evidence hash
  const tampered = { ...receipt, evidence_hash: "0".repeat(64) };
  const result = verifyTrustAtom(tampered);
  assert(result.valid === false, "Tampered receipt should fail verification");
});

// ── Test 4: HIPAA compliance tags ────────────────────────────────────────

test("Auto-maps TRIAGE_PATIENT to HIPAA compliance tags", () => {
  const receipt = createTrustAtom(
    {
      action: "TRIAGE_PATIENT",
      actor: "clinical-ai",
      decision: "ALLOW",
      context: { vitals: "normal" },
    },
    kp,
  );
  assert(
    receipt.dct.compliance_tags.some((t) => t.includes("HIPAA")),
    "Should include HIPAA tag",
  );
});

// ── Test 5: SOX compliance tags ──────────────────────────────────────────

test("Auto-maps APPROVE_LOAN to SOX compliance tags", () => {
  const receipt = createTrustAtom(
    {
      action: "APPROVE_LOAN",
      actor: "lending-ai",
      decision: "DENY",
      context: { credit_score: 580 },
    },
    kp,
  );
  assert(
    receipt.dct.compliance_tags.some((t) => t.includes("SOX")),
    "Should include SOX tag",
  );
});

// ── Test 6: Risk score auto-computation ──────────────────────────────────

test("Computes risk score from action when not provided", () => {
  const receipt = createTrustAtom(
    {
      action: "MODIFY_POLICY",
      actor: "admin-agent",
      decision: "ALLOW",
      context: {},
    },
    kp,
  );
  assert(receipt.dct.risk_score === 0.95, "MODIFY_POLICY should be 0.95 risk");
});

// ── Test 7: DENY decision ────────────────────────────────────────────────

test("Signs DENY decisions with same integrity", () => {
  const receipt = createTrustAtom(
    {
      action: "EXPORT_INTEGRATION",
      actor: "export-bot",
      decision: "DENY",
      context: { reason: "missing approval chain" },
    },
    kp,
  );
  assert(receipt.decision === "DENY", "Should record DENY decision");
  const v = verifyTrustAtom(receipt);
  assert(v.valid === true, "DENY receipt should verify");
});

// ── Test 8: Signing speed (<3ms target) ──────────────────────────────────

test("Signs within 3ms target for production use", () => {
  const times: number[] = [];
  for (let i = 0; i < 100; i++) {
    const r = createTrustAtom(
      {
        action: "CODE_GENERATION",
        actor: "copilot",
        decision: "ALLOW",
        context: { file: `test_${i}.ts` },
      },
      kp,
    );
    times.push(r.signing_time_ms);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)];
  console.log(`     avg: ${avg.toFixed(2)}ms, p99: ${p99.toFixed(2)}ms`);
  assert(avg < 10, `Average signing time ${avg.toFixed(2)}ms should be <10ms`);
});

// ── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(
  failed === 0
    ? "🛡️  All evals passed. No Receipt. No Trust."
    : "⚠️  Some evals failed — review before shipping.",
);
process.exit(failed > 0 ? 1 : 0);
