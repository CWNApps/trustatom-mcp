# TrustAtom MCP Server

> ## ⚠️ Superseded by [trust-gate-mcp](https://github.com/CWNApps/trust-gate-mcp)
>
> **This repository is no longer the recommended way to mint Trust Gate receipts.**
> It is kept public as a reference implementation and for historical context.
>
> Use **[`trust-gate-mcp`](https://github.com/CWNApps/trust-gate-mcp)** instead:
>
> ```bash
> pip install trust-gate-mcp
> ```
>
> | | This repo | `trust-gate-mcp` |
> |---|---|---|
> | Signing | Ed25519 only | Ed25519 + ML-DSA-65 (FIPS 204), + SLH-DSA with liboqs |
> | Tools | 4 | 7 |
> | Receipt `env` | always `SANDBOX` | reflects real environment |
> | Published | **no** — `@cwn/trustatom-mcp` was never released to npm | yes, on PyPI |
> | Hosted | — | <https://trust-gate-mcp.onrender.com> |
> | Maintained | no | yes |
>
> The `npx`/`npm install` instructions below therefore only work from a git clone.
> There is no `@cwn/trustatom-mcp` package on the npm registry.

**Cryptographic receipts for AI decisions. 5 minutes to your first receipt.**

Every AI decision in your org is unsigned — and your auditor is going to ask about it. TrustAtom signs every decision with Ed25519 and returns a verifiable receipt in under 3ms.

## Quick Start

```bash
git clone https://github.com/CWNApps/trustatom-mcp
cd trustatom-mcp
npm install
npm run keygen    # Generate Ed25519 key pair
npm test          # Run 8 eval tests
```

### Add to Claude Desktop

```json
{
  "mcpServers": {
    "trustatom": {
      "command": "npx",
      "args": ["tsx", "src/server.ts"],
      "cwd": "/path/to/trustatom-mcp",
      "env": { "TRUSTATOM_KEY_PATH": "./keys/trustatom_keys.json" }
    }
  }
}
```

Then in Claude: *"Sign this AI decision with TrustAtom"* → receipt issued automatically.

## What It Does

| Tool | Description | When |
|------|-------------|------|
| `create_trustatom` | Sign a decision, return receipt | At every AI decision point |
| `verify_trustatom` | Verify an existing receipt | During audit, dispute resolution |
| `query_receipts` | Query the receipt ledger | Compliance reporting |
| `get_compliance_report` | Framework-mapped report | Board report, ATO package |

## Example: Healthcare AI Triage (HIPAA)

```
You: "Our clinical AI just triaged patient #4422 as ESI-3 with 67% confidence.
      Sign this decision for HIPAA compliance."

Claude (via TrustAtom MCP):
  ✅ Receipt ta_7f3a2b signed in 1.2ms
  Action: TRIAGE_PATIENT
  Decision: ALLOW
  Compliance: HIPAA:164.312(b), HL7
  Risk Score: 0.80
  Signature: ed25519:abc123...
```

What the auditor sees: *"On Mar 7 at 14:22, clinical-ai-v2 classified patient #4422 as ESI-3. Receipt ta_7f3a2b is Ed25519-signed. Control: HIPAA 164.312(b)."*

## Compliance Frameworks

TrustAtom auto-maps actions to framework controls:

| Action | Frameworks |
|--------|-----------|
| `TRIAGE_PATIENT` | HIPAA 164.312(b), HL7 |
| `APPROVE_LOAN` | SOX 302, FCRA |
| `TRADE_SIGNAL` | SOX 302, SEC 17a-4 |
| `DEPLOY` | NIST PR, SOC2 CC6.1 |
| `EXPORT_INTEGRATION` | NIST PR/RS, SOC2 A1.2 |
| Custom | NIST PR (default) |

## Performance

- **Signing**: <3ms average (Ed25519 + SHA-256)
- **Verification**: <1ms
- **Receipt size**: ~500 bytes JSON

## Architecture

```
Your AI Agent
    ↓ (MCP call)
TrustAtom MCP Server (local)
    ├── Ed25519 key pair (you own the keys)
    ├── SHA-256 evidence hash
    ├── Compliance auto-mapping
    └── In-memory ledger (pluggable to Neo4j/SQLite)
    ↓
Receipt returned to your agent
```

## Eval Tests

8 tests covering signing, verification, tampering detection, compliance mapping, risk scoring, and performance:

```bash
npm test
# ✅ Signs a decision and returns a valid receipt
# ✅ Verifies an authentic receipt
# ✅ Detects tampered receipt
# ✅ Auto-maps TRIAGE_PATIENT to HIPAA compliance tags
# ✅ Auto-maps APPROVE_LOAN to SOX compliance tags
# ✅ Computes risk score from action when not provided
# ✅ Signs DENY decisions with same integrity
# ✅ Signs within 3ms target for production use
# Results: 8 passed, 0 failed
```

## Enterprise

Need hosted infrastructure with SLA? Contact [hello@cyberwarriornetwork.com](mailto:hello@cyberwarriornetwork.com)

| Tier | Calls/day | Price |
|------|-----------|-------|
| Developer | 1,000 | Free |
| Professional | 100,000 | $299/mo |
| Enterprise | Unlimited | $2,499/mo |

## Built By

**[Cyber Warrior Network](https://cwn-trust-gate.onrender.com)** — Trust Gate: Policy-gated AI decisions with cryptographic receipts.

*No Receipt. No Trust.*
