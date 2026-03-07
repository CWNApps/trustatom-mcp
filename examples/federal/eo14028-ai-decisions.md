# Federal AI Decision Accountability — EO 14028

## Scenario
Federal agency deploys AI for cybersecurity operations. Executive Order 14028 requires supply chain security and software integrity controls. Every AI-driven security decision needs an immutable audit trail.

## Framework Mapping
- **EO 14028 §4** — Software supply chain security
- **NIST SP 800-218** — Secure Software Development Framework
- **FedRAMP** — Authorization boundary controls

## Usage in Claude

```
You: Our SOC AI agent just blocked a suspicious login attempt
     from IP 203.0.113.42. Risk score 0.91. Log this decision
     for our ATO package.
```

Claude will call `create_trustatom` with:
- action: `BLOCK_ACCESS`
- actor: `soc-ai-sentinel`
- decision: `DENY`
- context: `{ source_ip: "203.0.113.42", risk_score: 0.91, reason: "anomalous_login" }`
- compliance_tags: `["NIST:PR", "NIST:DE", "EO14028:§4"]`

## Air-Gap Compatible
This MCP server runs fully local. No cloud dependency. No data leaves your network. Keys are customer-generated — CWN never sees your private key.

Self-hosted. Verified. Sovereign.
