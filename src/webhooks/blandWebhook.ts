import crypto from "node:crypto";

type VerifyArgs = {
  secret?: string;
  headers: Record<string, unknown>;
  rawBody?: string;
};

export function verifyBlandWebhookOrThrow(args: VerifyArgs) {
  const { secret, headers, rawBody } = args;
  if (!secret) return; // allow in dev until you set it
  if (!rawBody) throw new Error("Missing rawBody for webhook verification");

  // Bland webhook signing:
  // - header: X-Webhook-Signature
  // - value: hex-encoded HMAC-SHA256 over the raw request body
  const signature = headerString(headers["x-webhook-signature"] ?? headers["X-Webhook-Signature"]);
  if (!signature) throw new Error("Missing X-Webhook-Signature header");

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const ok = timingSafeEqualHex(signature, expected);
  if (!ok) throw new Error("Invalid webhook signature");
}

function headerString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  return undefined;
}

function timingSafeEqualHex(aHex: string, bHex: string) {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
