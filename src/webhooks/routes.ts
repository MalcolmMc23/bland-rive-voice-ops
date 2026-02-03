import type { FastifyPluginAsync } from "fastify";
import { Readable } from "node:stream";
import { env } from "../lib/env.js";
import { isoNowInTimeZone } from "../lib/time.js";
import { enqueueEvent } from "../events/queue.js";
import { verifyBlandWebhookOrThrow } from "./blandWebhook.js";

export const webhooksRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/bland",
    {
      // Capture the raw body for webhook signature verification, while still letting
      // Fastify's normal JSON parser run.
      preParsing: (request, _reply, payload, done) => {
        const chunks: Buffer[] = [];
        payload.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        payload.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");
          (request as unknown as { rawBody?: string }).rawBody = rawBody;
          done(null, Readable.from(rawBody));
        });
        payload.on("error", (err) => done(err));
      }
    },
    async (request, reply) => {
      const rawBody = (request as unknown as { rawBody?: string }).rawBody;
      if (!rawBody) return reply.code(400).send({ ok: false });

      try {
        verifyBlandWebhookOrThrow({
          secret: env.BLAND_WEBHOOK_SECRET,
          headers: request.headers,
          rawBody
        });
      } catch (error) {
        request.log.warn({ err: error }, "invalid webhook signature");
        return reply.code(401).send({ ok: false });
      }

      const body = request.body as unknown;
      if (body === undefined) return reply.code(400).send({ ok: false });

      enqueueEvent(body, {
        requestId: request.id,
        receivedAt: isoNowInTimeZone("America/Los_Angeles"),
        headers: request.headers as Record<string, unknown>
      });
      return reply.code(200).send({ ok: true });
    }
  );
};
