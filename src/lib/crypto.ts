import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * AES-256-GCM encryption for Strava tokens at rest. Output format:
 * base64(iv[12] || authTag[16] || ciphertext). The key is a base64-encoded
 * 32-byte value in TOKEN_ENC_KEY.
 */
function key(): Buffer {
  const k = Buffer.from(env.tokenEncKey, "base64");
  if (k.length !== 32) {
    throw new Error("TOKEN_ENC_KEY must decode to 32 bytes (base64)");
  }
  return k;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptToken(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
