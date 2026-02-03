import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { verifyBlandWebhookOrThrow } from "../src/webhooks/blandWebhook.js";

describe("verifyBlandWebhookOrThrow", () => {
  it("allows when no secret", () => {
    expect(() =>
      verifyBlandWebhookOrThrow({
        secret: undefined,
        headers: {},
        rawBody: "{}"
      })
    ).not.toThrow();
  });

  it("verifies hmac signature", () => {
    const secret = "test_secret";
    const rawBody = JSON.stringify({ hello: "world" });
    const sig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    expect(() =>
      verifyBlandWebhookOrThrow({
        secret,
        headers: { "x-webhook-signature": sig },
        rawBody
      })
    ).not.toThrow();
  });
});
