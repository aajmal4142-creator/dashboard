import { decryptCredentials, encryptCredentials } from "@/lib/database/encrypt";

import type { EncryptedTokenBundle } from "./types";

const TOKEN_PREFIX = "v1:";

export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(TOKEN_PREFIX)) return plaintext;
  return encryptCredentials(plaintext);
}

export function decryptToken(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.startsWith(TOKEN_PREFIX)) {
    // Legacy plaintext rows — return as-is until next refresh encrypts them.
    return ciphertext;
  }
  return decryptCredentials(ciphertext);
}

export function encryptTokenBundle(bundle: EncryptedTokenBundle): EncryptedTokenBundle {
  return {
    accessToken: encryptToken(bundle.accessToken),
    refreshToken: bundle.refreshToken
      ? encryptToken(bundle.refreshToken)
      : bundle.refreshToken,
    expiresAt: bundle.expiresAt,
  };
}

export function decryptTokenBundle(bundle: EncryptedTokenBundle): EncryptedTokenBundle {
  return {
    accessToken: decryptToken(bundle.accessToken),
    refreshToken: bundle.refreshToken
      ? decryptToken(bundle.refreshToken)
      : bundle.refreshToken,
    expiresAt: bundle.expiresAt,
  };
}

export function isEncryptedToken(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(TOKEN_PREFIX));
}
