import { describe, it, expect } from "vitest";
import { verifySignature, generateSignature, generateSecret } from "../webhookValidator";

describe("webhookValidator", () => {
  describe("verifySignature", () => {
    it("should verify a valid signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const secret = generateSecret();
      const signature = generateSignature(payload, secret);

      const isValid = verifySignature({
        payload,
        signature,
        secret,
      });

      expect(isValid).toBe(true);
    });

    it("should reject an invalid signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const secret = generateSecret();
      const badSignature = "1234567890,invalidhash";

      const isValid = verifySignature({
        payload,
        signature: badSignature,
        secret,
      });

      expect(isValid).toBe(false);
    });

    it("should reject a signature with wrong secret", () => {
      const payload = JSON.stringify({ test: "data" });
      const secret = generateSecret();
      const wrongSecret = generateSecret();
      const signature = generateSignature(payload, secret);

      const isValid = verifySignature({
        payload,
        signature,
        secret: wrongSecret,
      });

      expect(isValid).toBe(false);
    });

    it("should reject an expired signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const secret = generateSecret();

      // Create a signature with an old timestamp
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400;
      const signed = require("crypto")
        .createHmac("sha256", secret)
        .update(`${oldTimestamp}.${payload}`)
        .digest("hex");
      const oldSignature = `${oldTimestamp},${signed}`;

      const isValid = verifySignature({
        payload,
        signature: oldSignature,
        secret,
        maxAgeSeconds: 300,
      });

      expect(isValid).toBe(false);
    });

    it("should accept a signature within the time window", () => {
      const payload = JSON.stringify({ test: "data" });
      const secret = generateSecret();
      const signature = generateSignature(payload, secret);

      const isValid = verifySignature({
        payload,
        signature,
        secret,
        maxAgeSeconds: 300,
      });

      expect(isValid).toBe(true);
    });
  });

  describe("generateSignature", () => {
    it("should generate a signature with timestamp and hash", () => {
      const payload = JSON.stringify({ test: "data" });
      const secret = generateSecret();
      const signature = generateSignature(payload, secret);

      const [timestamp, hash] = signature.split(",");
      expect(timestamp).toBeTruthy();
      expect(hash).toBeTruthy();
      expect(parseInt(timestamp, 10)).toBeGreaterThan(0);
      expect(hash.length).toBe(64); // SHA256 hex is 64 chars
    });
  });

  describe("generateSecret", () => {
    it("should generate a 64-character hex string", () => {
      const secret = generateSecret();
      expect(secret).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(secret)).toBe(true);
    });

    it("should generate unique secrets", () => {
      const secret1 = generateSecret();
      const secret2 = generateSecret();
      expect(secret1).not.toBe(secret2);
    });
  });
});
