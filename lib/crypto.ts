// lib/crypto.ts
// AES-256-GCM helpers for encrypting user-supplied secrets (e.g. bring-your-own
// AI provider API keys) before they touch the database. Never store these
// values in plaintext — DB access or a backup leak would otherwise hand out
// live API keys.
import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM standard nonce size

function getKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to your environment."
    );
  }
  // Accept base64 (preferred) or hex, either way must decode to 32 bytes.
  const buf = /^[A-Fa-f0-9]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("SECRETS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or hex).");
  }
  return buf;
}

/** Encrypt a UTF-8 string. Returns `iv:authTag:ciphertext`, all base64. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Decrypt a string produced by encryptSecret. Throws if tampered or wrong key. */
export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted payload");
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return dec.toString("utf8");
}

/** Last 4 chars of a secret, for display (e.g. "sk-...WXYZ"). Never log the full value. */
export function last4(secret: string): string {
  return secret.slice(-4);
}
