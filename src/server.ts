#!/usr/bin/env node
/**
 * TrustAtom MCP Server
 * Cryptographic receipts for AI decisions via Model Context Protocol.
 *
 * 4 tools: create_trustatom, verify_trustatom, query_receipts, get_compliance_report
 *
 * No Receipt. No Trust.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadOrCreateKey, createTrustAtom, verifyTrustAtom } from "./sign.js";
import type { TrustAtomReceipt, TrustAtomInput } from "./sign.js";

// ── State ────────────────────────────────────────────────────────────────────

const KEY_PATH = process.env.TRUSTATOM_KEY_PATH || "./keys/trustatom_keys.json";
const keyPair = loadOrCreateKey(KEY_PATH);

// In-memory ledger (production would use Neo4j/SQLite)
const ledger: TrustAtomReceipt[] = [];

// ── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "create_trustatom",
    description:
      "Sign an AI decision and return a cryptographic receipt. " +
      "Every AI decision that matters should have a receipt. " +
      "Signing takes <3ms. Receipt is Ed25519-signed + SHA-256-hashed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          description:
            "The action being decided (e.g., APPROVE_LOAN, TRIAGE_PATIENT, DEPLOY, TRADE_SIGNAL)",
        },
        actor: {
          type: "string",
          description: "The AI agent or system making the decision",
        },
        decision: {
          type: "string",
          enum: ["ALLOW", "DENY"],
          description: "The decision outcome",
        },
        context: {
          type: "object",
          description:
            "Additional context for the decision (risk factors, confidence scores, etc.)",
        },
        compliance_tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Compliance framework tags (e.g., HIPAA, SOX, NIST:PR, SOC2:CC6.1)",
        },
        risk_score: {
          type: "number",
          description: "Risk score 0.0-1.0 (auto-computed if not provided)",
        },
      },
      required: ["action", "actor", "decision"],
    },
  },
  {
    name: "verify_trustatom",
    description:
      "Verify the integrity of an existing TrustAtom receipt. " +
      "Confirms the Ed25519 signature is authentic and the receipt hasn't been tampered with.",
    inputSchema: {
      type: "object" as const,
      properties: {
        receipt_id: {
          type: "string",
          description: "The TrustAtom receipt ID (e.g., ta_01hx9k...)",
        },
      },
      required: ["receipt_id"],
    },
  },
  {
    name: "query_receipts",
    description:
      "Query the receipt ledger for audit or compliance reporting. " +
      "Filter by time range, action, actor, or decision.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          description: "Filter by action type",
        },
        actor: {
          type: "string",
          description: "Filter by actor/agent",
        },
        decision: {
          type: "string",
          enum: ["ALLOW", "DENY"],
          description: "Filter by decision",
        },
        limit: {
          type: "number",
          description: "Max receipts to return (default: 20)",
        },
      },
    },
  },
  {
    name: "get_compliance_report",
    description:
      "Generate a compliance report mapped to a specific framework. " +
      "Aggregates all receipts tagged with the specified framework.",
    inputSchema: {
      type: "object" as const,
      properties: {
        framework: {
          type: "string",
          description:
            "Compliance framework (HIPAA, SOX, NIST, SOC2, CMMC, ISO27001)",
        },
      },
      required: ["framework"],
    },
  },
];

// ── Server Setup ─────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "trustatom-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    // ── create_trustatom ───────────────────────────────────────────────
    case "create_trustatom": {
      const input: TrustAtomInput = {
        action: String(args?.action ?? "UNKNOWN"),
        actor: String(args?.actor ?? "unknown-agent"),
        decision: (args?.decision as "ALLOW" | "DENY") ?? "DENY",
        context: (args?.context as Record<string, unknown>) ?? {},
        compliance_tags: args?.compliance_tags as string[] | undefined,
        risk_score: args?.risk_score as number | undefined,
      };

      const receipt = createTrustAtom(input, keyPair);
      ledger.push(receipt);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "SIGNED",
                receipt,
                message: `Receipt ${receipt.id} signed in ${receipt.signing_time_ms}ms. No Receipt. No Trust.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // ── verify_trustatom ──────────────────────────────────────────────
    case "verify_trustatom": {
      const receiptId = String(args?.receipt_id ?? "");
      const found = ledger.find((r) => r.id === receiptId);

      if (!found) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                valid: false,
                reason: `Receipt ${receiptId} not found in ledger`,
              }),
            },
          ],
        };
      }

      const result = verifyTrustAtom(found);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    // ── query_receipts ────────────────────────────────────────────────
    case "query_receipts": {
      let results = [...ledger];

      if (args?.action)
        results = results.filter((r) => r.action === args.action);
      if (args?.actor)
        results = results.filter((r) => r.actor === args.actor);
      if (args?.decision)
        results = results.filter((r) => r.decision === args.decision);

      const limit = (args?.limit as number) ?? 20;
      results = results.slice(-limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: results.length,
                receipts: results.map((r) => ({
                  id: r.id,
                  action: r.action,
                  actor: r.actor,
                  decision: r.decision,
                  timestamp: r.timestamp_iso,
                  compliance: r.dct.compliance_tags,
                  risk_score: r.dct.risk_score,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // ── get_compliance_report ─────────────────────────────────────────
    case "get_compliance_report": {
      const framework = String(args?.framework ?? "").toUpperCase();
      const matching = ledger.filter((r) =>
        r.dct.compliance_tags.some((t) =>
          t.toUpperCase().includes(framework),
        ),
      );

      const report = {
        framework,
        generated_at: new Date().toISOString(),
        total_decisions: matching.length,
        allow_count: matching.filter((r) => r.decision === "ALLOW").length,
        deny_count: matching.filter((r) => r.decision === "DENY").length,
        avg_risk_score:
          matching.length > 0
            ? Math.round(
                (matching.reduce((s, r) => s + r.dct.risk_score, 0) /
                  matching.length) *
                  100,
              ) / 100
            : 0,
        receipts: matching.map((r) => ({
          id: r.id,
          action: r.action,
          decision: r.decision,
          risk_score: r.dct.risk_score,
          timestamp: r.timestamp_iso,
          tags: r.dct.compliance_tags,
          signature: r.signature_b64.slice(0, 16) + "...",
        })),
        auditor_note:
          `All ${matching.length} decisions in this report are Ed25519-signed ` +
          `and SHA-256-hashed. Each receipt is independently verifiable. ` +
          `No Receipt. No Trust.`,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    }

    default:
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TrustAtom MCP Server running — No Receipt. No Trust.");
}

main().catch(console.error);
