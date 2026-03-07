# Healthcare AI Triage — HIPAA Compliance

## Scenario
Hospital AI uses an LLM to prioritize patient triage. AI flags a patient as low-priority; patient deteriorates. Without a TrustAtom receipt, there's no verifiable record of the AI's reasoning.

## HIPAA Mapping
- **45 CFR §164.312(b)** — Audit controls
- **45 CFR §164.312(c)** — Integrity controls

## Usage in Claude

```
You: Our clinical AI triaged patient #4422 as ESI-3
     with 67% confidence and vitals BP:140/90 HR:98.
     Sign this decision for HIPAA audit trail.
```

Claude will call `create_trustatom` with:
- action: `TRIAGE_PATIENT`
- actor: `clinical-ai-v2`
- decision: `ALLOW`
- context: `{ acuity: "ESI-3", confidence: 0.67, vitals: "BP:140/90 HR:98" }`

## What the Auditor Gets
"On [date] at [time], clinical-ai-v2 with confidence 0.67 classified patient #4422 as ESI-3. Receipt ta_xxxx is Ed25519-signed by HOSPITAL_KEY. Control: HIPAA 164.312(b)."

Every decision. Every receipt. Every audit — answered.
