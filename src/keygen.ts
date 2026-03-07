#!/usr/bin/env tsx
/**
 * TrustAtom Key Generator
 * Generates Ed25519 key pair for signing AI decision receipts.
 */

import { generateKeyPair } from "./sign.js";
import naclUtil from "tweetnacl-util";
import { writeFileSync, mkdirSync } from "fs";

const KEY_DIR = "./keys";
const KEY_PATH = `${KEY_DIR}/trustatom_keys.json`;

mkdirSync(KEY_DIR, { recursive: true });

const kp = generateKeyPair();
const keyData = {
  publicKey: naclUtil.encodeBase64(kp.publicKey),
  secretKey: naclUtil.encodeBase64(kp.secretKey),
  generated: new Date().toISOString(),
  algorithm: "Ed25519",
  note: "KEEP SECRET KEY PRIVATE. Share public key for verification.",
};

writeFileSync(KEY_PATH, JSON.stringify(keyData, null, 2));

console.log("✅ Ed25519 key pair generated");
console.log(`   Path: ${KEY_PATH}`);
console.log(`   Public Key: ${keyData.publicKey}`);
console.log(`   Algorithm: Ed25519 (same as SSH, Solana, Signal)`);
console.log("");
console.log("Add to your Claude Desktop config:");
console.log(JSON.stringify({
  mcpServers: {
    trustatom: {
      command: "npx",
      args: ["tsx", "src/server.ts"],
      env: { TRUSTATOM_KEY_PATH: KEY_PATH },
    },
  },
}, null, 2));
