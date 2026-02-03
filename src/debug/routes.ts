import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getStore } from "../store/sqlite.js";

export const debugRoutes: FastifyPluginAsync = async (app) => {
  app.get("/calls", async (request) => {
    const q = z
      .object({
        limit: z.coerce.number().int().min(1).max(500).optional()
      })
      .safeParse(request.query);

    const store = getStore();
    const calls = store.listCalls(q.success ? q.data.limit ?? 50 : 50);
    return { ok: true, calls };
  });

  app.get<{ Params: { callId: string } }>("/calls/:callId", async (request, reply) => {
    const callId = request.params.callId;
    const store = getStore();
    const call = store.getCall(callId);
    if (!call) return reply.code(404).send({ ok: false });

    const events = store.listEvents(callId);
    const toolRuns = store.listToolRuns(callId);
    return { ok: true, call, events, toolRuns };
  });
};

