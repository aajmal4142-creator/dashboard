import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";

function resolveKeyMaterial(): Buffer {
  const material =
    process.env.CLEARESG_CREDENTIALS_KEY?.trim() || process.env.PAYLOAD_SECRET?.trim();
  if (!material) {
    throw new Error(
      "CLEARESG_CREDENTIALS_KEY or PAYLOAD_SECRET is required to encrypt database credentials",
    );
  }
  return createHash("sha256").update(material, "utf8").digest();
}

/**
 * Encrypt JSON-serializable credentials at rest (AES-256-GCM).
 * Format: v1:<iv_b64>.<tag_b64>.<ciphertext_b64>
 */
export function encryptCredentials(plaintext: string): string {
  const key = resolveKeyMaterial();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptCredentials(ciphertext: string): string {
  const key = resolveKeyMaterial();
  const [version, rest] = ciphertext.split(":", 2);
  if (version !== VERSION || !rest) {
    throw new Error("Unsupported credential ciphertext format");
  }
  const parts = rest.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed credential ciphertext");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Redact secrets from error messages before persisting or returning. */
export function sanitizeConnectorError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/password[=:]\s*\S+/gi, "password=[redacted]")
    .replace(/pwd[=:]\s*\S+/gi, "pwd=[redacted]")
    .replace(/private_key[^,}]* /gi, "private_key=[redacted] ")
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[redacted-pem]")
    .slice(0, 500);
}
