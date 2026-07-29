import crypto from "crypto";

interface SignatureVerifyOptions {
  payload: string;
  signature: string;
  secret: string;
  maxAgeSeconds?: number;
}

export function verifySignature(opts: SignatureVerifyOptions): boolean {
  const { payload, signature, secret, maxAgeSeconds = 300 } = opts;

  const [timestamp, hash] = signature.split(",");
  if (!timestamp || !hash) return false;

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (now - ts > maxAgeSeconds) return false;

  const signed = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signed));
}

export function generateSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `${timestamp},${signed}`;
}

export function generateSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}
